import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
const config = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  appUrl: 'http://localhost:5173',
};
const vehicle = {
  name: 'Van',
  length: 200,
  width: 100,
  height: 100,
  rearDoorWidth: 100,
  rearDoorHeight: 100,
  maxPayloadKg: 100,
};
const plan = { name: 'Private route', vehicle, packages: [] };
async function fixture(t, claims = {}) {
  const store = await createStore();
  let challenge;
  const googleClient = {
    generateAuthUrl(options) {
      challenge = options;
      return (
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams(options)
      );
    },
    async getToken(options) {
      assert.ok(options.codeVerifier);
      return { tokens: { id_token: 'test-provider-token' } };
    },
    async verifyIdToken() {
      return {
        getPayload: () => ({
          sub: 'google-user-a',
          email: 'a@example.test',
          email_verified: true,
          name: 'Test Operator',
          nonce: challenge.nonce,
          ...claims,
        }),
      };
    },
  };
  const server = createApp(store, { auth: { config, googleClient } }).listen(0);
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const login = async () => {
    const start = await fetch(base + '/auth/google?returnTo=/plans/new', {
      redirect: 'manual',
    });
    assert.equal(start.status, 302);
    assert.equal(
      new URL(start.headers.get('location')).searchParams.get(
        'code_challenge_method',
      ),
      'S256',
    );
    const cookie = start.headers.get('set-cookie').split(';')[0];
    const state = new URL(start.headers.get('location')).searchParams.get(
      'state',
    );
    const callback = await fetch(
      base + '/auth/google/callback?code=test-code&state=' + state,
      { headers: { cookie }, redirect: 'manual' },
    );
    return { callback, cookie, state };
  };
  return { store, base, login };
}
test('saved data requires login while public optimization remains available', async (t) => {
  const { base } = await fixture(t);
  for (const path of ['/load-plans', '/vehicles', '/load-plans/unknown'])
    assert.equal((await fetch(base + path)).status, 401);
  assert.equal(
    (
      await fetch(base + '/load-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + '/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      })
    ).status,
    200,
  );
});
test('Google flow creates an HttpOnly session, rejects CSRF and revokes logout', async (t) => {
  const { base, login } = await fixture(t);
  const { callback, cookie: flowCookie, state } = await login();
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/plans/new');
  const sessionCookie = callback.headers
    .getSetCookie()
    .find((c) => c.startsWith('dockplan_session='))
    .split(';')[0];
  assert.match(callback.headers.get('set-cookie'), /HttpOnly/);
  const session = await (
    await fetch(base + '/auth/session', { headers: { cookie: sessionCookie } })
  ).json();
  assert.equal(session.user.name, 'Test Operator');
  assert.ok(session.csrfToken);
  const headers = {
    cookie: sessionCookie,
    origin: config.appUrl,
    'Content-Type': 'application/json',
  };
  assert.equal(
    (
      await fetch(base + '/load-plans', {
        method: 'POST',
        headers,
        body: JSON.stringify(plan),
      })
    ).status,
    403,
  );
  headers['X-CSRF-Token'] = session.csrfToken;
  assert.equal(
    (
      await fetch(base + '/load-plans', {
        method: 'POST',
        headers: { ...headers, origin: 'https://evil.test' },
        body: JSON.stringify(plan),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + '/load-plans', {
        method: 'POST',
        headers,
        body: JSON.stringify(plan),
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await fetch(
        base + '/auth/google/callback?code=test-code&state=' + state,
        { headers: { cookie: flowCookie }, redirect: 'manual' },
      )
    ).headers.get('location'),
    '/?authError=google',
  );
  assert.equal(
    (await fetch(base + '/auth/logout', { method: 'POST', headers })).status,
    204,
  );
  assert.equal(
    (await fetch(base + '/load-plans', { headers: { cookie: sessionCookie } }))
      .status,
    401,
  );
});
test('invalid state and unverified Google email never create a session', async (t) => {
  const { base, login } = await fixture(t, { email_verified: false });
  const bad = await fetch(
    base + '/auth/google/callback?state=wrong&code=test',
    { redirect: 'manual' },
  );
  assert.equal(bad.headers.get('location'), '/?authError=google');
  const { callback } = await login();
  assert.equal(callback.headers.get('location'), '/?authError=google');
  assert.ok(
    !callback.headers
      .getSetCookie()
      .some((c) => c.startsWith('dockplan_session=')),
  );
});
test('nonce mismatch is rejected', async (t) => {
  const { login } = await fixture(t, { nonce: 'incorrect' });
  assert.equal(
    (await login()).callback.headers.get('location'),
    '/?authError=google',
  );
});
test('repository scopes every operation to its owner', async () => {
  const store = await createStore();
  const saved = await store.createPlan(plan, 'owner-a');
  await store.createVehicle(vehicle, 'owner-a');
  assert.equal((await store.listPlans('owner-b')).length, 0);
  assert.equal((await store.listVehicles('owner-b')).length, 0);
  assert.equal(await store.getPlan(saved._id, 'owner-b'), null);
  assert.equal(
    await store.updatePlan(saved._id, { name: 'stolen' }, 'owner-b'),
    null,
  );
  assert.equal(await store.deletePlan(saved._id, 'owner-b'), null);
  assert.equal((await store.getPlan(saved._id, 'owner-a')).name, plan.name);
});
test('Google login reports unconfigured state honestly', async (t) => {
  const server = createApp(await createStore(), {
    auth: { config: {} },
  }).listen(0);
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  assert.equal(
    (await (await fetch(base + '/auth/session')).json()).configured,
    false,
  );
  assert.equal(
    (await fetch(base + '/auth/google', { redirect: 'manual' })).status,
    503,
  );
});
