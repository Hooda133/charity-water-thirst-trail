# Thirst Trail — Browser QA Checklist

This project is a static HTML/CSS/JavaScript game. Run it from a local HTTP server (for example `python3 -m http.server 8000`) and open the site in Chrome or Edge. Open DevTools → Console to spot JavaScript and WebGL errors.

## Phase 1 — Graphics
- [ ] Start page shows a real 3D valley (not the fallback 2D illustration).
- [ ] Start Adventure transitions into the 3D game without a blank screen.
- [ ] The hillside waterworks shows a moving waterwheel, reservoir, terraces and orchard.
- [ ] Walking near the spring and the ridge does not hide the player behind oversized foreground clouds.
- [ ] WASD, arrow keys, clicking destinations, mouse wheel zoom, pause and restart still work.

## Free camera exploration (both chapters)
- [ ] Hold left mouse button and drag the 3D world: camera pans while the explorer stays at the same coordinates.
- [ ] Release and drag again: the camera can inspect the opposite edges of the world.
- [ ] A short click still issues click-to-walk, but releasing a drag does **not** start a walk.
- [ ] WASD and mission selection still move the player when the camera is panned.
- [ ] Press **C** or choose **⌖ RECENTER** to restore a character-centered view.
- [ ] Canyon mouse-wheel zoom works without changing the player's position.
- [ ] After a save/reload, both chapters remain playable and progress is preserved.
- [ ] If Three.js is offline, the 2D fallback still supports the existing movement and quests.

## Phase 2 — Repair
- [ ] Talk to the elder, collect the toolkit and gasket, and travel to the pump.
- [ ] The repair opens a **3×3 rotate-the-pipes** board rather than immediately opening the old quiz.
- [ ] Pipe tiles rotate by clicking or keyboard Enter/Space.
- [ ] Testing a disconnected line provides feedback and costs 2 energy.
- [ ] A connected line from middle-left inlet to middle-right outlet advances to the original three safety questions.
- [ ] Finishing the safety questions restores the pump and opens the victory screen.
- [ ] Restarting clears the previous puzzle, score, inventory and achievement overlays.

## Phase 3 — New destination
- [ ] **Raincatch Ridge** appears among map destinations and the sidebar buttons.
- [ ] Selecting Ridge from the map creates a route that crosses the bridge when needed.
- [ ] The 3D ridge includes a covered rain tank, roof catchment, gutters and weather vane.
- [ ] The collection activity opens three selectable precautions.
- [ ] An incomplete collection plan provides feedback and costs 2 energy.
- [ ] Completing all precautions earns 220 impact points and Raincatch Notes.
- [ ] Returning to the Ridge shows the completed-study dialog without granting duplicate points.

## Accessibility and performance
- [ ] Keyboard Tab can reach and activate puzzle controls; focus indicators are visible.
- [ ] On smaller screens the dialogs scroll and puzzle tiles remain usable.
- [ ] Reduced-motion system settings suppress decorative movement where supported.
- [ ] The game has no repeating Console exceptions during play.
- [ ] If the Three.js CDN is blocked, the fallback 2D version remains playable.

## Verification status
Source syntax, mocked startup, game-state, pipeline, navigation, and 3D scene-construction checks were run during development. **A real browser/WebGL, touch-device, frame-rate, and end-to-end visual test remains required.**

The gameplay simulates water-access challenges for education and entertainment. It is not drinking-water safety guidance.


## Second upgrade cycle — graphics, pickups and sanctuary
- [ ] During an expedition, the daypart badge changes from morning through golden hour, starlight and dawn (one full cycle takes eight minutes).
- [ ] Stars and fireflies appear after sunset; village lanterns illuminate nearby areas; movement and quests remain playable at night.
- [ ] Four sealed-water pickups are visible in the 3D world and as small cyan markers on the mini-map.
- [ ] Approaching a pickup awards 25 impact points and restores up to 12 energy, once per cache.
- [ ] Replay resets all pickups; they can be collected in the next expedition.
- [ ] Wetland Sanctuary appears in destination buttons, on the mini-map and in the 3D valley.
- [ ] Its boardwalk, lily pads, reeds and wading bird render without covering the player or blocking controls.
- [ ] Selecting the bird nest or seedlings in the cleanup activity costs three energy and doesn't count as litter collected.
- [ ] Selecting the four litter items, then finishing the activity, earns 180 impact points and a habitat badge.
- [ ] Re-visiting the sanctuary shows the completed-study dialog, with no duplicate reward.
- [ ] The original pipe puzzle, Raincatch Ridge plan and pump finale still work.

