# DockPlan implementation plan

## Milestones

1. **Foundation** — Set up an npm workspace with an Express API, a Vite React client, environment configuration and a documented fallback store for local demos.
2. **Optimizer** — Implement the independent extreme-point placement engine with orientation, collision, support, payload, door and delivery-accessibility checks. Add deterministic tests before integrating it with the API.
3. **API and persistence** — Add vehicle/load-plan models, REST routes, CSV parsing, optimization persistence and an in-memory mode so the demo runs without MongoDB.
4. **Product UI** — Build the dashboard, vehicle and package workflow, CSV import, optimization results, loading instructions and an interactive React Three Fiber viewer that consumes actual optimizer coordinates.
5. **Simulation and verification** — Add stop-by-stop unloading simulation, export/print actions, documentation, production build checks and test cleanup.

## Decisions

- Dimensions are centimetres and weights are kilograms at every boundary.
- Extreme points are generated from the rear floor corner of the centered door corridor and the three exposed faces of every placed box. The deterministic heuristic tries several package orderings and retains the highest scoring feasible result.
- MongoDB is used when `MONGODB_URI` is available; a small in-memory repository keeps the application runnable for learning and portfolio demos without a database.
- The extraction model is intentionally straight-line: a later-stop box whose Y/Z footprint overlaps an earlier-stop box and sits closer to the rear door is an obstruction.

## Definition of done

- `npm test` passes optimizer and CSV tests.
- `npm run build` produces a client bundle.
- The UI can load the demo, import a CSV, run the real optimizer, inspect the 3D result, save/reopen a plan and step through unloading.

## Completion

All five milestones are implemented. The engine is independently audited after placement, the production client is served by Express, and MongoDB persistence was verified against a temporary real MongoDB 8 instance. See `VERIFICATION.md` for the executed checks and `ALGORITHM.md` for the conservative modeling limits.
