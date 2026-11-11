# Google accounts and publication

1. Add regression tests for Google OAuth state/nonce/PKCE, sessions, CSRF, logout and account isolation.
2. Implement Google sign-in and owner-scoped persistence while keeping the optimizer public.
3. Add account controls and Vercel routing; verify tests, MongoDB, production build and browser flows.
4. Publish to GitHub, deploy on Vercel, and order pins DockPlan, Seller360, PinPoint.

Acceptance: no client-supplied identity, no cross-account reads/writes, no secrets in Git, durable production storage and honest configuration states. Google/Vercel permissions and OAuth/database setup require the account owner when credentials are absent.

## Progress

Implementation, local verification, GitHub publication, Vercel public demo deployment and profile order are complete. The owner created the Google OAuth client and its credentials are configured on Vercel. Live account activation still needs an Atlas connection string, a redeployment, and a real Google sign-in verification. The app explicitly disables hosted sign-in until durable storage is configured. See RELEASE_STATUS.md and DEPLOYMENT.md.
