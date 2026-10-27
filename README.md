# Thirst Trail 2.0: The Last Well

**Thirst Trail** is a polished, browser-based 3D adventure game inspired by charity: water. Play two connected chapters: restore the Greenwater Valley pump, then unlock The Forgotten Canyon to rebalance pressure valves, rebuild an aqueduct, and inspect and unlock a cistern. Both chapters feature 3D exploration with a playable 2D fallback.

## Thirst Trail 2.0 — New chapters and progress

- **Chapter 1: Greenwater Valley** — the complete original adventure is retained, including NPCs, mission puzzles, 3D model packs, mini-map and environmental effects.
- **Village water celebration:** after solving the nine-piece pipeline and passing the safety checks, open the village water valve. A new communal fountain and channel fill with water, greenery returns, and villagers celebrate. Choose **Watch water reach the village** to see it, use **Celebrate with villagers** to cheer again, or continue to Chapter 2. Results can be reopened without repeating rewards; valve readiness saves across reloads. Both 3D and 2D scenes support the ending, including reduced motion.
- **Chapter 2: The Forgotten Canyon** — a separate red-rock 3D chapter with cliff mesas, a gorge and bridge, aqueduct, control station, cistern, desert foliage and floating destination signs.
- **Canyon visual rebuild:** textured, subtly undulating desert ground, sculpted stratified gorge walls, jagged layered mesas, blue-to-gold sky, enhanced aqueduct masonry, detailed valve station/cistern/shelter, drifting dust, moving turquoise water and instanced stones/scrub. Chapter 2 now loads the same animated original explorer glTF used by Chapter 1, with the existing procedural fallback. Art lives in `canyon-visuals.js`; gameplay coordinates, quest puzzles, 2D mode, and saves are unchanged.
- **Five playable canyon objectives:** Meet Surveyor Nia, recover the seal kit, calibrate three pressure valves, rebuild the aqueduct in four stages, and inspect and unlock the village cistern.
- **Final reservoir puzzle:** after the cistern safety inspection, use 5-litre and 3-litre measuring chambers to leave exactly **4 litres** in the larger chamber. Fill, pour between chambers, or return water to the supply; levels update visually, progress saves, and Nia offers an optional hint. Experimenting costs no energy. This measuring puzzle uses a different mechanic from Chapter 1’s pipe rotations. Open the release gate once the target is reached to trigger the ending.
- **A restored-water finale:** solving the reservoir lock and opening its gate releases clean water from the cistern into a stone channel and pool, with returning greenery, a celebratory explorer pose and a short chime that respects mute. The illustrated completion screen offers chapter selection, replay, or **Watch the water flow**; results remain available below the scene. Both 3D and 2D modes show the restoration, with a still presentation for reduced motion.
- **Interactive valve puzzle:** set three regulators to achieve **65–73 kPa**, keep the regulator open, and balance intake/return settings. Incorrect tests cost energy.
- **Aqueduct assembly puzzle:** place anchors, braces, pipes and sealing material in the right order; repair stages save automatically.
- **Chapter selection & unlocking:** finishing the Chapter 1 pump mission unlocks Chapter 2. The previous Valley victory screen offers direct access to Canyon.
- **Autosave and resume:** Valley and Canyon checkpoints, unlocks and completion status persist using versioned browser `localStorage`; saves are on this browser/device, not synced online. Original best-score storage is preserved.
- **Performance & accessibility:** the Valley renderer pauses when Canyon is visible; interactive keyboard and touch controls; 2D fallback if the 3D library is unavailable.

## Features