Automated-integration simulation checks run in the development connection cover logic, navigation and mock 3D scene rendering. The visual effects still require a real browser/WebGL test, especially performance and touch layouts.


## Showcase visual pass (October 20)
- [ ] Initial page: the cinematic 3D scene gently drifts, the mountain skyline frames the background, the mission plaque is readable, and the upper-left world label remains visible
- [ ] In-game terrain displays natural meadow variation and clusters of wildflowers (not a completely uniform grass slab)
- [ ] The hillside waterworks has an animated translucent waterfall and mist; the flow does not cover the controls or player
- [ ] The sky shows a visible sun with warm rings in daylight and a visible moon under starlight
- [ ] **SCENIC VIEW** button and **V** key switch between a whole-valley overview and following the player
- [ ] In the 2D fallback, Scenic View shows the whole 2D map and click-to-walk coordinates remain correct
- [ ] Restart resets Scenic View to player follow mode, with the button label and aria-pressed state updated
- [ ] On mobile: world header controls do not overflow, hero overlays fit, and both camera modes work without layout shifts
- [ ] Reduced-motion preferences stop the flyover and other decorative camera movements
- [ ] Framerate stays acceptable on an integrated-graphics laptop and there are no WebGL or console errors
- [ ] The authored explorer glTF appears with face, hat, jacket, pack, scarf, flask, gloves, trousers and boots
- [ ] Explorer idle, walk, sprint, turn, greeting and victory poses blend without visible snapping
- [ ] Explorer remains readable at the normal third-person follow distance in daylight and night
- [ ] River shader movement, edge glints, waterfall strips, mist, pump flow and spring ripples render without shader errors
- [ ] Dawn, golden hour, daylight, night, lanterns, windows and campfire remain balanced rather than overexposed
- [ ] Contact-shadow accents sit beneath cottages, camp and pump without z-fighting or blocking navigation
- [ ] Short left click walks, while left drag pans without walking and right drag orbits without triggering navigation
- [ ] Wheel zoom eases smoothly; C recenters on the explorer; the camera remains above terrain during orbit and follow
- [ ] WASD/sprint movement, turn blending, scenic view, missions and click-to-walk remain functional after camera changes
- [ ] Valley trees show forked trunks and layered canopies; understory shrubs and trail cobbles do not block routes
- [ ] Workshop, supply depot, village square, campsite, bridge and pump remain recognizable at their existing mission coordinates
- [ ] The timber bridge deck, rope rails, posts and stone footings render at the existing river crossing without blocking click-to-walk or WASD navigation
- [ ] Graphics gear menu applies Low, Medium, High and Ultra presets without restarting
- [ ] Loading overlay appears while the 3D renderer is preparing and disappears after either WebGL or the Canvas fallback is ready
- [ ] Low/Medium/High/Ultra visibly change renderer resolution, shadow-map budget, atmospheric density and exposure while preserving gameplay
- [ ] HUD, quest cards, inventory, mission markers, dialogue, pause and victory presentation remain readable at desktop and narrow viewport widths
- [ ] Resolution scale, dynamic shadows, effects and camera sensitivity persist after refresh

Testing caveat: Source, mocked 3D construction and gameplay checks are useful but do not replace a real browser GPU/WebGL rendering test.


## Playable art-direction rebuild (October 20)
- [ ] On starting, verify cottages have pitched gabled roofs, timber details, textured terracotta shingles, amber windows and visible chimney smoke
- [ ] Ground and paths have subtle texture; river shores have textured stones; tree canopies show faceted leaf glints
- [ ] Scenic View has warm sunlit color grading without blowing out terrain or losing the sky
- [ ] Shadows and buildings remain visible at dawn, night, and during victory
- [ ] No shader compile errors or broken mesh normals on roof sides and triangles
- [ ] Reduced Motion setting leaves chimney smoke stationary rather than animated
- [ ] Check a laptop's actual frame rate: the flower, leaf, and river-rock details use instancing but shader and texture performance must be validated on hardware
- [ ] Run the pipe repair, Raincatch Ridge and Wetland Sanctuary activities end-to-end to confirm unchanged gameplay

