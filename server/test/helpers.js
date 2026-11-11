import { createApp } from '../src/app.js';
export async function authenticatedServer(t, store) {
  let nonce;
  const server = createApp(store, {
    auth: {
      config: {
        clientId: 'test',
        clientSecret: 'test',
        appUrl: 'http://localhost:5173',
      },
      googleClient: {
        generateAuthUrl(options) {
          nonce = options.nonce;
          return (
            'https://accounts.google.com/auth?' + new URLSearchParams(options)
          );
        },
        async getToken() {
          return { tokens: { id_token: 'test' } };
        },
        async verifyIdToken() {
          return {
            getPayload: () => ({
              sub: 'test-operator',
              name: 'Operator',
              email: 'operator@example.test',
              email_verified: true,
              nonce,
            }),
          };
        },
      },
    },
  }).listen(0);
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const start = await fetch(base + '/auth/google', { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get(
    'state',
  );
  const callback = await fetch(
    base + '/auth/google/callback?code=test&state=' + state,
    {
      headers: { cookie: start.headers.get('set-cookie').split(';')[0] },
      redirect: 'manual',
    },
  );
  const cookie = callback.headers
    .getSetCookie()
    .find((c) => c.startsWith('dockplan_session='))
    .split(';')[0];
  const session = await (
    await fetch(base + '/auth/session', { headers: { cookie } })
  ).json();
  return {
    base,
    headers: {
      cookie,
      'X-CSRF-Token': session.csrfToken,
      origin: 'http://localhost:5173',
    },
  };
}
