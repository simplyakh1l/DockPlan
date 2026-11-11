import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optimizeLoadPlan,
  feasible,
  validateArrangement,
} from '../src/optimizer/index.js';
import {
  accessibleOrder,
  boxesOverlap,
  hasSufficientSupport,
  stackingLoadsValid,
} from '../src/optimizer/geometry.js';

const vehicle = {
  name: 'Test van',
  length: 200,
  width: 120,
  height: 120,
  maxPayloadKg: 100,
  rearDoorWidth: 120,
  rearDoorHeight: 120,
};
const pkg = (id, extra = {}) => ({
  id,
  label: id,
  length: 60,
  width: 60,
  height: 40,
  weight: 10,
  stop: 1,
  fragile: false,
  noStack: false,
  baseRotationAllowed: true,
  ...extra,
});
const run = (packages, v = vehicle) =>
  optimizeLoadPlan({ vehicle: v, packages });

test('empty vehicle accepts a package at valid coordinates', () => {
  const result = run([pkg('A')]);
  assert.equal(result.placed.length, 1);
  assert.equal(result.placed[0].z, 0);
  assert.ok(result.metrics.volumeUtilization > 0);
});
test('empty input returns a valid empty arrangement', () => {
  const r = run([]);
  assert.equal(r.placed.length, 0);
  assert.equal(r.metrics.volumeUtilization, 0);
});
test('oversize packages are reported, never silently discarded', () => {
  const r = run([pkg('too-big', { length: 500, width: 500 })]);
  assert.equal(r.placed.length, 0);
  assert.equal(r.unplaced[0].id, 'too-big');
  assert.match(r.unplaced[0].reason, /orientation/);
});
test('placed boxes never overlap', () => {
  const r = run(Array.from({ length: 8 }, (_, i) => pkg(`P${i}`)));
  assert.ok(r.placed.length > 1);
  r.placed.forEach((a, i) =>
    r.placed
      .slice(i + 1)
      .forEach((b) => assert.equal(boxesOverlap(a, b), false)),
  );
});
test('rotation is used only when permitted', () => {
  const v = { ...vehicle, length: 80, width: 100, rearDoorWidth: 100 };
  assert.equal(
    run([pkg('rot', { length: 90, width: 70 })], v).placed[0].rotation,
    90,
  );
  assert.equal(
    run(
      [pkg('fixed', { length: 90, width: 70, baseRotationAllowed: false })],
      v,
    ).unplaced.length,
    1,
  );
});
test('payload is a hard constraint', () => {
  const r = run([pkg('A', { weight: 60 }), pkg('B', { weight: 60 })]);
  assert.equal(r.placed.length, 1);
  assert.equal(r.unplaced.length, 1);
  assert.match(r.unplaced[0].reason, /payload/);
});
test('fragile and no-stack bases cannot support packages', () => {
  const v = { ...vehicle, length: 60, width: 60, rearDoorWidth: 60 };
  for (const flag of ['fragile', 'noStack']) {
    const r = run([pkg('A', { [flag]: true }), pkg('B', { [flag]: true })], v);
    assert.equal(r.placed.length, 1);
  }
});
test('support below 70 percent is rejected and exact threshold is accepted', () => {
  const base = {
    ...pkg('base'),
    x: 0,
    y: 0,
    z: 0,
    length: 60,
    width: 60,
    height: 40,
  };
  assert.equal(
    hasSufficientSupport({ x: 30, y: 0, z: 40, length: 60, width: 60 }, [base])
      .valid,
    false,
  );
  assert.equal(
    hasSufficientSupport({ x: 18, y: 0, z: 40, length: 60, width: 60 }, [base])
      .valid,
    true,
  );
});
test('rear-door clearance rejects a box that fits the interior', () => {
  const r = run([pkg('A', { length: 100, width: 100 })], {
    ...vehicle,
    rearDoorWidth: 80,
  });
  assert.equal(r.unplaced.length, 1);
});
test('later-stop boxes cannot obstruct earlier stops along negative X', () => {
  const a = { ...pkg('early'), x: 80, y: 0, z: 0 };
  const b = { ...pkg('late', { stop: 2 }), x: 0, y: 0, z: 0 };
  assert.equal(accessibleOrder([a, b]).valid, false);
  assert.equal(
    feasible(b, [a], { ...vehicle, door: { width: 120, height: 120 } }).valid,
    false,
  );
});
test('same-stop boxes have rear-first unloading order and top-first support dependencies', () => {
  const rear = { ...pkg('rear'), x: 0, y: 0, z: 0 };
  const front = { ...pkg('front'), x: 60, y: 0, z: 0 };
  assert.deepEqual(accessibleOrder([front, rear]).order, ['rear', 'front']);
  const top = { ...pkg('top'), x: 0, y: 0, z: 40 };
  assert.deepEqual(accessibleOrder([rear, top]).order, ['top', 'rear']);
  assert.equal(accessibleOrder([rear, { ...top, stop: 2 }]).valid, false);
});
test('stacking load includes descendants conservatively', () => {
  const base = { ...pkg('base', { maxStackingLoadKg: 15 }), x: 0, y: 0, z: 0 };
  const mid = { ...pkg('mid'), x: 0, y: 0, z: 40 };
  const top = { ...pkg('top'), x: 0, y: 0, z: 80 };
  assert.equal(stackingLoadsValid([base, mid]), true);
  assert.equal(stackingLoadsValid([base, mid, top]), false);
});
test('repeated input produces identical output', () => {
  const packages = Array.from({ length: 12 }, (_, i) =>
    pkg(`P${i}`, { stop: (i % 3) + 1 }),
  );
  assert.deepEqual(run(packages), run(packages));
});
test('invalid, negative and duplicate inputs cannot enter the engine', () => {
  assert.equal(run([pkg('bad', { width: -1 })]).valid, false);
  assert.equal(run([pkg('same'), pkg('same')]).valid, false);
  assert.equal(run([], { ...vehicle, height: -10 }).valid, false);
});
test('varied deterministic scenarios always satisfy all final constraints', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const input = Array.from({ length: 15 }, (_, i) =>
      pkg(`${seed}-${i}`, {
        length: 20 + ((i * seed * 17) % 80),
        width: 20 + ((i * 11) % 60),
        height: 20 + ((i * 13) % 50),
        stop: (i % 4) + 1,
        fragile: i % 7 === 0,
      }),
    );
    const r = run(input);
    assert.equal(r.placed.length + r.unplaced.length, input.length);
    assert.equal(accessibleOrder(r.placed).valid, true);
    assert.equal(stackingLoadsValid(r.placed), true);
    assert.ok(r.metrics.totalWeight <= vehicle.maxPayloadKg);
    for (const p of r.placed) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.z >= 0);
      assert.ok(
        p.x + p.length <= vehicle.length &&
          p.y + p.width <= vehicle.width &&
          p.z + p.height <= vehicle.height,
      );
      assert.ok(
        p.width <= vehicle.rearDoorWidth && p.height <= vehicle.rearDoorHeight,
      );
      assert.ok(
        hasSufficientSupport(
          p,
          r.placed.filter((q) => q.id !== p.id),
        ).valid,
      );
      for (const q of r.placed)
        if (p.id !== q.id) assert.equal(boxesOverlap(p, q), false);
    }
  }
});

