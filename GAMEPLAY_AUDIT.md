# Gameplay repair and verification — October 26, 2026

Repository: `Hooda133/charity-water-thirst-trail`  
Baseline: `ad5f08c82962487b53fb3cc4cf39d4a404625123`  
Backup: `backup/pre-gameplay-audit-2026-10-26` (local and GitHub)  
Repair branch: `codex/gameplay-audit-2026-10-26`

The existing HTML/CSS/JavaScript, Three.js worlds, original assets, controls and 2D fallback were retained. No runtime dependencies, services or external art were added. The yellow water-jug explorer and Valley environment remain intact. This report records this pass's executed checks; older entries in TESTING.md describe earlier work.

## Significant bugs, causes and implemented repairs

| Problem | Root cause | Repair and regression coverage |
| --- | --- | --- |
| Optional Spring Survey bypassed the pump and unlocked Canyon | The optional quiz called the same `end(true)` as pump restoration | Spring is a saved, once-only bonus. Pump restoration remains the Chapter 1 completion gate. Valley regressions check the gate and repeated interactions. |
| Canyon surveyor hidden inside a mesa | Seeded skyline geometry was allowed inside the playable floor; a mesa contained Nia's position | All 44 original mesas now remain outside the traversable floor. Geometry regression reproduces the seed and checks clearance. |
| Explorer entered tanks/buildings and routes could stop against structures | Collision covered river/gorge and bounds; destinations used solid landmark centers | Added core structure footprints, reachable interaction approaches and obstacle-detouring routes. Both bridges support navigation starting mid-crossing. Actual movement tests check all missions. |
| Aqueduct could restore at 4/4 without completing | Last repair stage saved before the completion flag and reward | Last stage completes atomically through the quest path; old interrupted 4/4 checkpoints are finalized once. |
| Final Canyon victory could disappear on reload | All five objectives saved before the final victory transition | Restoring all five completed goals runs the guarded finalization, clears the checkpoint and records completion. |
| Inconsistent inventory/flags could block progression | Related state was restored independently | Known Valley rewards reconcile both inventory and objective flags; Canyon normalizes prerequisites and completed puzzle state. |
| Closing/reloading reset pipe work or pump safety questions | Pipe rotations and safety step were absent from checkpoints | Save all nine rotations, validate a solved network and resume the relevant safety question. Tests exercise partial and solved reloads. |
| Repeated/obsolete UI callbacks could repeat rewards or penalties | Detached buttons retained callbacks for an earlier modal/state | Modal-generation guards reject stale callbacks; rewards are idempotent; completed Canyon repairs are locked. |
| Unchanged unsafe Canyon inputs repeatedly deducted energy | Attempts were not tracked | Persist failed valve configurations and the unsafe cistern response. Identical retries do not charge again; changed inputs receive actionable feedback. |
| Low-energy Canyon inputs could grant energy | `Math.max(7, energy-cost)` raised values already below 7 | Shared nonlethal spending never increases energy; restored checkpoints have a playable energy minimum. |
| Lethal Valley collection cost could overwrite game-over UI | Reward, deduction and close callbacks ran through after death | Deduct first, stop when ended, save surviving deductions and clear movement/effects correctly. |
| Low-energy checkpoints could force a full replay | Failure offered restart but no progress-preserving recovery | Failure-only Recover at camp restores 50 energy at a safe approach, keeps objectives/inventory/puzzle/score/time and saves immediately. Regression depletes energy through a real quiz callback, recovers, walks back and finishes the pump. |
| 2D fallback blocked by a loading overlay | Start re-enabled loading whenever no 3D renderer existed, including after import failure | Track pending loading separately from unavailable 3D. Real browser fallback walkthrough reaches both victories. |
| Storage restrictions could relock Canyon within the same session | Every access reparsed storage even after a write failed | Validated in-memory progress continues when persistence is unavailable; truthful save status, defensive copies, bounded JSON and backup recovery. |
| One corrupt save field could destroy good progress | Strict whole-root rejection and no independent backup | Salvage recognized v1/v2 fields; prefer intact recovery copies over damaged newer roots; preserve unsupported future formats without overwriting them. |
| Camera recenter jumped and cancelled gestures could walk | Recenter reset first-frame camera snapping; cancellation shared click release behavior | Ease recenter, check pointer identity and treat cancellation/capture loss separately. Camera callback and browser gesture regressions cover these paths. |
| Canyon map Space could cancel travel/open an interaction | Map keyboard activation bubbled to the global Space interaction shortcut | Consume handled Enter/Space in the map. |
| Scenery roads guided players into blocked gorge/tanks | Decorative trail coordinates did not follow playable paths | Realigned trails to bridge and safe approaches; sample rendered trail segments against live collision rules. |
| Dust changed with frame history | Animation accumulated offsets every draw | Derive particle placement from immutable origin and time; repeated-time and rewind tests match exactly. |

