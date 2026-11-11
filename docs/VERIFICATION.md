# Verification record

Verified on 9 November 2026 with Node 24.14.0 and npm 11.9.0.

## Automated checks

- **24 / 24 tests passed, no failures or skips** when run with a temporary MongoDB 8.0.16 instance and `DOCKPLAN_TEST_MONGODB_URI` supplied to the Node test runner.
- The normal `npm test` requires no database; it runs 23 tests and skips the optional MongoDB reconnection test when no test URI is set.
- **`npm run build` passed**, with the Three.js viewer in a separate lazy-loaded chunk.
- Dependency audits for root, server and client reported zero known vulnerabilities after updating Multer and `csv-parse`.
- The 100-package synthetic fixture placed all 100, passed the final constraint audit, and took approximately 1.8 seconds on this machine. This is one bounded fixture, not a performance guarantee.

The tests cover empty input, fitting and oversize boxes, orientation rules, payload, no overlap, door clearance/corridor, fragile/no-stack, insufficient support, conservative stacking-load limits, later-stop blocking, same-stop/support sequencing, every prefix of unloading, deterministic output, input immutability, malformed data and varied dimension fixtures.

HTTP tests start a real ephemeral Express server and exercise plan create/read/update/delete, optimization, simulation, placement export, malformed JSON, duplicate IDs, missing files and an actual multipart CSV upload. Invalid CSV rows and malformed CSV records are tested directly.

The MongoDB test creates a vehicle and optimized plan, disconnects, reconnects, checks saved package positions and constraint results, lists records, updates the plan and cleans up its records. An additional 16-package demo persistence check verified the same flow against the real MongoDB binary. The temporary verification harness and MongoDB binary were kept outside the repository; MongoDB-memory-server is not an application dependency.

## Browser checks

The app was exercised in the in-app browser at desktop (1440 × 1000) and mobile (390 × 844) breakpoints. Mobile document width matched viewport width; the wide manifest scrolls within its own container.

Verified interactions:

1. Open demo, see 16 real placements and computed utilization values.
2. Start simulation; complete stop 1; see 4 unloaded and 12 remaining; reset.
3. Add a package manually and verify the manifest, totals and result invalidation.
4. Import the full sample CSV into a new plan; optimize all 16 packages.
5. Download the resulting CSV through the browser.
6. Save and reopen a plan; see it listed on the overview.
7. Select a package, inspect its rotated dimensions and position, hide it and show it again.
8. Toggle package labels and stop coloring.
9. Open loading instructions with reverse unloading order and coordinate/rotation columns.
10. Open the production app directly at `/plans/demo` on port 4000, confirming SPA route fallback and API integration.

After replacing DOM-overlay labels with Three.js canvas-texture sprites, production navigation between overview and planner produced no browser console errors or warnings during the final check. This avoids nested DOM-root lifecycle problems during 3D scene teardown.

Screenshots in `docs/screenshots/` were captured from actual rendered optimizer output. Browser printing is available; a generated PDF file is not committed. WebGL fallback is implemented, but a WebGL-disabled browser was not part of this verification.

## Practical limits

No multi-user load, authentication, physical handling, crash recovery or distributed database testing was performed. In-memory mode is intentionally temporary. Geometry is a conservative upright-box, centered-door, straight-extraction model; the algorithm is a heuristic. See `ALGORITHM.md` for its full assumptions and complexity.
