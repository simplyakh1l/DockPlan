# Release status — 2026-11-11

- Public repository: https://github.com/simplyakh1l/DockPlan
- Production site: https://dockplan-jet.vercel.app
- GitHub profile README and pins: DockPlan → Seller360 → PinPoint.
- Verified: real optimizer demo, 3D rendering, server unloading simulation, guest access denial on private routes, static SPA fallback.
- Tests: 31 Node test-runner checks passed with temporary real MongoDB 8.0.16, including private ownership, OAuth replay/nonce/email checks, CSRF and logout. One runner entry is the test helper module. GitHub Actions also passed tests with MongoDB, production build and audits.
- npm audits: root, server and client report zero known vulnerabilities.
- Production audit: 80/100, launchable public demo with caveats. Live Google login and private persistence were verified on the production site after Atlas activation.
- APP_URL, Google OAuth client credentials, and MONGODB_URI are configured on Vercel. Production reports configured:true and storage:mongodb; a signed-in save returned “Load plan saved.” and logout returned the guest sign-in controls.
- Google Cloud project DockPlan and its web OAuth client were created by the owner. The production callback is registered, and akhilsharma22092006@gmail.com is an OAuth test user. Consent remains in Testing mode, so additional users must be added or the app must be published after Google’s review requirements are met.
- Vercel is deployed via the authenticated official CLI. Automatic GitHub deployments are not connected because Vercel reports that a GitHub Login Connection is still needed.
- Rollback: redeploy a known-good Git commit with the Vercel CLI or promote a previous ready deployment in the Vercel dashboard. No destructive database migrations were performed. New required owner fields leave old unowned data inaccessible.
- Per-instance rate limiting is not a distributed abuse-control system; monitor Vercel usage and add firewall rules if needed.
