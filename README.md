# Thirst Trail 3.3: The Last Well

**Thirst Trail** is a browser-based 3D adventure game inspired by charity: water. Restore Greenwater Valley, repair the Forgotten Canyon aqueduct, then rebuild Stormbreak Coast. Return to the restored village to deliver water, repair leaks and choose community improvements. All three chapters and Village Life have 3D environments with a playable 2D fallback.

## Visual refinement in progress — pull request #20

This branch continues the unfinished 3D graphics pass without changing mission routes, puzzles, checkpoints, progression, or stored saves. The Valley, Canyon, and Coast now connect to shared screen-space mission nameplates that display above scenery; earlier sprite labels remain available as a fallback. The Canyon also passes live graphics quality and effects settings into its scenery. Stormbreak Coast has quality-scaled instanced shoreline pebbles and grass, while Village Life's drinking-water station, shade shelter, and irrigation projects have more detailed 3D models. Run `node tools/test-world-labels.mjs` for label projection, state, responsive-layout, and cleanup checks.

These changes are under review; the branch needs automated checks and visual gameplay verification before merge into `main`.

The game uses locally hosted **Nunito Sans** to evoke charity: water's Proxima Nova/Avenir typography. One shared family spans headings, body copy, controls, chapter menus, footer links, map labels, and 3D nameplates, with weight and spacing providing hierarchy. The variable font loads without a font service, keeps text visible while loading, and includes a readable fallback stack. Source, build details, and the open font license are in [assets/fonts/README.md](assets/fonts/README.md).

## Thirst Trail 3.3 — Clickable supplies and visible DOM reactions

In Chapter 1, **Water for the trail** shows the four sealed-water supply drops beside the map. Click a nearby drop to collect it; a distant drop guides the explorer toward its cache. Collection removes the actual HTML button, inserts a named collected badge, and updates the counter, status, energy and impact. These are the existing expedition supplies: each can restore up to 12 energy and award 25 impact once per run. Walking over a cache still collects it automatically. Saved collections survive reload; replay restores the drops.

| Player action | DOM outcome |
| --- | --- |
| Click a nearby water drop or press Enter/Space | Remove its button and add a collected badge |
| Collect supplies | Change counter/status text; add a completion message after all four |
| Rotate a pipeline tile | Change its visible ports, rotation attribute, accessible label and action feedback |
| Pause or open Settings | Disable supply controls until play resumes |

Remaining supply buttons keep their identity as the game updates. Keyboard focus moves to the next available drop after collection and stays on a pipe tile after rotation. Reduced motion keeps the feedback still. The controls work with both 3D and fallback rendering, while the existing difficulty levels, chapters and Village Life remain available.

## Thirst Trail 3.2 — Difficulty in Settings

Open **⚙ Game settings → Difficulty** to choose Easy, Normal or Hard at any time. The chapter hub offers the same three choices. Changes apply across all three chapters and Village Life, save in this browser, and keep chapter progress, partial puzzles, carried water and village projects intact. Difficulty and graphics quality are independent.

| Difficulty | Energy and mistake penalties | Guidance | Canyon pressure | Village delivery |
| --- | --- | --- | --- | --- |
| Easy | Relaxed energy use, gentler penalties | Early hints | 65–73 kPa | 4 L |
| Normal | Standard energy use and penalties | Hints on request | 65–73 kPa | 4 L |
| Hard | Higher energy use, stronger penalties | Hints on request | 67–71 kPa | 6 L |

The jug holds 8 L on every difficulty. Hard therefore requires more refill trips. Rewards still fund every village project, and earned repairs and calibrations remain complete after switching levels. Existing Explorer preferences become Easy; Challenge preferences become Hard. New players retain the relaxed Easy default. Settings opens over a paused expedition or an already open puzzle; closing Settings leaves its progress in place.

Development continues on `codex/canyon-reservoir-celebration`, the user-approved version containing the graphics overhaul, all three chapters, Village Life and water celebrations.

## Thirst Trail 3.1 — A visual overhaul across all three chapters

