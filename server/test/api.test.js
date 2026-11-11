import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticatedServer } from './helpers.js';
import { createStore } from '../src/store.js';
import { importCsv } from '../src/utils/csv.js';

const csv =
  'id,label,length,width,height,weight,stop,fragile,noStack,baseRotationAllowed\nA,Carton,50,40,30,10,1,false,false,true';
const plan = {
  name: 'Test route',
  vehicle: {
    name: 'Van',
    length: 200,
    width: 100,
    height: 100,
    rearDoorWidth: 100,
    rearDoorHeight: 100,
    maxPayloadKg: 100,
  },
  packages: importCsv(csv).packages,
};

test('CSV validates rows, duplicates and malformed input', () => {
  assert.equal(importCsv(csv).packages.length, 1);
  const r = importCsv(`${csv}\nA,Bad,-1,40,30,10,1,maybe,false,true`);
  assert.equal(r.errors[0].row, 3);
  assert.throws(() => importCsv('id,label\nA,"unclosed'));
  assert.throws(() => importCsv('foo,bar\na,b'));
  assert.throws(
    () => importCsv('id,id,length,width,height,weight,stop\na,b,1,1,1,1,1'),
    /unique/,
  );
  const duplicates = importCsv(
    `${csv}\nA,Duplicate,50,40,30,10,1,false,false,true`,
  );
  assert.equal(duplicates.packages.length, 1);
  assert.equal(duplicates.errors.length, 1);
});
test('API saves, reopens, optimizes, exports, simulates and deletes a plan', async (t) => {
  const store = await createStore();
  const { base, headers } = await authenticatedServer(t, store);
  const request = (path, body, method = 'POST') =>
    fetch(`${base}${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let response = await request('/load-plans', { ...plan, optimize: true });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.result.placed.length, 1);
  assert.equal(
    (await (await fetch(`${base}/load-plans/${saved._id}`, { headers })).json())
      .name,
    plan.name,
  );
  assert.equal(
    (await (await request(`/load-plans/${saved._id}/optimize`, {})).json())
      .accessibility.valid,
    true,
  );
  const sim = await (
    await request('/simulate', { ...plan, completedStopCount: 1 })
  ).json();
  assert.equal(sim.remaining, 0);
  assert.deepEqual(sim.unloadedIds, ['A']);
  assert.match(await (await request('/export/csv', plan)).text(), /rotation/);
  response = await request('/optimize', {
    ...plan,
    packages: [{ ...plan.packages[0], stop: -1 }],
  });
  assert.equal(response.status, 422);
  assert.equal(
    (await request(`/load-plans/${saved._id}`, undefined, 'DELETE')).status,
    204,
  );
  assert.equal(
    (await fetch(`${base}/load-plans/${saved._id}`, { headers })).status,
    404,
  );
});

test('API rejects malformed inputs, imports a real multipart CSV and reports all placements', async (t) => {
  const { base, headers } = await authenticatedServer(t, await createStore());
  const request = (path, body, method = 'POST') =>
    fetch(`${base}${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  for (const bad of [
    { ...plan, vehicle: null },
    { ...plan, packages: [null] },
    { ...plan, packages: [plan.packages[0], plan.packages[0]] },
  ]) {
    assert.equal((await request('/optimize', bad)).status, 422);
  }
  const malformed = await fetch(`${base}/optimize`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal('stack' in (await malformed.json()), false);
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'cargo.csv');
  const imported = await (
    await fetch(`${base}/import/csv`, { method: 'POST', body: form })
  ).json();
  assert.equal(imported.packages.length, 1);
  assert.equal(
    (
      await fetch(`${base}/import/csv`, {
        method: 'POST',
        body: new FormData(),
      })
    ).status,
    400,
  );
  const impossible = {
    ...plan,
    packages: [{ ...plan.packages[0], width: 999, length: 999 }],
  };
  const exported = await (await request('/export/csv', impossible)).text();
  assert.match(exported, /unplaced/);
  assert.match(exported, /No allowed orientation/);
  const saved = await (
    await request('/load-plans', { ...plan, optimize: true })
  ).json();
  const updated = await (
    await request(
      `/load-plans/${saved._id}`,
      { ...plan, name: 'Revised' },
      'PUT',
    )
  ).json();
  assert.equal(updated.result, null);
  assert.equal(updated.name, 'Revised');
});
