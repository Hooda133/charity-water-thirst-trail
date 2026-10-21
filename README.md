# Thirst Trail: The Last Well

**Thirst Trail** is a polished, browser-based 3D adventure game inspired by charity: water. Explore Greenwater Valley, listen to the village, collect repair supplies, and restore a broken pump while learning why water sources need testing and maintenance.

## Features

- Genuine Three.js/WebGL 3D exploration with terrain, 3D buildings, a modeled explorer, lighting, shadows, camera follow, and click-to-walk
- **Original glTF village art pipeline:** four distinct, externally loadable 3D building models with detailed roofs, porches, windows, masonry, flower boxes, and workshop furnishings
- **New animated explorer model:** original 5,928-triangle glTF character with articulated legs, arms, elbows, head and blinking eyes, textured-color gear, boots and backpack; safely falls back to the original procedural explorer if loading fails
- Character details, asset provenance, and rig names in [assets/characters/README.md](assets/characters/README.md); validate with `node tools/validate-explorer.mjs`
- **Safe asset swapping:** 3D asset pack is loaded asynchronously with GLTFLoader; built-in cottages stay in place if CDN access or model loading fails
- Asset provenance and instructions in [assets/village/README.md](assets/village/README.md); validate with `node tools/validate-village.mjs`; automatic GitHub Action checks assets on updates
- Showcase visual pass: layered alpine backdrop, vertex-colored valley terrain, densely scattered instanced meadow flowers, and a translucent animated waterfall
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
- Hands-on 3×3 rotating pipeline puzzle before the original pump safety questions
- Optional Raincatch Ridge destination with a 3D collection station, roof gutter, covered tank and interactive collection-planning activity (+220 impact points)
- Animated articulated explorer (walking, greeting, and celebratory poses), cinematic quest rewards with 3D sparkles, and a distinctive victory presentation
- Reduced-motion support for the newer environment and achievement animations
- Saved graphics profiles: Low, Medium, High and Ultra presets with live resolution, shadow, effects and camera-sensitivity controls
- Cinematic lighting and water pass: time-of-day sky grading, balanced key/fill/rim lights, landmark contact shadows, animated shader-driven river highlights, water-edge glints, and tuned lantern/window/campfire illumination
- Modern third-person camera pass: eased zoom targets, terrain-aware follow framing, orbit/pan boundaries, practical ground clearance, smooth recentering, and drag-safe click-to-walk gestures
- Final presentation pass: loading-state transition, clearer mission/HUD hierarchy, polished inventory and quest states, and quality presets that tune resolution, shadow cost, atmospheric density and exposure
- Energy management, sprinting, obstacles, rest stops, impact scoring, and a timed expedition
- Story quests, water-safety quizzes, a bonus spring route, and progressive mission feedback
- Start, pause, resume, restart, replay, win, and out-of-energy flows
- Responsive keyboard, pointer, and touch controls with visible focus states
- Premium landing scene and polished HUD, mission panels, modal challenges, pause flow, and reduced-motion support
- Optional first-run tutorial, mute control, reduced-motion support, and local high-score storage

## How to play

Open `index.html` in a modern browser, or serve the folder with any static file server. Use **WASD** or **arrow keys** to move, **E** or **Space** to interact, **Shift** to sprint, **P** to pause, and the **mouse wheel** to zoom. In the 3D world, click once to walk, left-drag to pan the camera without moving the explorer, right-drag to orbit around the landscape, and press **C** to return the camera to the explorer. The camera stays where you explore until you recenter it. Open the gear button for saved Low, Medium, High or Ultra rendering profiles; resolution scale, shadows, effects and camera sensitivity apply immediately. Use **M** to hide or show the mini-map, and **V** to toggle the scenic camera. The mini-map also lets you click destination markers to plan a route. On mobile, use the directional controls. Meet the elder, gather the toolkit and gasket, rotate the 3×3 pipeline sections until water can flow from the left inlet to the right outlet, then complete the final water-safety questions. Optionally travel to Raincatch Ridge for a rainwater collection challenge or visit Wetland Sanctuary to remove litter while protecting nests and plants. Look for four sealed drinking-water caches to restore energy. Water collected from roofs still requires testing and appropriate treatment before drinking.

## Run locally

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000` in your browser. No build step, backend, API key, or package installation is required. Internet access is required to load Three.js from a CDN. If the 3D library is unavailable, the original 2D Canvas game remains playable.

## Technologies

HTML5, CSS3, JavaScript, Three.js/WebGL (loaded from a CDN), a fallback Canvas 2D renderer, Web Audio API, and localStorage. The 3D environment is constructed from procedural geometry and materials, with no separate model downloads. For compatibility with GitHub Codespaces Live Preview, the 3D renderer is embedded in `script.js` rather than loaded from a separate local JavaScript module.

This is an independent educational game inspired by charity: water, not an official charity: water product. Water-safety scenarios are simplified for gameplay and are not real-world drinking-water guidance.

## Troubleshooting 3D preview

The Three.js engine needs access to a public CDN. If the original 2D artwork appears, open the browser Console (F12) and look for a 3D loading warning. Serve the project over HTTP using `python3 -m http.server 8000` and open port 8000 from the Codespaces **Ports** tab rather than relying on Live Preview when it returns 401. The 2D game is an intentional fallback.

See [TESTING.md](TESTING.md) for gameplay and browser verification steps.
