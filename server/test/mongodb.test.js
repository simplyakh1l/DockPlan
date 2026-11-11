import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createStore } from '../src/store.js';
import { optimizeLoadPlan } from '../src/optimizer/index.js';

// Use a dedicated test database: the test creates and deletes its own records.
test(
  'MongoDB persists vehicles and optimized plans across reconnection',
  { skip: !process.env.DOCKPLAN_TEST_MONGODB_URI },
  async (t) => {
    const uri = process.env.DOCKPLAN_TEST_MONGODB_URI;
    let store = await createStore(uri);
    const vehicle = {
      name: 'Integration vehicle',
      length: 200,
      width: 120,
      height: 120,
      maxPayloadKg: 100,
      rearDoorWidth: 120,
      rearDoorHeight: 120,
    };
    const plan = {
      name: 'Integration plan',
      vehicle,
      packages: [
        {
          id: 'DB-A',
          label: 'Test carton',
          length: 50,
          width: 40,
          height: 30,
          weight: 10,
          stop: 1,
          baseRotationAllowed: true,
        },
      ],
    };
    const preset = await store.createVehicle(vehicle, 'integration-owner');
    const saved = await store.createPlan(
      {
        ...plan,
        result: optimizeLoadPlan(plan),
      },
      'integration-owner',
    );
    t.after(async () => {
      await mongoose.connection
        .collection('vehicles')
        .deleteOne({ _id: preset._id });
      await store.deletePlan(String(saved._id), 'integration-owner');
      await mongoose.disconnect();
    });
    const expiry = new Date(Date.now() + 60_000);
    await store.upsertUser({
      _id: 'integration-google',
      name: 'Operator',
      email: 'operator@example.test',
    });
    await store.createSession('integration-session-hash', {
      user: {
        _id: 'integration-google',
        name: 'Operator',
        email: 'operator@example.test',
      },
      csrfToken: 'integration-csrf',
      expiresAt: expiry,
    });
    await store.createOAuthFlow('integration-state-hash', {
      browserHash: 'browser',
      verifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/',
      expiresAt: expiry,
    });
    assert.equal(
      await store.consumeOAuthFlow('integration-state-hash', 'wrong-browser'),
      null,
    );
    assert.equal(
      (await store.consumeOAuthFlow('integration-state-hash', 'browser')).nonce,
      'nonce',
    );
    assert.equal(
      await store.consumeOAuthFlow('integration-state-hash', 'browser'),
      null,
    );
    await mongoose.disconnect();
    store = await createStore(uri);
    assert.equal(
      (await store.getSession('integration-session-hash')).user._id,
      'integration-google',
    );
    await store.deleteSession('integration-session-hash');
    assert.equal(await store.getSession('integration-session-hash'), null);
    await mongoose.connection
      .collection('users')
      .deleteOne({ _id: 'integration-google' });
    const restored = await store.getPlan(
      String(saved._id),
      'integration-owner',
    );
    assert.equal(await store.getPlan(String(saved._id), 'other-owner'), null);
    assert.equal((await store.listVehicles('other-owner')).length, 0);
    assert.equal(restored.result.placed[0].id, 'DB-A');
    assert.equal(restored.result.constraints.valid, true);
    assert.ok(
      (await store.listVehicles('integration-owner')).some(
        (v) => String(v._id) === String(preset._id),
      ),
    );
    assert.ok(
      (await store.listPlans('integration-owner')).some(
        (p) => String(p._id) === String(saved._id),
      ),
    );
    assert.equal(
      (
        await store.updatePlan(
          String(saved._id),
          { name: 'Updated plan' },
          'integration-owner',
        )
      ).name,
      'Updated plan',
    );
  },
);
