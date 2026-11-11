# Delivery-aware extreme-point packing

## The problem and the promise

3D bin packing asks how to put rectangular items inside a fixed volume without overlap. Finding a mathematical optimum is computationally difficult; DockPlan uses a deterministic greedy heuristic. It promises to return a checked arrangement under its stated model, not to find every feasible arrangement or maximize utilization globally.

The engine is pure JavaScript in `server/src/optimizer/`. `optimizeLoadPlan({ vehicle, packages })` has no database, HTTP or UI dependencies. It does not mutate its input.

## Coordinate system

- X = vehicle length, with **X = 0 at the rear door**, increasing toward the front.
- Y = vehicle width, starting at the left interior edge when looking toward the front.
- Z = height, with **Z = 0 at the floor**.
- A position is the box's minimum corner, never its center.
- Units are centimetres and kilograms throughout the model and API.

The rear door is centered across Y and begins at Z = 0. Its horizontal interval is `[(width − doorWidth)/2, (width + doorWidth)/2]`. Every placed box stays inside that width interval and below door height, so it can pass through the opening at its actual Y/Z position without tilting or lateral movement. This conservatively leaves side space and overhead interior space unused when the door is smaller than the interior.

In Three.js the scene is scaled by 1/100 and uses `[X, Z, Y]` because Three's Y is vertical. Box centers add half their oriented dimensions; vehicle length/width are subtracted by half to center the scene. Only the renderer changes axes; optimizer coordinates remain untouched.

## Orientations

`orientationOptions` emits the original base (`rotation: 0`) and, if permitted and not square, the swapped length/width (`rotation: 90`). Height never changes. It removes options that cannot fit the interior or door opening. A later position check enforces the opening corridor too.

`baseRotationAllowed: false` preserves the original length/width. There is no arbitrary rotation or tilting.

## Extreme points and strategy loop

The first candidate is the rear floor corner of the door corridor: `(0, doorMinY, 0)`. When a box of oriented size `(l,w,h)` is placed at `(x,y,z)`, the engine adds:

```text
(x + l, y, z)     its front face
(x, y + w, z)     its side face
(x, y, z + h)     its top face
```

It retains existing points, removes duplicates and out-of-bounds coordinates, then sorts by X, Z and Y for stable tie-breaking. Point keys use three decimal places; geometric comparisons use an epsilon of `1e-6` cm.

For each package, the engine tries every candidate and allowed orientation, rejects invalid ones, scores the rest, and commits the highest score. It tries three complete orderings:

1. Descending volume, then ascending stop.
2. Ascending stop, then descending base area.
3. Descending width × height, then ascending stop.

Package ID breaks ties. Strategies are independent; the best complete objective wins with stable strategy-order ties. No randomness is used. Candidate points are a restricted extreme-point construction: there is no projected-face combination, backtracking, repacking or local search.

## Feasibility gates

### Bounds and payload

Every min corner is nonnegative and each max corner is within the vehicle. The complete box must stay within the rear-door corridor. Before searching a package, the engine checks that adding its weight would not exceed maximum payload. These are hard gates, not penalties.

### Collision

Two boxes overlap iff their open intervals intersect on **all three axes**. On an axis, `aMin < bMax − epsilon && bMin < aMax − epsilon`. Touching faces/edges do not collide. This axis-aligned bounding-box test is simple, inspectable and appropriate because arbitrary rotations are excluded.

### Support and stacking

Floor boxes have a support ratio of 1. Above-floor boxes require supports whose top faces lie at the candidate's bottom Z (within epsilon). The sum of their XY intersection areas must cover at least **70%** of the candidate's bottom area.

Already placed boxes are collision-free, so support rectangles at the same height cannot overlap in positive area. Adding their intersection areas therefore does not double-count support. Edge contacts contribute zero area. A fragile or no-stack base cannot support any positive footprint of another box.

Optional maximum stacking load is actually enforced. The engine follows direct top-face contacts to all descendant boxes, counts each descendant once per base, and sums their full weights. Every supporting base must remain below its maximum load. Shared support assigns the full descendant weight to each base, a conservative overestimate that avoids optimistic load distribution. Zero means no supported weight. No load limit is inferred when the value is empty.

