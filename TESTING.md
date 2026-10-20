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
