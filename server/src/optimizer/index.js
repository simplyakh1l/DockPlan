import {
  EPSILON,
  accessibleOrder,
  boxesOverlap,
  canSupport,
  candidateKey,
  contactRatio,
  hasSufficientSupport,
  orientationOptions,
  stackingLoadsValid,
  withinDoorCorridor,
} from './geometry.js';

export const DEFAULT_SCORING = Object.freeze({
  volume: 100,
  contact: 18,
  lowHeight: 7,
  accessibility: 14,
  compactness: 20,
  unplacedPenalty: 10,
});

function normaliseVehicle(vehicle = {}) {
  return {
    length: Number(vehicle.length),
    width: Number(vehicle.width),
    height: Number(vehicle.height),
    maxPayloadKg: Number(vehicle.maxPayloadKg),
    door: {
      width: Number(vehicle.door?.width ?? vehicle.rearDoorWidth),
      height: Number(vehicle.door?.height ?? vehicle.rearDoorHeight),
    },
  };
}

function normalisePackage(pkg = {}, index) {
  return {
    id: String(pkg.id ?? `PKG-${String(index + 1).padStart(3, '0')}`),
    label: String(pkg.label ?? pkg.name ?? pkg.id ?? `Package ${index + 1}`),
    length: Number(pkg.length),
    width: Number(pkg.width),
    height: Number(pkg.height),
    weight: Number(pkg.weight),
    stop: Number(pkg.stop ?? pkg.deliveryStop ?? 1),
    fragile: Boolean(pkg.fragile),
    noStack: Boolean(pkg.noStack ?? pkg.noStacking),
    baseRotationAllowed: pkg.baseRotationAllowed !== false,
    maxStackingLoadKg:
      pkg.maxStackingLoadKg == null || pkg.maxStackingLoadKg === ''
        ? null
        : Number(pkg.maxStackingLoadKg),
  };
}

function validateInput(vehicle, packages) {
  const errors = [];
  if (
    [
      vehicle.length,
      vehicle.width,
      vehicle.height,
      vehicle.maxPayloadKg,
      vehicle.door.width,
      vehicle.door.height,
    ].some((n) => !Number.isFinite(n) || n <= 0)
  )
    errors.push(
      'Vehicle dimensions, door dimensions and payload must be positive finite numbers.',
    );
  if (
    vehicle.door.width > vehicle.width ||
    vehicle.door.height > vehicle.height
  )
    errors.push('Rear door cannot be larger than the vehicle cross-section.');
  if (new Set(packages.map((p) => p.id)).size !== packages.length)
    errors.push('Package IDs must be unique.');
  if (packages.length > 100)
    errors.push('The optimizer accepts up to 100 packages per plan.');
  if (
    !Number.isFinite(vehicle.length * vehicle.width * vehicle.height) ||
    vehicle.length * vehicle.width * vehicle.height <= 0
  )
    errors.push('Vehicle volume is outside the supported numeric range.');
  packages.forEach((p) => {
    if (
      [p.length, p.width, p.height, p.weight, p.stop].some(
        (v) => !Number.isFinite(v) || v <= 0,
      )
    )
      errors.push(
        `${p.label}: dimensions, weight and stop must be positive numbers.`,
      );
    if (p.stop % 1 !== 0)
      errors.push(`${p.label}: delivery stop must be a whole number.`);
    if (
      !Number.isFinite(p.length * p.width * p.height) ||
      p.length * p.width * p.height <= 0
    )
      errors.push(`${p.label}: volume is outside the supported numeric range.`);
    if (
      p.maxStackingLoadKg != null &&
      (!Number.isFinite(p.maxStackingLoadKg) || p.maxStackingLoadKg < 0)
    )
      errors.push(`${p.label}: stacking load must be nonnegative.`);
  });
  return errors;
}

function orderingStrategies(packages) {
  return [
    [...packages].sort(
      (a, b) =>
        b.length * b.width * b.height - a.length * a.width * a.height ||
        a.stop - b.stop ||
        a.id.localeCompare(b.id),
    ),
    [...packages].sort(
      (a, b) =>
        a.stop - b.stop ||
        b.length * b.width - a.length * a.width ||
        a.id.localeCompare(b.id),
    ),
    [...packages].sort(
      (a, b) =>
        b.width * b.height - a.width * a.height ||
        a.stop - b.stop ||
        a.id.localeCompare(b.id),
    ),
  ];
}

