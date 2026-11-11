# Learning DockPlan

## Start with the running product

Run `npm run setup` then `npm run dev`. Open the demo. Note that its colored boxes have exactly the min-corner positions in the optimizer response shown in your browser's Network panel. Start the unloading run and complete stop 1. Four boxes leave and 12 remain. Add a package: the result disappears until you optimize again, because the old arrangement is no longer evidence for the edited cargo.

## The first five files

1. **`server/src/optimizer/index.js`**: read `optimizeLoadPlan`, then `placeStrategy`, `feasible`, `candidateScore`, and `validateArrangement`. The outer function tries complete strategies; the inner loop decides one box at a time.
2. **`server/src/optimizer/geometry.js`**: draw two boxes and trace `boxesOverlap`, `footprintOverlap`, `hasSufficientSupport`, `withinDoorCorridor` and `accessibleOrder`. This file translates physical assumptions into predicates.
3. **`server/src/app.js`**: trace `POST /api/optimize`. A request becomes a validated plain object, the pure engine computes, and Express serializes the output. No JSX or database calls belong in the engine.
4. **`client/src/pages/Planner.jsx`**: start at its state variables, then read `change`, `optimize`, `save`, `importFile` and `simulate`. React rerenders when state changes; it does not compute packing in render.
5. **`client/src/components/CargoViewer.jsx`**: trace one package through `CargoBox`. The renderer uses its oriented dimensions and adds half the size to convert a min corner to a mesh center. It swaps Y/Z for Three.js and scales cm by 100.

## A beginner's map of the modules

| File / module                    | What to learn                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `client/src/main.jsx`            | React root, Strict Mode and BrowserRouter.                                              |
| `client/src/App.jsx`             | Shared layout, routes and health status.                                                |
| `pages/Dashboard.jsx`            | `useEffect`, asynchronous fetching, live demo metrics and saved summaries.              |
| `pages/Planner.jsx`              | Controlled state, derived totals, API actions and invalidating stale results.           |
| `pages/Vehicles.jsx`             | Reusable configuration presets and a normal HTML form.                                  |
| `pages/Guide.jsx`                | User-facing explanation of product assumptions.                                         |
| `components/VehicleForm.jsx`     | Shared controlled form: the parent owns its value.                                      |
| `components/PackageModal.jsx`    | Local form state, native validation, duplicate IDs and submitting a normalized package. |
| `components/Modal.jsx`           | Native dialog behavior and focus restoration.                                           |
| `components/UnloadingPanel.jsx`  | Rendering server simulation state and invoking parent actions.                          |
| `components/Instructions.jsx`    | Reverse unloading order and a print-specific view.                                      |
| `components/CargoViewer.jsx`     | Mesh geometry, event propagation, camera controls, error boundary and frame animation.  |
| `components/CargoLabel.jsx`      | Canvas-texture labels that stay in the Three scene without DOM overlay lifecycles.      |
| `components/Icon.jsx`            | A small SVG component instead of an entire icon dependency.                             |
| `services/api.js`                | Fetch, non-2xx errors, FormData and downloadable blobs.                                 |
| `data/demo.js`                   | A known input fixture and consistent delivery-stop colors.                              |
| `server/src/index.js`            | Reading environment values, connecting storage and starting HTTP.                       |
| `server/src/app.js`              | REST routing, Multer, request limits and error middleware.                              |
| `server/src/utils/validation.js` | Boundary validation: convert valid numbers/booleans and reject bad input.               |
| `server/src/utils/csv.js`        | Reliable CSV parsing, row errors, quoting and export.                                   |
| `server/src/store.js`            | A small repository boundary with interchangeable MongoDB and memory implementations.    |
| `server/src/models/index.js`     | Mongoose schemas, embedded documents, validation and timestamps.                        |
| `server/src/optimizer/`          | Pure domain functions and the actual packing algorithm.                                 |
| `server/test/`                   | Tests of invariants and real HTTP requests; optional database reconnection test.        |
| `client/src/styles.css`          | Design system, responsive breakpoints and print rules.                                  |

## Follow one package from CSV to 3D

Use sample row `DP-004` (Ceramic collection):