- Genuine Three.js/WebGL 3D exploration with terrain, 3D buildings, a modeled explorer, lighting, shadows, camera follow, and click-to-walk
- **Original glTF village art pipeline:** four distinct, externally loadable 3D building models with detailed roofs, porches, windows, masonry, flower boxes, and workshop furnishings
- **New animated explorer model:** original 5,928-triangle glTF character with articulated legs, arms, elbows, head and blinking eyes, textured-color gear, boots and backpack; safely falls back to the original procedural explorer if loading fails
- Character details, asset provenance, and rig names in [assets/characters/README.md](assets/characters/README.md); validate with `node tools/validate-explorer.mjs`
- **Safe asset swapping:** 3D asset pack is loaded asynchronously with GLTFLoader; built-in cottages stay in place if CDN access or model loading fails
- Asset provenance and instructions in [assets/village/README.md](assets/village/README.md); validate with `node tools/validate-village.mjs`; automatic GitHub Action checks assets on updates
- Showcase visual pass: layered alpine backdrop, vertex-colored valley terrain, densely scattered instanced meadow flowers, and a translucent animated waterfall
- **Environment graphics pass:** focused sunlight and soft shadows, layered meadow color variation, three-layer softened trails, a locally generated scrolling river texture with shallow-water edges, and 270 instanced woodland shrubs
- Quality-focused changes are applied to the **real playable scene**; original gameplay, GLTF character/village models and camera zoom are preserved
- Greenwater Valley environment rebuild: forked low-poly trees with layered canopies, instanced understory shrubs, stone-edged trails, a workshop frontage, detailed supply crates, and a stone pump apron
- Real in-engine art upgrades: procedural shingle, wood-grain, stone, plaster, footpath and grass textures generated locally at startup (no external asset requests)
- Screenshot-driven visual cleanup: quieter distant mountain silhouette, clearer village sightlines, feathered chimney smoke, matte teal water, fewer river rocks and small pale birds
- Bridge route fix: destinations reached from the bridge center now correctly choose the safe bank before leaving the crossing
- New pitched gable roofs, timber-framed cottages, amber windows, masonry chimneys and animated smoke
- Instanced riverbank boulders and faceted sunlit canopy accents, plus lower-exposure cinematic daylight
- Cinematic title flyover and illustrated sun/moon sky with golden daylight halos
- Scenic camera overview: select **SCENIC VIEW** or press **V** to switch from follow camera to the whole-valley panorama; works in both 3D and the 2D fallback
- Live interactive valley map with player location, quest destinations and walking routes; click a map marker to navigate or press M to collapse the map
- In-world golden waypoint beacons, gentle wind in the forest and birds flying above the valley
- Stylized 3D environment with a river, bridge, detailed cottages, cedar trees, mission markers, riverside reeds, village market, garden and campsite
- Living scenery: shimmering river highlights, butterflies, villagers who greet nearby travelers, animated spring water and a pump that visibly flows after repair
- Hillside waterworks with a moving waterwheel, stone terraces, reservoir and orchard
- Gradual morning-to-starlight lighting with glowing lanterns, fireflies, distant stars and dawn transitions
- Four discoverable sealed-water caches that restore up to 12 energy and award 25 impact points apiece
- Optional Wetland Sanctuary with a 3D boardwalk, lilies, reeds, wading bird and a habitat cleanup challenge
- Hands-on **nine-piece** pipeline puzzle before the original pump safety questions: water must reach the village through all nine sections, including two T-junctions and two leak-proof capped branches (the original five-piece shortcut was fixed)
- Exhaustive puzzle test in `tools/test-pipes.mjs` checks all **262,144 rotation combinations** and runs automatically in GitHub Actions
- Optional Raincatch Ridge destination with a 3D collection station, roof gutter, covered tank and interactive collection-planning activity (+220 impact points)
- Animated articulated explorer (walking, greeting, and celebratory poses), cinematic quest rewards with 3D sparkles, and a distinctive victory presentation
- Reduced-motion support for the newer environment and achievement animations
- Saved graphics profiles: Low, Medium, High and Ultra presets with live resolution, shadow, effects and camera-sensitivity controls
- Cinematic lighting and water pass: time-of-day sky grading, balanced key/fill/rim lights, landmark contact shadows, animated shader-driven river highlights, water-edge glints, and tuned lantern/window/campfire illumination
- Modern third-person camera pass: eased zoom targets, terrain-aware follow framing, orbit/pan boundaries, practical ground clearance, smooth recentering, and drag-safe click-to-walk gestures
- Final presentation pass: loading-state transition, clearer mission/HUD hierarchy, polished inventory and quest states, and quality presets that tune resolution, shadow cost, atmospheric density and exposure
- Greenwater Valley landmark pass: a fully modeled timber crossing with planks, rope rails, stone footings and contact shadow, integrated into the existing river route without changing gameplay collision
- Energy management, sprinting, obstacles, rest stops, impact scoring, and a timed expedition
- Story quests, water-safety quizzes, a bonus spring route, and progressive mission feedback
- Start, pause, resume, restart, replay, win, and out-of-energy flows
- Responsive keyboard, pointer, and touch controls with visible focus states
- Premium landing scene and polished HUD, mission panels, modal challenges, pause flow, and reduced-motion support
- Optional first-run tutorial, mute control, reduced-motion support, and local high-score storage