## Canyon completion and guidance

The route remains Nia → seal kit → pressure valves → aqueduct → cistern. Each prerequisite is enforced. All five objectives have reachable interaction locations, and finished stations cannot mutate the repaired system.

The original valve formula was already solvable: `16×intake + 13×regulator + 11×return`, settings 0–3, target 65–73 kPa, regulator open, intake/return within one setting. Exhaustive testing finds three valid combinations; `[2,2,1]` produces 69 kPa. Added decrease controls, explicit condition feedback and Nia's optional field note after repeated failed configurations.

Aqueduct feedback identifies the next step: anchor supports, brace the span, seat the pipe, apply the seal. Completed stages are disabled and saved. Wrong order keeps completed work. Both interrupted final construction and interrupted final inspection recover reliably.

Canyon uses the existing shared short action tones. It has no ambient soundtrack or continuous noise generator. The mute preference and reduced-motion paths are retained. Valve controls have visible focus states, descriptive accessible names and 44px decrease buttons.

## Files changed

- Runtime: `progression.js`, `script.js`, `canyon.js`, `canyon-visuals.js`, `canyon-map.js`, `canyon.css`.
- Regression tests: `tools/test-progression.mjs`, `tools/test-canyon-regressions.mjs`, `tools/test-valley-movement.mjs`, `tools/test-canyon-visuals.mjs`, `tools/test-browser.py`.
- Automation/documentation: `.github/workflows/village-assets.yml`, `.gitignore`, `README.md`, `TESTING.md`, this report.

## Executed automated verification

All nine Node suites passed on the repaired code:

| Command | Executed coverage |
| --- | --- |
| `node tools/test-chapters.mjs` | Five Canyon goals, chapter gates, 69 kPa controls, aqueduct order, quiz, reload/replay, malformed checkpoints. |
| `node tools/test-canyon-regressions.mjs` | All 64 valve configurations (3 solutions), gates, stale/duplicate callbacks, saved failure history, interrupted construction/victory, low energy, actual movement routes, bridge starts, solid footprints, sprint, mesa clearance. |
| `node tools/test-progression.mjs` | Fresh-runtime reloads, unlock/completion/replay, copy isolation, invalid/oversized/cyclic data, v1 migration, corrupt and parseably damaged primary recovery, storage denial and future formats. |
| `node tools/test-valley-movement.mjs` | Movement/input lifecycle, periodic saves, restarts/replays, nine routes, inventory reconciliation, Spring gate, real nine-piece controls and quizzes, puzzle checkpoint resume, lethal costs, camera release/cancellation. |
| `node tools/test-pipes.mjs` | All 262,144 rotation combinations; exactly two equivalent nine-piece solutions; no leaking or partial-route wins, correct T-junctions and capped branches. |
| `node tools/test-canyon-visuals.mjs` | Scene construction/disposal with a Three-compatible mock, rendered trail collision sampling, deterministic dust timing. This is not a GPU appearance test. |
| `node tools/validate-explorer.mjs` | Authored glTF character geometry, rig, binary/accessor validity and integration. |
| `node tools/validate-village.mjs` | All four original building models, geometry/accessors, loaders, syntax and UI references. |
| `node tools/test-explorer-motion.mjs work/three.module.mjs` | Actual Three.js transforms/raycasting, grounded walk/run/stop, victory pose, yellow jug placement, occlusion fade/restore at both scales, 19,602 bridge-ramp raycasts. |

