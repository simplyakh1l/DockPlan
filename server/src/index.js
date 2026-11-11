import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createStore } from './store.js';

// Node 22 loads .env natively; no config dependency is needed.
const envPaths = ['../.env', '../../.env'].map((path) =>
  fileURLToPath(new URL(path, import.meta.url)),
);
const envPath = envPaths.find((path) => existsSync(path));
if (envPath) process.loadEnvFile(envPath);
try {
  const store = await createStore(process.env.MONGODB_URI);
  const port = process.env.PORT ?? 4000;
  createApp(store).listen(port, () => {
    console.log(
      `DockPlan API listening on http://localhost:${port} (${store.mode} storage)`,
    );
    if (store.mode === 'memory')
      console.log(
        'Demo mode: saved plans reset when the server restarts. Set MONGODB_URI for durable storage.',
      );
  });
} catch (error) {
  console.error(
    'Cannot start DockPlan. Check MongoDB connectivity and environment configuration.',
  );
  process.exit(1);
}
