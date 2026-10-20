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