`git diff --check` also passed. An independent route-only simulation exercised 169 directed Valley destination/cache pairs without a route failure; energy was stubbed only in that isolated geometry check.

The environment's shell proxy could not connect and Node direct CDN fetch could not resolve DNS. Exact pinned Three.js r170 and its two loader modules were obtained through the connected GitHub reader for local tests, stored under ignored `work/`, and served through test-only CDN interception. Production asset URLs and dependencies were not changed.

## Browser verification

Executed `python tools/test-browser.py` in Chromium with the CDN deliberately blocked. The actual interface completed Chapter 1 → Chapter 2 with keyboard movement, destination travel, nine pipe controls, wrong then correct safety answers, Valley and Canyon reloads, all five Canyon objectives, 69 kPa adjustment, wrong and correct aqueduct order, and final victory. No uncaught page errors. Public read-only snapshots assert results; the walkthrough does not mutate game state or invoke completion hooks.

Executed `python tools/test-browser.py --3d` with headless Chromium/SwiftShader, the exact pinned r170 runtime and the real unmodified game scripts. Both chapter WebGL canvases rendered, and the actual interface completed Chapter 1 → Chapter 2 through the final Canyon victory, including all puzzles and both reloads. Camera dragging, cancellation and recentering preserved the explorer's location; canvas click-to-walk moved the explorer. No uncaught page errors. The final cistern traversal still reported `renderer: "3d"`.

The fallback invocation also executed a 390×844 mobile smoke using native touch events: movement, release/cancel, Valley dialogue, Canyon pause/resume, no horizontal overflow and persisted mute. Muted interactions created zero AudioContexts. The reduced-motion media preference was active in the desktop and mobile runs. The mobile context reused chapter unlocks earned by the desktop walkthrough, deliberately used the 2D fallback and did not play both entire chapters.

Inspected screenshots from the actual 3D Valley, Canyon surveyor and final Canyon victory, plus mobile Valley dialogue and Canyon gameplay. The explorer and yellow jug are visible at Nia, the original Valley scene is retained, and the HUD/dialog controls are readable in those captures. Screenshots establish those views only; they do not prove every possible camera angle is free of occlusion.

The optional browser QA dependency is isolated from the shipped game. CI runs the nine Node checks and the offline fallback/mobile walkthrough. Hosted CI is not claimed to have passed until its own run completes.

## Remaining limits

- Software WebGL establishes rendering/functionality, not representative laptop FPS or GPU memory usage. No performance benchmark or improvement percentage is claimed.
- Physical iOS/Android devices, Safari/Firefox, high/ultra graphics, sustained sessions and human audio listening require manual checks.
- Collision now covers core structures and banks; small decorative vegetation/rocks remain non-solid. Terrain-height rules and whole-instanced-mesh obstruction fading retain the existing architecture.
- Progress is local to a browser. Storage denial permits session continuity but cannot survive refresh; live cross-tab conflict synchronization and cloud saves are not implemented.
- The first hosted run passed all Node checks. Browser setup exposed that `ubuntu-latest` had advanced to Ubuntu 26.04, unsupported by pinned Playwright 1.58's installer. The browser job now uses Ubuntu 24.04 and the runner image's preinstalled Chrome, avoiding redundant browser and OS-package downloads. Its hosted result is separate from the local checks above.
