# Thirst Trail — Browser QA Checklist

This project is a static HTML/CSS/JavaScript game. Run it from a local HTTP server (for example `python3 -m http.server 8000`) and open the site in Chrome or Edge. Open DevTools → Console to spot JavaScript and WebGL errors.

## Phase 1 — Graphics
- [ ] Start page shows a real 3D valley (not the fallback 2D illustration).
- [ ] Start Adventure transitions into the 3D game without a blank screen.
- [ ] The hillside waterworks shows a moving waterwheel, reservoir, terraces and orchard.
- [ ] Walking near the spring and the ridge does not hide the player behind oversized foreground clouds.
- [ ] WASD, arrow keys, clicking destinations, mouse wheel zoom, pause and restart still work.

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
