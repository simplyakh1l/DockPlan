# Release status — 2026-11-11

- Public repository: https://github.com/simplyakh1l/DockPlan
- Production site: https://dockplan-jet.vercel.app
- GitHub profile README and pins: DockPlan → Seller360 → PinPoint.
- Verified: real optimizer demo, 3D rendering, server unloading simulation, guest access denial on private routes, static SPA fallback.
- Tests: 31 Node test-runner checks passed with temporary real MongoDB 8.0.16, including private ownership, OAuth replay/nonce/email checks, CSRF and logout. One runner entry is the test helper module. GitHub Actions also passed tests with MongoDB, production build and audits.
- npm audits: root, server and client report zero known vulnerabilities.
- Production audit: 80/100, launchable public demo with caveats. Live Google login remains blocked on MongoDB Atlas configuration and a real sign-in verification. No real Google sign-in is claimed yet.
- APP_URL and Google OAuth client credentials are configured on Vercel. Production currently reports configured:false for auth and memory for storage; private saving is unavailable until MONGODB_URI is provided and the app is redeployed.
- Google Cloud project DockPlan and its web OAuth client were created by the owner. The production callback is registered. Consent remains in Testing mode; account eligibility must be checked before the live sign-in test.
- Vercel is deployed via the authenticated official CLI. Automatic GitHub deployments are not connected because Vercel reports that a GitHub Login Connection is still needed.
- Rollback: redeploy a known-good Git commit with the Vercel CLI or promote a previous ready deployment in the Vercel dashboard. No destructive database migrations were performed. New required owner fields leave old unowned data inaccessible.
- Per-instance rate limiting is not a distributed abuse-control system; monitor Vercel usage and add firewall rules if needed.