- **Material detail:** locally hosted CC0 Poly Haven color, normal and roughness maps add surface detail to meadow, sandstone, stone and timber. Original explorer clothing has a subtle fabric weave; sky reflections bring out water and metal. Credits and licenses are in [assets/materials/LICENSE.md](assets/materials/LICENSE.md).
- **Distinct environments:** Valley gains wind-swept grass and textured village masonry; Canyon gains sculpted, capped mesas, detailed waterworks and a restored palm oasis; Coast gains irregular shorelines, shallow-water edges, palms, sea grass, pitched roofs and a detailed lighthouse.
- **Water and lighting:** shared animated ripple and caustic shaders, soft environment reflections and shadow tuning. High and Ultra add a restrained antialiasing/color-grade pass. Low and Medium use direct rendering with lighter decorative detail.
- **Presentation:** original chapter illustrations, consistent ivory/gold/teal menus, readable puzzles and celebrations, and quieter destination labels. Scenic views and finales restore solid building roofs for a clear panorama.
- **Quality controls:** High is the default for new players; existing saved preferences are respected. Use the gear menu to change presets, shadows, effects and resolution live in every chapter. Effects-off and reduced motion stop the new ambient animations while puzzle states keep updating.

## A living village and a new coast

- **Village Life:** unlocked after Chapter 1. Fill an 8-litre yellow jug at the fountain and carry 4-litre deliveries (6 litres on Hard) to Amina’s home, Leila’s school and Idris’s garden. The jug level changes in the activity panel and beside the explorer in 3D. Named neighbours respond to deliveries; flowers and greenery appear as the community recovers.
- **Hidden leaks:** follow wet trail patches and a proximity dripping cue. Inspect the fault, choose a clamp, gasket or torque key, then complete three repair actions. Repaired patches dry up and each first repair earns building materials.
- **Choose village upgrades:** spend earned materials on a second drinking-water station, garden irrigation or a shaded gathering place. All three appear in the world. First deliveries and repairs provide enough materials for every project; later delivery rounds do not repeat material rewards. Village progress saves independently of chapter replay.
- **Easy, Normal and Hard:** choose in Settings or on the chapter hub. Easy offers early puzzle guidance; Normal uses standard resources; Hard tightens pressure calibration and requires 6-litre deliveries. Hard also offers the optional Caretaker and Storm Scout badges. All levels keep hints and recovery available.
- **Chapter 3: Stormbreak Coast:** complete Chapter 2 to unlock a storm-damaged harbor with a lighthouse, cargo crossing, tank and coastal homes. Meet engineer Mara, solve a toggle-switch circuit, balance bridge counterweights, fit three tank repair layers and allocate flow with sluice sliders. Opening the release restores water and starts the harbor celebration.
- **Visible repair stages:** tested feed lines appear in the village, the pump gauge responds to pipeline repair, the Coast bridge lowers, storm debris clears, tank patches and water levels update, and final channels fill before greenery returns. Progress and partial puzzle work persist across reloads.
- **Existing saves:** completed older Canyon saves automatically unlock the Coast. Existing best scores, chapter checkpoints and completion badges are preserved; community projects have their own save field.

## Chapters and celebrations

- **Chapter 1: Greenwater Valley** — the complete original adventure is retained, including NPCs, mission puzzles, 3D model packs, mini-map and environmental effects.
- **Village water celebration:** after solving the nine-piece pipeline and passing the safety checks, open the village water valve. A new communal fountain and channel fill with water, greenery returns, and villagers celebrate. Choose **Watch water reach the village** to see it, use **Celebrate with villagers** to cheer again, or continue to Chapter 2. Results can be reopened without repeating rewards; valve readiness saves across reloads. Both 3D and 2D scenes support the ending, including reduced motion.
- **Chapter 2: The Forgotten Canyon** — a separate red-rock 3D chapter with cliff mesas, a gorge and bridge, aqueduct, control station, cistern, desert foliage and floating destination signs.
- **Canyon visual rebuild:** textured, subtly undulating desert ground, sculpted stratified gorge walls, jagged layered mesas, blue-to-gold sky, enhanced aqueduct masonry, detailed valve station/cistern/shelter, drifting dust, moving turquoise water and instanced stones/scrub. Chapter 2 now loads the same animated original explorer glTF used by Chapter 1, with the existing procedural fallback. Art lives in `canyon-visuals.js`; gameplay coordinates, quest puzzles, 2D mode, and saves are unchanged.
- **Five playable canyon objectives:** Meet Surveyor Nia, recover the seal kit, calibrate three pressure valves, rebuild the aqueduct in four stages, and inspect and unlock the village cistern.
- **Final reservoir puzzle:** after the cistern safety inspection, use 5-litre and 3-litre measuring chambers to leave exactly **4 litres** in the larger chamber. Fill, pour between chambers, or return water to the supply; levels update visually, progress saves, and Nia offers an optional hint. Experimenting costs no energy. This measuring puzzle uses a different mechanic from Chapter 1’s pipe rotations. Open the release gate once the target is reached to trigger the ending.
- **A restored-water finale:** solving the reservoir lock and opening its gate releases clean water from the cistern into a stone channel and pool, with returning greenery, a celebratory explorer pose and a short chime that respects mute. The illustrated completion screen offers chapter selection, replay, or **Watch the water flow**; results remain available below the scene. Both 3D and 2D modes show the restoration, with a still presentation for reduced motion.
- **Interactive valve puzzle:** set three regulators to achieve **65–73 kPa** (**67–71 kPa on Hard**), keep the regulator open, and balance intake/return settings. Incorrect tests cost energy.
- **Aqueduct assembly puzzle:** place anchors, braces, pipes and sealing material in the right order; repair stages save automatically.
- **Chapter selection & unlocking:** finishing the Chapter 1 pump mission unlocks Chapter 2. The previous Valley victory screen offers direct access to Canyon.
- **Autosave and resume:** Valley, Canyon, Coast and Village Life progress persist using versioned browser `localStorage`; saves are on this browser/device, not synced online. Original best-score storage is preserved.
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

