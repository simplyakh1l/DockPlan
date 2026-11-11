export const EPSILON = 1e-6;

export function rangesOverlap(aStart, aSize, bStart, bSize) {
  return aStart < bStart + bSize - EPSILON && bStart < aStart + aSize - EPSILON;
}

export function boxesOverlap(a, b) {
  return (
    rangesOverlap(a.x, a.length, b.x, b.length) &&
    rangesOverlap(a.y, a.width, b.y, b.width) &&
    rangesOverlap(a.z, a.height, b.z, b.height)
  );
}

export function footprintOverlap(a, b) {
  if (
    !rangesOverlap(a.x, a.length, b.x, b.length) ||
    !rangesOverlap(a.y, a.width, b.y, b.width)
  )
    return 0;
  const x = Math.min(a.x + a.length, b.x + b.length) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.width, b.y + b.width) - Math.max(a.y, b.y);
  return Math.max(0, x) * Math.max(0, y);
}

export function hasYZOverlap(a, b) {
  return (
    rangesOverlap(a.y, a.width, b.y, b.width) &&
    rangesOverlap(a.z, a.height, b.z, b.height)
  );
}

export function orientationOptions(pkg, vehicle, door) {
  const options = [
    { length: pkg.length, width: pkg.width, height: pkg.height, rotation: 0 },
  ];
  if (pkg.baseRotationAllowed && pkg.length !== pkg.width) {
    options.push({
      length: pkg.width,
      width: pkg.length,
      height: pkg.height,
      rotation: 90,
    });
  }
  return options.filter(
    (o) =>
      o.length <= vehicle.length + EPSILON &&
      o.width <= vehicle.width + EPSILON &&
      o.height <= vehicle.height + EPSILON &&
      o.width <= door.width + EPSILON &&
      o.height <= door.height + EPSILON,
  );
}

export function contactRatio(candidate, placed, vehicle) {
  const footprint = candidate.length * candidate.width;
  let contact = 0;
  if (candidate.z <= EPSILON) contact += footprint;
  if (candidate.x <= EPSILON) contact += candidate.width * candidate.height;
  if (
    candidate.y <= EPSILON ||
    candidate.y + candidate.width >= vehicle.width - EPSILON
  )
    contact += candidate.length * candidate.height;
  for (const other of placed) {
    const touchingTop =
      Math.abs(other.z + other.height - candidate.z) <= EPSILON;
    if (touchingTop) contact += footprintOverlap(candidate, other);
  }
  return Math.min(
    1,
    contact /
      (footprint +
        candidate.length * candidate.height +
        candidate.width * candidate.height),
  );
}

export function hasSufficientSupport(candidate, placed, threshold = 0.7) {
  if (candidate.z <= EPSILON) return { valid: true, ratio: 1, supports: [] };
  const area = candidate.length * candidate.width;
  const supports = placed.filter(
    (p) => Math.abs(p.z + p.height - candidate.z) <= EPSILON,
  );
  const supportedArea = supports.reduce(
    (sum, p) => sum + footprintOverlap(candidate, p),
    0,
  );
  const ratio = area ? Math.min(1, supportedArea / area) : 0;
  return { valid: ratio + EPSILON >= threshold, ratio, supports };
}

export function canSupport(candidate, incoming) {
  const restricted = candidate.fragile || candidate.noStack;
  if (
    restricted &&
    Math.abs(candidate.z + candidate.height - incoming.z) <= EPSILON &&
    footprintOverlap(candidate, incoming) > 0
  )
    return false;
  return true;
}

export function withinDoorCorridor(box, vehicle) {
  const door = vehicle.door ?? {
    width: vehicle.rearDoorWidth,
    height: vehicle.rearDoorHeight,
  };
  const minY = (vehicle.width - door.width) / 2;
  return (
    box.y >= minY - EPSILON &&
    box.y + box.width <= minY + door.width + EPSILON &&
    box.z + box.height <= door.height + EPSILON
  );
}

export function accessibleOrder(placed) {
  const violations = [];
  for (const earlier of placed) {
    for (const later of placed) {
      if (earlier.id === later.id || later.stop <= earlier.stop) continue;
      if (later.x < earlier.x - EPSILON && hasYZOverlap(earlier, later)) {
        violations.push({
          earlier: earlier.id,
          blocker: later.id,
          message: `${later.label} (stop ${later.stop}) blocks ${earlier.label} (stop ${earlier.stop})`,
        });
      }
    }
  }
  // Unload blockers and boxes above a supporting base first. A topological
  // walk also detects same-stop cycles that a simple X sort would miss.
  const remaining = [...placed];
  const order = [];
  while (remaining.length) {
    const stop = Math.min(...remaining.map((p) => p.stop));
    const ready = remaining
      .filter(
        (p) =>
          p.stop === stop &&
          !remaining.some(
            (q) =>
              q.id !== p.id &&
              ((q.x < p.x - EPSILON && hasYZOverlap(p, q)) ||
                (Math.abs(p.z + p.height - q.z) <= EPSILON &&
                  footprintOverlap(p, q) > EPSILON)),
          ),
      )
      .sort(
        (a, b) =>
          a.x - b.x || b.z - a.z || a.y - b.y || a.id.localeCompare(b.id),
      );
    if (!ready.length) {
      violations.push({
        message: `Stop ${stop} has no safe straight-extraction sequence (including support dependencies).`,
      });
      break;
    }
    order.push(ready[0].id);
    remaining.splice(remaining.indexOf(ready[0]), 1);
  }
  return { valid: violations.length === 0, violations, order };
}

export function stackingLoadsValid(placed) {
  for (const base of placed) {
    const descendants = new Set();
    const visit = (support) => {
      for (const top of placed) {
        if (
          Math.abs(support.z + support.height - top.z) <= EPSILON &&
          footprintOverlap(support, top) > EPSILON &&
          !descendants.has(top.id)
        ) {
          descendants.add(top.id);
          visit(top);
        }
      }
    };
    visit(base);
    if ((base.fragile || base.noStack) && descendants.size) return false;
    // Conservative: each supporting box carries the full weight of all boxes
    // above it. Shared loads are never underestimated or counted twice.
    const load = placed
      .filter((p) => descendants.has(p.id))
      .reduce((sum, p) => sum + p.weight, 0);
    if (
      base.maxStackingLoadKg != null &&
      load > base.maxStackingLoadKg + EPSILON
    )
      return false;
  }
  return true;
}

export function candidateKey(p) {
  return `${p.x.toFixed(3)}:${p.y.toFixed(3)}:${p.z.toFixed(3)}`;
}