function candidateScore(candidate, placed, vehicle, maxStop, scoring) {
  const volume = candidate.length * candidate.width * candidate.height;
  const vehicleVolume = vehicle.length * vehicle.width * vehicle.height;
  const contact = contactRatio(candidate, placed, vehicle);
  const heightPenalty = candidate.z / vehicle.height;
  const stopPenalty =
    ((candidate.x / vehicle.length) * (maxStop - candidate.stop + 1)) / maxStop;
  const extent = (boxes) =>
    Math.max(0, ...boxes.map((p) => p.x + p.length)) *
    Math.max(0, ...boxes.map((p) => p.y + p.width)) *
    Math.max(0, ...boxes.map((p) => p.z + p.height));
  const envelopeGrowth =
    (extent([...placed, candidate]) - extent(placed)) / vehicleVolume;
  return (
    (volume / vehicleVolume) * scoring.volume +
    contact * scoring.contact -
    heightPenalty * scoring.lowHeight -
    stopPenalty * scoring.accessibility -
    envelopeGrowth * scoring.compactness
  );
}

function feasible(candidate, placed, vehicle) {
  if (
    candidate.x < -EPSILON ||
    candidate.y < -EPSILON ||
    candidate.z < -EPSILON
  )
    return { valid: false, reason: 'Negative position.' };
  if (
    candidate.x + candidate.length > vehicle.length + EPSILON ||
    candidate.y + candidate.width > vehicle.width + EPSILON ||
    candidate.z + candidate.height > vehicle.height + EPSILON
  )
    return { valid: false, reason: 'Exceeds vehicle boundary.' };
  if (!withinDoorCorridor(candidate, vehicle))
    return {
      valid: false,
      reason: 'Outside the centered rear-door straight-extraction corridor.',
    };
  if (placed.some((p) => boxesOverlap(candidate, p)))
    return { valid: false, reason: 'Overlaps another package.' };
  const support = hasSufficientSupport(candidate, placed);
  if (!support.valid)
    return {
      valid: false,
      reason: `Only ${(support.ratio * 100).toFixed(0)}% supported; requires 70%.`,
    };
  if (support.supports.some((base) => !canSupport(base, candidate)))
    return {
      valid: false,
      reason: 'A fragile or load-limited package cannot support this package.',
    };
  if (!stackingLoadsValid([...placed, candidate]))
    return { valid: false, reason: 'Stacking load limit exceeded.' };
  if (!accessibleOrder([...placed, candidate]).valid)
    return {
      valid: false,
      reason: 'Would block the delivery or support-safe unloading sequence.',
    };
  return { valid: true, support };
}