1. The browser opens a file picker and posts a `FormData` field named `file`.
2. Multer provides a bounded in-memory Buffer. The CSV parser handles commas/quotes and produces strings keyed by headers.
3. `parsePackage` converts numeric fields, validates positive dimensions/weight/stop and parses handling flags. It preserves the unique ID.
4. The client appends the valid object and clears previous optimizer/simulator results. Errors from other rows are shown alongside the successful import.
5. Clicking Optimize posts the entire plan. `parsePlan` validates again, including vehicle dimensions and duplicate IDs across all packages. Frontend checks alone are never enough because an HTTP client can bypass the UI.
6. The engine generates upright orientations. At each candidate it checks collision, support, payload, doorway and delivery dependencies. `DP-004` cannot become a support because it is fragile/no-stack.
7. The best complete strategy returns the box's min corner `(x,y,z)`, oriented length/width/height and rotation. It also returns metrics, unplaced reasons and unloading order.
8. `setResult` makes React pass those objects into `CargoViewer`. `CargoBox` converts one object to a Three mesh. Package selection uses the same ID to look up details.
9. Completing a delivery stop calls `/api/simulate`. The API recomputes and returns ordered IDs, so the client animates the correct box out through −X.
10. Save stores a validated vehicle/cargo snapshot and its server-computed result. Reopen reads those same values from MongoDB (or the current memory session).

## Important engineering choices to explain

- **Pure engine**: testing geometry does not need HTTP, React or a running database.
- **Constraints before scoring**: no weight or score can justify an overlapping or inaccessible placement.
- **Multiple greedy passes**: easy to understand and deterministic, with better results than one ordering but no optimum guarantee.
- **Support dependencies during unloading**: collision-free motion alone would let a lower box leave while a top box floats.
- **Conservative door corridor**: checking only a box's width/height would not guarantee passage at its actual Y/Z position.
- **Snapshot persistence**: a saved plan must not change when someone picks a different vehicle preset.
- **Result invalidation**: keeping an old result after editing input would mislead the operator.
- **Bounded work**: 100 packages limit memory and computation; worker threads would be needed for concurrent large jobs.
- **Stateless simulator**: recomputation keeps validity on the backend and avoids session complexity, at the cost of repeated computation.

## Suggested study order and exercises

1. Learn controlled inputs and state using `PackageModal`. Add an optional notes field through the UI and schema.
2. Learn request/response flow from `api.js` and `app.js`; inspect one successful and one invalid request in Network.
3. Run the Node tests. Change a test box so that it just touches another, then so it overlaps by 1 cm.
4. Read the algorithm document and draw the three new extreme points on paper.
5. Trace a two-stop obstruction and a two-box stack through `accessibleOrder`.
6. Read persistence, enable MongoDB and restart the API to prove that the saved load survives.
7. Read the viewer's coordinate mapping. Make a one-package CSV and predict the center before running it.
8. Try a new deterministic ordering strategy and compare placed counts on fixed fixtures. Keep all constraint tests passing.

## Interview questions to practice

- Why is 3D packing difficult, and what does this heuristic guarantee?
- How do extreme points reduce the search space? What feasible positions might they miss?
- Why does contact at an edge not count as collision or support?
- When is summing support areas safe? Why would overlapping support boxes be a bug?
- Why does width/height clearance alone not prove passage through a centered door?
- What happens if a stop-2 package is on top of a stop-1 package?
- How does the unloading walk handle same-stop blockers and support dependencies?
- Why can a greedy strategy leave cargo unplaced even when it could fit?
- Which scoring terms change placement and which are constant for a particular box?
- Why validate on both frontend and backend? What does Mongoose validation add?
- Why embed packages and a vehicle snapshot in the plan?
- What causes stale optimizer results in a React app, and how is that prevented here?
- How would you support 10,000 packages or concurrent operators without blocking Node?
- How would you test geometry beyond a handful of example arrangements?
- Which safety/physics assumptions are intentionally outside this project's scope?

Be candid: this implementation has deterministic, independently checked feasibility and useful delivery behavior. It is not an industrial physical loading certification or an exact optimizer.