test('straight extraction respects the actual centered door corridor at every height', () => {
  const v = { ...vehicle, rearDoorWidth: 80, rearDoorHeight: 70 };
  const r = run([pkg('A'), pkg('B'), pkg('C')], v);
  for (const p of r.placed) {
    assert.ok(p.y >= 20 && p.y + p.width <= 100);
    assert.ok(p.z + p.height <= 70);
  }
  assert.equal(r.constraints.valid, true);
});

test('every prefix of the unloading sequence remains supported and collision free', () => {
  const r = run(Array.from({ length: 9 }, (_, i) => pkg(`S${i}`)));
  let remaining = [...r.placed];
  for (const id of r.unloadingOrder) {
    const p = remaining.find((box) => box.id === id);
    assert.ok(p);
    assert.equal(
      remaining.some(
        (q) =>
          q.id !== id &&
          q.x < p.x &&
          q.y < p.y + p.width &&
          q.y + q.width > p.y &&
          q.z < p.z + p.height &&
          q.z + q.height > p.z,
      ),
      false,
    );
    remaining = remaining.filter((box) => box.id !== id);
    for (const q of remaining)
      assert.equal(
        hasSufficientSupport(
          q,
          remaining.filter((box) => box.id !== q.id),
        ).valid,
        true,
      );
  }
  assert.equal(remaining.length, 0);
});

test('maximum stacking load is enforced by placement, not just metadata', () => {
  const v = { ...vehicle, length: 60, width: 60, rearDoorWidth: 60 };
  const r = run(
    [pkg('A', { maxStackingLoadKg: 0 }), pkg('B', { maxStackingLoadKg: 0 })],
    v,
  );
  assert.equal(r.placed.length, 1);
  assert.equal(r.unplaced.length, 1);
});

test('final validation catches prohibited orientations and malformed shapes', () => {
  const r = run([pkg('A')]);
  assert.equal(
    validateArrangement(vehicle, [
      { ...r.placed[0], rotation: 90, baseRotationAllowed: false },
    ]).valid,
    false,
  );
  assert.equal(optimizeLoadPlan({ vehicle, packages: {} }).valid, false);
  assert.equal(optimizeLoadPlan(null).valid, false);
  assert.equal(run([null]).valid, false);
  assert.equal(run([pkg('A', { length: 1e200, width: 1e200 })]).valid, false);
});

test('optimizer never mutates caller input', () => {
  const input = {
    vehicle: { ...vehicle },
    packages: [pkg('A'), pkg('B', { stop: 2 })],
  };
  const original = structuredClone(input);
  optimizeLoadPlan(input);
  assert.deepEqual(input, original);
});