function placeStrategy(vehicle, packages, scoring) {
  const placed = [];
  const unplaced = [];
  let candidates = [
    { x: 0, y: (vehicle.width - vehicle.door.width) / 2, z: 0 },
  ];
  let totalWeight = 0;
  const maxStop = Math.max(1, ...packages.map((p) => p.stop));
  for (const pkg of packages) {
    const orientations = orientationOptions(pkg, vehicle, vehicle.door);
    if (!orientations.length) {
      unplaced.push({
        ...pkg,
        reason: 'No allowed orientation fits the vehicle and rear door.',
      });
      continue;
    }
    if (totalWeight + pkg.weight > vehicle.maxPayloadKg + EPSILON) {
      unplaced.push({ ...pkg, reason: 'Vehicle payload would be exceeded.' });
      continue;
    }
    let best = null;
    for (const point of candidates) {
      for (const orientation of orientations) {
        const candidate = {
          ...pkg,
          ...orientation,
          x: point.x,
          y: point.y,
          z: point.z,
        };
        const check = feasible(candidate, placed, vehicle);
        if (!check.valid) continue;
        const score = candidateScore(
          candidate,
          placed,
          vehicle,
          maxStop,
          scoring,
        );
        if (
          !best ||
          score > best.score + EPSILON ||
          (Math.abs(score - best.score) <= EPSILON &&
            candidate.z < best.placement.z)
        )
          best = { placement: candidate, score };
      }
    }
    if (!best) {
      unplaced.push({
        ...pkg,
        reason:
          'No candidate satisfies space, support, stacking and delivery accessibility together.',
      });
      continue;
    }
    placed.push(best.placement);
    totalWeight += pkg.weight;
    const additions = [
      {
        x: best.placement.x + best.placement.length,
        y: best.placement.y,
        z: best.placement.z,
      },
      {
        x: best.placement.x,
        y: best.placement.y + best.placement.width,
        z: best.placement.z,
      },
      {
        x: best.placement.x,
        y: best.placement.y,
        z: best.placement.z + best.placement.height,
      },
    ];
    const all = [...candidates, ...additions];
    const seen = new Set();
    candidates = all
      .filter((p) => {
        if (
          p.x > vehicle.length + EPSILON ||
          p.y > vehicle.width + EPSILON ||
          p.z > vehicle.height + EPSILON
        )
          return false;
        const key = candidateKey(p);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
  }
  const accessibility = accessibleOrder(placed);
  const volume = placed.reduce(
    (sum, p) => sum + p.length * p.width * p.height,
    0,
  );
  const score =
    (volume / (vehicle.length * vehicle.width * vehicle.height)) *
      scoring.volume -
    unplaced.length * scoring.unplacedPenalty;
  return { placed, unplaced, accessibility, score, totalWeight };
}

export function validateArrangement(rawVehicle, placed, packages) {
  const vehicle = normaliseVehicle(rawVehicle);
  const checks = {
    boundaries: placed.every(
      (p) =>
        p.x >= -EPSILON &&
        p.y >= -EPSILON &&
        p.z >= -EPSILON &&
        p.x + p.length <= vehicle.length + EPSILON &&
        p.y + p.width <= vehicle.width + EPSILON &&
        p.z + p.height <= vehicle.height + EPSILON,
    ),
    collisions: placed.every((p, i) =>
      placed.slice(i + 1).every((q) => !boxesOverlap(p, q)),
    ),
    payload:
      placed.reduce((sum, p) => sum + p.weight, 0) <=
      vehicle.maxPayloadKg + EPSILON,
    doorClearance: placed.every((p) => withinDoorCorridor(p, vehicle)),
    orientations: placed.every((p) => {
      if (
        ![0, 90].includes(p.rotation) ||
        (p.rotation === 90 && !p.baseRotationAllowed)
      )
        return false;
      if (!packages) return true;
      const source = packages.find((item) => item.id === p.id);
      return (
        source &&
        orientationOptions(source, vehicle, vehicle.door).some(
          (o) =>
            o.rotation === p.rotation &&
            o.length === p.length &&
            o.width === p.width &&
            o.height === p.height,
        )
      );
    }),
    support: placed.every(
      (p) =>
        hasSufficientSupport(
          p,
          placed.filter((q) => q.id !== p.id),
        ).valid,
    ),
    stackingLoads: stackingLoadsValid(placed),
    accessibility: accessibleOrder(placed).valid,
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function optimizeLoadPlan(input = {}, options = {}) {
  const vehicle = normaliseVehicle(input?.vehicle ?? {});
  if (!Array.isArray(input?.packages ?? []))
    return {
      valid: false,
      errors: ['Packages must be an array.'],
      placed: [],
      unplaced: [],
      metrics: null,
    };
  const packages = (input?.packages ?? []).map((p, i) =>
    normalisePackage(p ?? {}, i),
  );
  const validationErrors = validateInput(vehicle, packages);
  if (validationErrors.length)
    return {
      valid: false,
      errors: validationErrors,
      placed: [],
      unplaced: packages.map((p) => ({ ...p, reason: 'Invalid input.' })),
      metrics: null,
    };
  const scoring = { ...DEFAULT_SCORING, ...(options.scoring ?? {}) };
  const attempts = orderingStrategies(packages).map((order) =>
    placeStrategy(vehicle, order, scoring),
  );
  const best = attempts.sort(
    (a, b) => b.score - a.score || a.unplaced.length - b.unplaced.length,
  )[0];
  const constraints = validateArrangement(input.vehicle, best.placed, packages);
  if (!constraints.valid)
    throw new Error(
      'Internal optimizer invariant failed. No arrangement was returned.',
    );
  const payload = best.totalWeight / vehicle.maxPayloadKg;
  const volume =
    best.placed.reduce((sum, p) => sum + p.length * p.width * p.height, 0) /
    (vehicle.length * vehicle.width * vehicle.height);
  const stacking = best.placed.map((p) => ({
    id: p.id,
    support: hasSufficientSupport(
      p,
      best.placed.filter((x) => x.id !== p.id),
    ).ratio,
    valid: hasSufficientSupport(
      p,
      best.placed.filter((x) => x.id !== p.id),
    ).valid,
  }));
  return {
    valid: true,
    errors: [],
    placed: best.placed,
    unplaced: best.unplaced,
    unloadingOrder: best.accessibility.order,
    accessibility: best.accessibility,
    constraints,
    stacking,
    score: Number(best.score.toFixed(3)),
    metrics: {
      volumeUtilization: Number((volume * 100).toFixed(1)),
      payloadUtilization: Number((payload * 100).toFixed(1)),
      placedCount: best.placed.length,
      unplacedCount: best.unplaced.length,
      totalWeight: best.totalWeight,
    },
    assumptions: [
      'Straight extraction along negative X through a centered, floor-level rear door; every box stays inside its opening corridor.',
      'A package above the floor requires at least 70% bottom-footprint support.',
      'Packages touching at an edge do not overlap.',
    ],
  };
}

export { feasible, validateInput };