## Explore freely with the mouse

Both 3D chapters support **hold left mouse button and drag** to pan the camera across the world without moving the explorer. A short **click** still chooses a walking destination. Press **C** or click **⌖ RECENTER** to return the camera to your character. The mouse wheel zooms the 3D view. Dragging does **not** change your saved player location or quest progress. On devices where Three.js cannot load, the original playable 2D fallback remains available (free 3D camera panning requires WebGL).

## How to play

Run a local static web server (recommended because glTF models load over HTTP) and open `index.html`. Use **WASD** or **arrow keys** to move, **E** or **Space** to interact, **Shift** to sprint, **P** to pause, and the **mouse wheel** to zoom the 3D camera, and **M** to hide or show the mini-map, and **V** to toggle the scenic camera. The mini-map also lets you click destination markers to plan a route. On mobile, use the directional controls. In Chapter 1, meet the elder, gather the toolkit and gasket, rotate all nine pipeline sections to form a leak-free network, then complete the water-safety questions. Chapter 2 unlocks automatically; choose it from the new chapter selection panel. In Forgotten Canyon use WASD/arrows, E to interact, the fast-travel list, and P to pause. Optionally travel to Raincatch Ridge for a rainwater collection challenge or visit Wetland Sanctuary to remove litter while protecting nests and plants. Look for four sealed drinking-water caches to restore energy. Water collected from roofs still requires testing and appropriate treatment before drinking.

**Camera and graphics:** In 3D Valley, left-click to walk, left-drag to pan, right-drag to orbit, and press **C** to recenter. Use ⚙ for Low, Medium, High, and Ultra graphics settings.

## Run locally

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000` in your browser. No build step, backend, API key, or package installation is required. Internet access is required to load Three.js from a CDN. If the 3D library is unavailable, the original 2D Canvas game remains playable.

## Technologies

HTML5, CSS3, JavaScript, Three.js/WebGL (loaded from a CDN), a fallback Canvas 2D renderer, Web Audio API, and localStorage. The environments use procedural 3D geometry and the Valley additionally loads original local glTF models for the buildings and explorer. For compatibility with GitHub Codespaces Live Preview, the 3D renderer is embedded in `script.js` rather than loaded from a separate local JavaScript module.

This is an independent educational game inspired by charity: water, not an official charity: water product. Water-safety scenarios are simplified for gameplay and are not real-world drinking-water guidance.

## Troubleshooting 3D preview

The Three.js engine needs access to a public CDN. If the original 2D artwork appears, open the browser Console (F12) and look for a 3D loading warning. Serve the project over HTTP using `python3 -m http.server 8000` and open port 8000 from the Codespaces **Ports** tab rather than relying on Live Preview when it returns 401. The 2D game is an intentional fallback.

See [TESTING.md](TESTING.md) for gameplay and browser verification steps.


## Automated checks

Run from the repository root:

```bash
node tools/test-chapters.mjs
node tools/test-canyon-regressions.mjs
node tools/test-progression.mjs
node tools/test-pipes.mjs
node tools/test-valley-movement.mjs
node tools/test-canyon-visuals.mjs
node tools/test-explorer-motion.mjs
node tools/validate-village.mjs
node tools/validate-explorer.mjs
```

GitHub Actions runs these checks when gameplay source changes. The chapter integration test covers unlocking, autosaves, both canyon puzzles, wrong-answer penalties, final completion and checkpoint resume. **Actual WebGL visual appearance, sound and laptop frame rate still require testing in a browser.**

For the real-interface Chromium walkthrough, install the optional QA tools (`python -m pip install playwright==1.58.0`, then `python -m playwright install chromium`) and run `python tools/test-browser.py`. It deliberately blocks CDN loading to test the 2D fallback. `python tools/test-browser.py --3d` tests the actual WebGL scenes and requires access to the existing Three.js CDN, or exact r170 test modules supplied with `--offline-three DIRECTORY`. Use `--browser PATH` to select a system Chromium. These are test tools; the game itself still needs no installation or build.

See [GAMEPLAY_AUDIT.md](GAMEPLAY_AUDIT.md) for the October 26 repair report, executed checks and remaining manual-test limits. Canyon now has safe landmark approaches, bidirectional valve controls and recoverable construction checkpoints. Valley saves pipe/safety progress and offers **Recover at camp** after energy depletion while retaining completed work. Storage restrictions display an honest status and keep the current session playable.
