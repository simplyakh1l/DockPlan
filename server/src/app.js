import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { configureAuth } from './auth/index.js';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { optimizeLoadPlan } from './optimizer/index.js';
import { importCsv, exportPlacements } from './utils/csv.js';
import { parsePlan, parseVehicle, HttpError } from './utils/validation.js';

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export function createApp(store, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.VERCEL) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          upgradeInsecureRequests:
            process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin:
        process.env.APP_URL ??
        process.env.CLIENT_ORIGIN ??
        'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 90,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        message: 'Too many requests. Please wait a minute and try again.',
      },
    }),
  );
  app.use(
    '/api/auth/google',
    rateLimit({
      windowMs: 60_000,
      limit: 15,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  configureAuth(app, store, options.auth);
  app.use(express.json({ limit: '1mb' }));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024, files: 1 },
  });
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', storage: store.mode }),
  );
  app.get(
    '/api/vehicles',
    wrap(async (req, res) => res.json(await store.listVehicles(req.ownerId))),
  );
  app.post(
    '/api/vehicles',
    wrap(async (req, res) =>
      res
        .status(201)
        .json(await store.createVehicle(parseVehicle(req.body), req.ownerId)),
    ),
  );
  app.get(
    '/api/load-plans',
    wrap(async (req, res) => res.json(await store.listPlans(req.ownerId))),
  );
  app.post(
    '/api/load-plans',
    wrap(async (req, res) => {
      const plan = parsePlan(req.body);
      const result = req.body.optimize ? optimizeLoadPlan(plan) : null;
      res
        .status(201)
        .json(await store.createPlan({ ...plan, result }, req.ownerId));
    }),
  );
  app.get(
    '/api/load-plans/:id',
    wrap(async (req, res) => {
      const plan = await store.getPlan(req.params.id, req.ownerId);
      if (!plan) throw new HttpError('Load plan not found.', 404);
      res.json(plan);
    }),
  );
  app.put(
    '/api/load-plans/:id',
    wrap(async (req, res) => {
      const plan = parsePlan(req.body);
      const result = req.body.optimize ? optimizeLoadPlan(plan) : null;
      const saved = await store.updatePlan(
        req.params.id,
        { ...plan, result },
        req.ownerId,
      );
      if (!saved) throw new HttpError('Load plan not found.', 404);
      res.json(saved);
    }),
  );
  app.delete(
    '/api/load-plans/:id',
    wrap(async (req, res) => {
      if (!(await store.deletePlan(req.params.id, req.ownerId)))
        throw new HttpError('Load plan not found.', 404);
      res.status(204).end();
    }),
  );
  app.post(
    '/api/load-plans/:id/optimize',
    wrap(async (req, res) => {
      const plan = await store.getPlan(req.params.id, req.ownerId);
      if (!plan) throw new HttpError('Load plan not found.', 404);
      const result = optimizeLoadPlan(parsePlan(plan));
      await store.updatePlan(req.params.id, { result }, req.ownerId);
      res.json(result);
    }),
  );
  app.post('/api/optimize', (req, res, next) => {
    try {
      res.json(optimizeLoadPlan(parsePlan(req.body)));
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/simulate', (req, res, next) => {
    try {
      const result = optimizeLoadPlan(parsePlan(req.body));
      if (!result.valid || !result.accessibility.valid)
        throw new HttpError(
          'Cannot simulate an invalid loading arrangement.',
          422,
        );
      const stops = [...new Set(result.placed.map((p) => p.stop))].sort(
        (a, b) => a - b,
      );
      const count = Number(req.body.completedStopCount ?? 0);
      if (!Number.isInteger(count) || count < 0 || count > stops.length)
        throw new HttpError('Invalid simulation step.', 422);
      const completedStops = stops.slice(0, count);
      const unloadedIds = result.unloadingOrder.filter((id) =>
        completedStops.includes(result.placed.find((p) => p.id === id).stop),
      );
      const nextStop = stops[count] ?? null;
      const nextStopOrder = result.unloadingOrder.filter(
        (id) => result.placed.find((p) => p.id === id).stop === nextStop,
      );
      const lastStopOrder = result.unloadingOrder.filter(
        (id) =>
          result.placed.find((p) => p.id === id).stop === completedStops.at(-1),
      );
      res.json({
        completedStops,
        nextStop,
        unloadedIds,
        nextStopOrder,
        lastStopOrder,
        readyIds: nextStopOrder.slice(0, 1),
        remaining: result.placed.length - unloadedIds.length,
        valid: true,
        complete: count === stops.length,
        stops,
      });
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/import/csv', upload.single('file'), (req, res, next) => {
    try {
      if (!req.file) throw new HttpError('Choose a CSV file.');
      res.json(importCsv(req.file.buffer));
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/export/csv', (req, res, next) => {
    try {
      const result = optimizeLoadPlan(parsePlan(req.body));
      res
        .type('text/csv')
        .attachment('dockplan-placements.csv')
        .send(exportPlacements(result));
    } catch (e) {
      next(e);
    }
  });
  const clientDist = fileURLToPath(
    new URL('../../client/dist', import.meta.url),
  );
  if (existsSync(`${clientDist}/index.html`)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(`${clientDist}/index.html`);
    });
  }
  app.use((_req, _res, next) =>
    next(new HttpError('Endpoint not found.', 404)),
  );
  app.use((error, _req, res, _next) => {
    const status =
      error instanceof multer.MulterError
        ? 422
        : (error.status ?? (error.type === 'entity.parse.failed' ? 400 : 500));
    if (status >= 500) console.error('API request failed:', error.name);
    res.status(status).json({
      message:
        status >= 500
          ? 'The server could not complete the request.'
          : error.message,
      details: error.details ?? [],
    });
  });
  return app;
}
