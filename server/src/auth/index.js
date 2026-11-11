import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { HttpError } from '../utils/validation.js';
export const hashToken = (value) =>
  createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
const safeEqual = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const safeReturn = (value) =>
  typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(value)
    ? value
    : '/';
export function configureAuth(app, store, options = {}) {
  const config = options.config ?? {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    appUrl: process.env.APP_URL,
  };
  const secure = config.appUrl?.startsWith('https://') ?? false;
  const validOrigin =
    config.appUrl &&
    (() => {
      try {
        return (
          new URL(config.appUrl).origin === config.appUrl &&
          (secure || config.appUrl.startsWith('http://localhost:'))
        );
      } catch {
        return false;
      }
    })();
  const configured = Boolean(
    config.clientId &&
    config.clientSecret &&
    validOrigin &&
    (store.mode === 'mongodb' ||
      (!process.env.VERCEL && process.env.NODE_ENV !== 'production')),
  );
  const redirectUri = config.appUrl + '/api/auth/google/callback';
  const google =
    options.googleClient ??
    new OAuth2Client(config.clientId, config.clientSecret, redirectUri);
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  const asyncRoute = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/api',
    asyncRoute(async (req, _res, next) => {
      const token = req.cookies.dockplan_session;
      if (typeof token === 'string' && token.length < 200)
        req.session = await store.getSession(hashToken(token));
      next();
    }),
  );
  app.get('/api/auth/session', (req, res) =>
    res.json({
      configured,
      user: req.session?.user ?? null,
      csrfToken: req.session?.csrfToken ?? null,
    }),
  );
  app.get(
    '/api/auth/google',
    asyncRoute(async (req, res) => {
      if (!configured)
        throw new HttpError(
          'Google sign-in is not configured. The operator needs to connect Google OAuth and MongoDB.',
          503,
        );
      const state = randomToken();
      const browserToken = randomToken();
      const verifier = randomToken();
      const nonce = randomToken();
      await store.createOAuthFlow(hashToken(state), {
        browserHash: hashToken(browserToken),
        verifier,
        nonce,
        returnTo: safeReturn(req.query.returnTo),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
      res.cookie('dockplan_oauth', browserToken, {
        ...cookieOptions,
        maxAge: 10 * 60_000,
      });
      res.redirect(
        google.generateAuthUrl({
          scope: ['openid', 'email', 'profile'],
          state,
          nonce,
          code_challenge: createHash('sha256')
            .update(verifier)
            .digest('base64url'),
          code_challenge_method: 'S256',
          prompt: 'select_account',
        }),
      );
    }),
  );
  app.get(
    '/api/auth/google/callback',
    asyncRoute(async (req, res) => {
      res.clearCookie('dockplan_oauth', cookieOptions);
      try {
        if (
          !configured ||
          typeof req.query.state !== 'string' ||
          typeof req.query.code !== 'string' ||
          typeof req.cookies.dockplan_oauth !== 'string' ||
          req.query.state.length > 200 ||
          req.query.code.length > 4096
        )
          throw new Error('Invalid callback');
        const flow = await store.consumeOAuthFlow(
          hashToken(req.query.state),
          hashToken(req.cookies.dockplan_oauth),
        );
        if (!flow) throw new Error('Expired or replayed state');
        const { tokens } = await google.getToken({
          code: req.query.code,
          codeVerifier: flow.verifier,
          redirect_uri: redirectUri,
        });
        const ticket = await google.verifyIdToken({
          idToken: tokens.id_token,
          audience: config.clientId,
        });
        const claims = ticket.getPayload();
        if (
          !claims?.sub ||
          claims.email_verified !== true ||
          !safeEqual(claims.nonce, flow.nonce)
        )
          throw new Error('Invalid identity');
        const user = await store.upsertUser({
          _id: claims.sub,
          name: String(claims.name || claims.email).slice(0, 100),
          email: String(claims.email).slice(0, 254),
        });
        const token = randomToken();
        if (req.cookies.dockplan_session)
          await store.deleteSession(hashToken(req.cookies.dockplan_session));
        await store.createSession(hashToken(token), {
          user,
          csrfToken: randomToken(),
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        });
        res.cookie('dockplan_session', token, {
          ...cookieOptions,
          maxAge: 7 * 86400_000,
        });
        res.redirect(flow.returnTo);
      } catch {
        // Never log OAuth codes, tokens, provider payloads or connection strings.
        res.redirect('/?authError=google');
      }
    }),
  );
  const requireAuth = (req, _res, next) => {
    if (!req.session)
      return next(
        new HttpError(
          'Sign in with Google to access your saved plans and vehicles.',
          401,
        ),
      );
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        !safeEqual(req.get('X-CSRF-Token'), req.session.csrfToken) ||
        (req.get('Origin') && req.get('Origin') !== config.appUrl)
      )
        return next(
          new HttpError(
            'Your session could not verify this request. Refresh and try again.',
            403,
          ),
        );
    }
    req.ownerId = req.session.user._id;
    next();
  };
  app.post(
    '/api/auth/logout',
    requireAuth,
    asyncRoute(async (req, res) => {
      await store.deleteSession(hashToken(req.cookies.dockplan_session));
      res.clearCookie('dockplan_session', cookieOptions);
      res.status(204).end();
    }),
  );
  app.use('/api/load-plans', requireAuth);
  app.use('/api/vehicles', requireAuth);
}