The previously generated premium screenshots are **visual direction references**, not screenshots from the game. This rebuild improves the real in-browser rendering; a matching high-fidelity environment would require a dedicated authored-asset pipeline, meshes, materials, and visual validation on a GPU.


## Screenshot-driven valley cleanup
- [ ] Alpine peaks stay in the far background instead of crowding the top of the playable frame
- [ ] Village buildings and marker labels remain readable despite foreground trees
- [ ] Chimney smoke is soft and translucent, not opaque round white bubbles
- [ ] The river remains teal across sunlit views without a white reflective wedge
- [ ] Distant birds appear as pale small silhouettes instead of black foreground triangles
- [ ] Riverbanks look irregular and natural, without dense rows of boulders
- [ ] After stepping onto the middle of the bridge, select Village Elder and verify auto-walk moves to the **left** bank
- [ ] Repeat from the bridge center to Supply Depot and verify auto-walk moves to the **right** bank
- [ ] Confirm older tasks, pipe challenge, Raincatch Ridge and Wetland Sanctuary still work

Actual visual rendering and performance must be verified in a browser using WebGL.


## Original glTF village asset upgrade (October 21)
- [ ] In the repository root, run `node tools/validate-village.mjs` and expect all checks to pass
- [ ] Open the site through Codespaces Live Preview / a local HTTP server; the browser must not use `file://`
- [ ] In browser DevTools → Console, look for `Thirst Trail: loaded 4 original glTF village models.`
- [ ] Confirm the elder house, upper cottage, lower cottage and workshop have richer authored geometry, with readable entry steps, roof tiles, window framing and distinct decorative details
- [ ] Confirm there are **not two overlapping cottages** at the same locations
- [ ] With the model URL unavailable (DevTools Network request blocking), the original procedural cottages remain visible and gameplay does not crash
- [ ] Switch to Scenic View and back, start and restart expeditions, travel to the workshop and collect the toolkit
- [ ] Inspect Chrome DevTools console for GLTFLoader warnings, 404s, cross-origin module failures or WebGL errors
- [ ] Check lighting at dawn and at night; warm windows should remain visible
- [ ] Verify frame rate and memory on an integrated-graphics laptop; consider simplifying assets or moving assets to GLB + compressed textures later

**Validation scope:** the repository includes static glTF and source checks and a mocked asynchronous loader/fallback test was exercised during integration. These tests are not a substitute for real GPU/WebGL screenshot testing.


## Original articulated explorer (October 21)
- [ ] Run `node tools/validate-explorer.mjs` from the Codespaces repository root
- [ ] Check DevTools Console for `Thirst Trail: loaded original animated explorer model.`
- [ ] Verify there is one explorer (no overlapping procedural model and loaded character)
- [ ] Move with WASD, click-to-walk, and bridge auto-navigation; legs, elbows and backpack move naturally
- [ ] Zoom in to inspect the face, hat, jacket, compass, scarf, boots, and flask
- [ ] Stand near an NPC; explorer greets without freezing controls
- [ ] Finish a quest; explorer briefly raises arms. Confirm the victory pose and reset
- [ ] Try turning, stopping, reopening the game and restarting an expedition
- [ ] Enable reduced motion; decorative head movement, blink and idle bounce should stop
- [ ] Block the character model asset in DevTools Network: the original procedural explorer remains visible
- [ ] No errors, giant avatar, inverted feet, or sudden frame-rate drops in the live WebGL browser

The static CI validator checks glTF geometry and rig names but cannot certify actual visual quality or browser GPU performance.


## Explorer visual refinement
- [ ] Examine the explorer near the bridge in daylight: skin and hat read warmer and the face is clearer
- [ ] Verify the pack does not dominate the silhouette and the arms/legs appear less cylindrical
- [ ] Walk, stop, turn and walk again: transitions should ease without snapping
- [ ] Greet a villager and celebrate: both animation states still work
- [ ] Check the model at night; skin should remain visible without excessive glow
- [ ] The avatar should remain one character, never doubled
- [ ] If GLTFLoader is blocked, the procedural explorer must still appear
- [ ] Compare FPS and image quality to the previous version, especially on integrated graphics

