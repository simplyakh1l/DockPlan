# DockPlan: Google login and Vercel

The packing demo works without accounts. Saving plans and vehicles requires Google sign-in. Production Google sign-in requires MongoDB, so private data and OAuth sessions survive Vercel function restarts.

## 1. Deploy once to choose the app URL

Import https://github.com/simplyakh1l/DockPlan into Vercel using the repository root. Keep the included vercel.json build/install/output settings. Choose the Hobby plan for a personal portfolio. No paid service is required.

After deployment, copy its production URL (for example https://your-project.vercel.app). The URL must be stable; deployment preview URLs are not registered for sign-in by default.

## 2. Create free MongoDB Atlas storage

1. Open https://cloud.mongodb.com and sign in. Create a project named DockPlan if needed.
2. Create an **M0 Free** cluster. Do not select Flex, dedicated clusters or a paid upgrade.
3. Under Database Access create a database user with readWrite access to the dockplan database only. Choose a unique generated password and keep it in a password manager.
4. Configure Network Access for the deployment. Vercel Hobby does not provide fixed outbound IPs by default. Atlas commonly requires 0.0.0.0/0 for this setup; that exposes the database network endpoint broadly, although TLS and the database password still protect access. Only the owner should explicitly approve this tradeoff; prefer restricted egress when available.
5. Choose Connect → Drivers → Node.js. Copy the mongodb+srv connection string, URL-encode the password if necessary, and set the database path to /dockplan. Do not commit it or paste it into chat.
6. Put it into server/.env as MONGODB_URI for local testing and Vercel's Production environment variables for deployment.

## 3. Create a Google OAuth web client

1. Open https://console.cloud.google.com and choose/create a DockPlan project. OAuth login does not require enabling billing or buying an API.
2. Open Google Auth Platform. Configure Branding with app name DockPlan, your support email and developer contact email.
3. Select External audience. Testing mode permits only explicitly listed test users; add your Google account while testing. To allow any Google account, publish the app to Production after reviewing the consent-screen requirements.
4. Request only openid, email and profile. DockPlan does not request Drive, Calendar, Gmail or offline access.
5. Under Clients create an OAuth client, application type **Web application**, name DockPlan web.
6. Add these Authorized redirect URIs, replacing the production URL with the actual one:
   - http://localhost:5173/api/auth/google/callback
   - https://YOUR-PROJECT.vercel.app/api/auth/google/callback
     If serving a local production build on port 4000, also register http://localhost:4000/api/auth/google/callback.
7. Save the Client ID and Client Secret privately. Put them in server/.env and Vercel Production variables as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Never use VITE_ prefixes for secrets.

## 4. Environment and activation

Local server/.env:

    APP_URL=http://localhost:5173
    MONGODB_URI=<your-private-Atlas-connection-string>
    GOOGLE_CLIENT_ID=<your-web-client-id>
    GOOGLE_CLIENT_SECRET=<your-web-client-secret>

Vercel → Project → Settings → Environment Variables (Production):

    APP_URL=https://YOUR-PROJECT.vercel.app
    MONGODB_URI=<same-private-connection-string>
    GOOGLE_CLIENT_ID=<same-web-client-id>
    GOOGLE_CLIENT_SECRET=<same-web-client-secret>

APP_URL is the origin only, with no trailing slash. Redeploy after adding variables. Keep secrets out of Preview environments unless you intentionally configure a separate test database/OAuth redirect.

## 5. Verify

- /api/health reports mongodb storage.
- /api/auth/session reports configured: true and user: null before login.
- Sign in with Google, save a plan, sign out, then sign back in and reopen it.
- A different Google account sees only its own saved plans and vehicles.
- Private API routes return 401 to guests; other accounts cannot read a known plan ID.
- Logout revokes the server session. OAuth access/refresh tokens are never retained.

## Security and operating limits

Google validates identity; DockPlan validates state, browser binding, PKCE, nonce and verified email before creating a session. The app uses random HttpOnly SameSite=Lax cookies, Secure on HTTPS, hashed session IDs in MongoDB, seven-day expiry, logout revocation and CSRF tokens. Queries are scoped by Google's immutable subject ID. Existing records without an owner remain inaccessible; they are not assigned to the next visitor.

API limits are per function instance (90 requests/minute; 15 sign-in requests/minute). Vercel firewall controls can supplement these; no distributed rate-limit store is configured. Plan/vehicle lists return the latest 100 entries. Live Google login cannot be verified until the owner configures credentials and completes a real sign-in.

Vercel's api/index.js reuses the initialized Express app and MongoDB pool. The frontend is static in client/dist. Database failures return a generic 503 and are not replaced with an empty database.