Area support is not a center-of-mass or friction stability proof; no such claim is made.

### Delivery accessibility and unloading order

The only removal motion is straight translation along **negative X**. Box B blocks A when B is closer to the rear and their Y/Z footprints overlap. A later-stop box may never block an earlier-stop box. These pairwise violations reject the candidate immediately.

Within the smallest remaining stop, a topological walk repeatedly chooses a package with no remaining X blocker and no remaining package resting directly on its top. Ties use smallest X, highest Z, smallest Y, then ID. Remove it from the virtual load and repeat. If no package is available, the candidate is rejected. This also rejects later-stop cargo resting on an earlier-stop support and detects possible same-stop dependency cycles.

The support dependency is deliberately conservative: every upper package leaves before any of its supporting bases, even when enough alternative support might remain. Thus all prefixes of the generated sequence keep the remaining stacks supported. Reversing that sequence gives loading instructions.

The API returns the sequence. The simulator recomputes the same result, returns completed-stop IDs in that order and the next stop's first safe package. The browser staggers extraction animations in the returned order; counts update to the completed stop's state. This is a visual illustration, not a continuous-motion physical solver.

## Transparent scoring

All weights live in `DEFAULT_SCORING` in `optimizer/index.js`. The optional second argument can override them in direct engine calls. Hard constraints cannot be disabled through scoring.

For a feasible candidate:

```text
score = 100 × boxVolume / vehicleVolume
      + 18 × contactRatio
      −  7 × bottomZ / vehicleHeight
      − 14 × (x / vehicleLength) × (maxStop − stop + 1) / maxStop
      − 20 × boundingEnvelopeGrowth / vehicleVolume
```

Contact rewards floor, vehicle walls and top-face support area, normalized by the three distinct face areas and clamped to 1. The height term discourages high placements. The delivery term gives earlier stops a stronger preference for the rear. Envelope growth discourages placements that spread the load and leave gaps. The box-volume term is constant across candidates for one package; it expresses the common objective but does not itself choose that package's position.

The objective for choosing among full strategies is:

```text
100 × placedVolume / vehicleVolume − 10 × unplacedCount
```

This mixes cargo acceptance and space use. A large package can be favored over several very small ones; it is not an exact maximum-count objective. The returned `score` is this strategy objective. Metrics independently report volume utilization, payload utilization, placed/unplaced counts and placed weight. Volume utilization always divides by the **whole interior**, not only the door corridor.

## Final audit and failure behavior

Every accepted candidate satisfies the constraints, and the selected arrangement receives another audit (`validateArrangement`) for boundaries, collisions, payload, door corridor, source orientations, support, stacking loads and unloading access. An internal audit failure throws instead of exposing an unsafe arrangement.

Invalid input produces `valid: false` and errors. A valid optimization with unplaced packages has `valid: true`: this means the **placed arrangement** is valid, not that all cargo fits. Every original package appears in either `placed` or `unplaced`; payload, no-orientation and combined feasibility failures have explicit reasons. A combined failure means no tested candidate worked; it is not a proof of physical impossibility.

## Complexity and limits

There are at most `3n + 1` retained candidate points and two orientations per package, for three strategies. Basic collision checks are O(n) per candidate. Support graphs and the simple topological walk are more expensive: their conservative worst-case checks can approach O(n³) per candidate, making the current full implementation O(n⁵) in the worst case. Space is O(n) for stored candidates/placements and temporary graph state. Invalid candidates exit early, so the small MVP workloads are much faster in practice. A 100-box synthetic fixture took about 1.8 seconds on the implementation machine; timing varies with dimensions and constraints.

The API caps plans at 100 packages and runs the engine synchronously on Node's event loop. This is suitable for a local portfolio MVP, not a multi-user optimization service. Worker threads, spatial indexing, cached support/blocker graphs and incremental topological updates would be the next engineering steps.

There is no proof of global optimality, local search, load distribution, axle balance, real door offset configuration, securing, friction or realistic handling. More extreme points or search can improve packing quality, but should preserve these independently tested feasibility gates.