Automated validation checks geometry and simulated animation state; actual WebGL shading still needs a browser visual check.


## October 21 — Environment graphics pass
- [ ] With the explorer standing on the bridge, confirm more defined morning shadows under roofs, trees, and railings
- [ ] The grass should show mixed natural meadow tones instead of a single uniform green
- [ ] Paths should have soft dusty shoulders, not one flat hard-edged ribbon
- [ ] River should show subtle flowing turquoise markings; verify animated texture is moving and not stretched
- [ ] Check shallow edges near both sides of the river (including where the bridge crosses)
- [ ] Trees should have varying leaf palettes; new low shrub clusters should not hide quest markers or block gameplay
- [ ] Navigate to the elder, workshop, and pump to confirm access and bridge routing
- [ ] Complete the pipe repair, Raincatch Ridge, and Wetland Sanctuary activities as regression checks
- [ ] Toggle Scenic View and examine performance in daytime and at night; compare to older backup if frame rate drops
- [ ] Check mobile and reduced-motion settings, especially for water movement
- [ ] If graphics are too busy or slower on your laptop, compare with `backup-before-environment-overhaul-2026-10-21`

These modifications passed JavaScript syntax and simulated 3D scene construction/render checks. The final GPU rendering, animations, and frame rate must still be verified in the actual browser.


## Pipeline repair dialog — responsive layout fix (October 21)
- [ ] On a wide desktop monitor, open the pump repair puzzle. The instructions and action buttons appear on the **left**, and the entire 3×3 board on the **right**.
- [ ] Confirm all nine numbered tiles, WATER IN/OUTLET labels, Test the flow, and Back to the valley are visible together without a giant vertical modal
- [ ] On a narrow browser / phone, the puzzle stacks vertically, tiles stay square, and the modal scrolls normally when the viewport is short
- [ ] After scrolling a dialog, opening the pipe puzzle starts at the top rather than halfway through
- [ ] Rotate all nine pipes to connect the outlet; selecting Test the flow proceeds to the safety quiz
- [ ] Verify ordinary NPC, rain, wetland, pause, and victory dialogs remain their original compact size
- [ ] Keyboard Tab / Enter can rotate pipes and activate Test the flow
- [ ] Resize browser with puzzle open (including 740px breakpoint) to ensure cards and labels don't overlap

The pipe challenge passed scripted gameplay and modal-class switching checks; real browser layout still needs a visual review.


## Full 9-tile pipeline logic fix (October 21)
- [ ] Confirm the board shows **two T-junctions** (three pipe arms each), **two end caps** (one arm each), plus bends and straight pipes
- [ ] Confirm the inlet enters the left side of middle-left tile (4), and the outlet exits the right side of middle-right tile (6)
- [ ] From the scrambled starting state, Test the flow costs two energy and does not pass
- [ ] Connect only the direct path to the outlet; the game **must reject** that partial solution if either capped branch is missing
- [ ] Align all pieces so water reaches all nine with no open joints; the board shows success and Test the flow proceeds to the safety quiz
- [ ] Switch between the pipe and normal NPC dialogs; only the pipe uses the wide layout
- [ ] Use keyboard Tab and Enter to rotate and test the tiles, including T-junction and capped pieces
- [ ] Confirm pipe piece rotations preserve the correct reciprocal connections and cannot leak off any exterior edge except the designated inlet/outlet

**Automated verification:** Run `node tools/test-pipes.mjs`. The script evaluates all 262,144 possible orientations of the actual game solver and expects exactly two complete leak-free solutions. The GitHub Actions validation workflow runs this test automatically.


