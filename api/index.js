import { createApp } from '../server/src/app.js';
import { createStore } from '../server/src/store.js';
let appPromise;
export default async function handler(req, res) {
  try {
    appPromise ??= createStore(process.env.MONGODB_URI)
      .then(createApp)
      .catch((error) => {
        appPromise = null;
        throw error;
      });
    const app = await appPromise;
    return app(req, res);
  } catch {
    res
      .status(503)
      .json({
        message:
          'DockPlan storage is temporarily unavailable. Please try again shortly.',
      });
  }
}
