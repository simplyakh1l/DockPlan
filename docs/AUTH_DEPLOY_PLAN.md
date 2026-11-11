# Google accounts and publication

1. Add regression tests for Google OAuth state/nonce/PKCE, sessions, CSRF, logout and account isolation.
2. Implement Google sign-in and owner-scoped persistence while keeping the optimizer public.
3. Add account controls and Vercel routing; verify tests, MongoDB, production build and browser flows.
4. Publish to GitHub, deploy on Vercel, and order pins DockPlan, Seller360, PinPoint.

Acceptance: no client-supplied identity, no cross-account reads/writes, no secrets in Git, durable production storage and honest configuration states. Google/Vercel permissions and OAuth/database setup require the account owner when credentials are absent.

## Progress

Implementation, local verification, GitHub publication, Vercel public demo deployment and profile order are complete. Live account activation is pending owner OAuth policy/credential creation and an Atlas connection string. The app explicitly disables hosted sign-in until both are configured. See RELEASE_STATUS.md and DEPLOYMENT.md.