**Camera and graphics:** In 3D Valley, left-click to walk, left-drag to pan, right-drag to orbit, and press **C** to recenter. Use ⚙ for Easy/Normal/Hard difficulty and Low/Medium/High/Ultra graphics quality.

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
node tools/test-expedition-mode.mjs
node tools/test-village-life.mjs
node tools/test-coast.mjs
```

GitHub Actions runs these checks when gameplay source changes. The chapter integration test covers unlocking, autosaves, both canyon puzzles, wrong-answer penalties, final completion and checkpoint resume. A small real-WebGL smoke check also compiles the shared water and postprocessing shaders, verifies PBR maps and nonblank output, and checks disposal. Sound and representative laptop frame rate still require manual testing.

For the real-interface Chromium walkthrough, install the optional QA tools (`python -m pip install playwright==1.58.0`, then `python -m playwright install chromium`) and run `python tools/test-browser.py`. It deliberately blocks CDN loading to test the 2D fallback. `python tools/test-browser.py --3d` tests the actual WebGL scenes and requires access to the existing Three.js CDN, or exact r170 test modules supplied with `--offline-three DIRECTORY`. Use `--browser PATH` to select a system Chromium. These are test tools; the game itself still needs no installation or build.

See [GAMEPLAY_AUDIT.md](GAMEPLAY_AUDIT.md) for the October 26 repair report, executed checks and remaining manual-test limits. Canyon now has safe landmark approaches, bidirectional valve controls and recoverable construction checkpoints. Valley saves pipe/safety progress and offers **Recover at camp** after energy depletion while retaining completed work. Storage restrictions display an honest status and keep the current session playable.

The expansion has its own real-interface check: `python tools/test-expansion-browser.py` exercises actual mode-dependent movement costs, three deliveries, all leak repairs, all projects, community reload, Coast puzzles, partial bridge reload, guarded water release, results and replay. Add `--mobile` for the same 390×844 walkthrough and native Coast touch cancellation. These checks use an earned old Chapter 1/2 completion fixture to test migration, then perform activities through player controls. Focused actual WebGL screenshots verify village projects and Coast restoration; software rendering does not establish representative laptop performance.

To inspect all three 3D environments and live graphics controls, run `python tools/test-graphics-browser.py --presets low,high --live-check --mobile`. It uses earned-completion fixtures to inspect restored chapter scenes, records screenshots and reports shader/asset errors; it does not establish hardware frame rate. Use `--smoke` for the small rendering check run by CI.

To load updates in an existing Codespace on the preview branch, run `git pull --ff-only origin codex/canyon-reservoir-celebration`, refresh the preview, and choose **High** or **Ultra** in the gear menu for the full visual treatment. Your saved graphics preferences and gameplay progress are preserved.

Difficulty has a dedicated real-interface regression: `python tools/test-difficulty-browser.py` checks the Settings selector, keyboard controls, reloads, actual movement costs, Hard jug deliveries and live chapter puzzle changes. Add `--mobile` for the 390×844 layout and touch viewport.

To verify real DOM reactions, run `python tools/test-dom-interactions-browser.py` and add `--mobile` for the 390×844 viewport. The test records DOM mutations, node identity, reward guards, reload/replay, keyboard actions and pipe rotation.