## Thirst Trail 2.0 — Forgotten Canyon (October 21)
- [ ] Start with an empty browser profile. Chapter 2 should be locked; Chapter 1 remains playable.
- [ ] Finish Chapter 1 pump and safety quiz. Confirm Chapter 2 unlocks on victory and appears in the chapter selection screen.
- [ ] In Chapter 1, complete the first quest, return to chapter selection, and continue — inventory, location, score and quest progress should be restored.
- [ ] Launch Forgotten Canyon and inspect distinct red mesas, the river gorge, bridge, aqueduct, pressure-control tank and floating destination labels.
- [ ] Walk with WASD / arrows, click a destination button, cross the central bridge, and use E to interact. Ensure the gorge is impassable outside the bridge.
- [ ] Meet Surveyor Nia and collect the seal kit before pressure adjustments are allowed.
- [ ] At the valve station, rotate settings to **2 / 2 / 1** (69 kPa) and confirm pressure passes. Try an unsafe pressure first — it should cost 4 energy.
- [ ] At the aqueduct, try a repair out of order (rejected), then complete Anchor → Brace → Pipe → Seal.
- [ ] Leave Canyon after two repair stages, return through Chapter Select, and verify those stages resume from the checkpoint.
- [ ] At the cistern, pick the unsafe option first (penalty); select test/treatment/monitoring for the correct completion.
- [ ] Confirm all five objectives complete, Chapter 2 is marked finished, and replay remains possible.
- [ ] Disconnect the Three.js CDN: Canyon should remain playable via its Canvas 2D fallback.
- [ ] On mobile, try the on-screen movement controls, mission dialogs and chapter buttons.
- [ ] Confirm closing or switching chapters does not keep the Valley WebGL scene rendering in the background.

Run `node tools/test-chapters.mjs` for repeatable logic tests. GitHub Actions checks both levels, but live browser rendering and mobile performance must still be verified.

## Shared character upgrade — October 25, 2026

Backup: branch `backup/character-before-upgrade` at `fb4727f` (the original main HEAD).
Implementation is split into incremental commits on `codex/upgrade-shared-adventurer`.

Checks completed:

- All six existing Node regression scripts passed: chapter gates and saves, all Canyon puzzles and completion, Valley movement and click navigation, exhaustive pipe puzzle solving, legacy glTF validation, and Canyon scenery construction.
- `node tools/test-explorer-motion.mjs` uses actual pinned Three.js geometry, transforms and raycasting. It verifies walk/run/stop grounding over 480 frames, stationary world-space stance contact during straight travel, two-arm victory posing, torso-attached jug hierarchy, and obstruction fade/restore at Valley and Canyon scene scales. Offline alternative: pass a local `three.module.js` path.
- Chromium with software WebGL: both actual chapter scenes rendered, keyboard D moved the character, Valley elder and Canyon surveyor interaction dialogs opened, and both completion dialogs displayed. Completion was triggered through test-only browser source instrumentation, not by manually playing the entire expedition. Gameplay solution paths were checked by the existing regression scripts. No test hooks are shipped in production.
- Fixed errors discovered in real WebGL: sprite raycasting needs its camera; scaled Canyon visibility rays need world coordinates; two Canyon dust meshes were incorrectly passed as geometry; Canyon stopped rendering before the victory animation could play.
- Character budget: 106 meshes and 28,556 triangles, no new textures or network assets. Visibility queries are throttled to about 15 Hz and reuse ray/vector state. Original camera, controls, collision geometry, audio and storage schemas are retained.

Limits: browser tests used low graphics on a software GPU, so they establish functionality rather than a representative laptop FPS measurement. Human listening, touch-device checks and a full manual playthrough remain unverified. The animation uses a lightweight articulated procedural rig rather than motion capture; foot contact is exact on the flat local gait plane, with each chapter retaining its existing terrain-height rules (Canyon decorative relief can vary by a few centimeters). Running is used in Valley, where the existing Shift control supports it; Canyon retains its original walking speed and controls. Complete occluder meshes fade, so an instanced mesh may fade all of its instances together. The original 2D/legacy fallback remains available if WebGL or the shared module is unavailable.

### Yellow jug follow-up

The shared jug is now a recognizable beveled rectangular yellow water can with an open handle, cap and rear X ribs. It remains on the back under both shoulder straps; its named body mesh is `ExplorerWaterJug`. The existing real-Three.js test now verifies the yellow material and that the entire can stays behind the torso throughout walk/run/stop and victory poses. The refined character remains 106 meshes and is 28,384 triangles.
