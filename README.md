# Thirst Trail: The Last Well

**Thirst Trail** is a polished, browser-based 3D adventure game inspired by charity: water. Explore Greenwater Valley, listen to the village, collect repair supplies, and restore a broken pump while learning why water sources need testing and maintenance.

## Features

- Genuine Three.js/WebGL 3D exploration with terrain, 3D buildings, a modeled explorer, lighting, shadows, camera follow, and click-to-walk
- Stylized 3D environment with a river, bridge, detailed cottages, cedar trees, mission markers, riverside reeds, village market, garden and campsite
- Living scenery: shimmering river highlights, butterflies, villagers who greet nearby travelers, animated spring water and a pump that visibly flows after repair
- Energy management, sprinting, obstacles, rest stops, impact scoring, and a timed expedition
- Story quests, water-safety quizzes, a bonus spring route, and progressive mission feedback
- Start, pause, resume, restart, replay, win, and out-of-energy flows
- Responsive keyboard, pointer, and touch controls with visible focus states
- Premium landing scene and polished HUD, mission panels, modal challenges, pause flow, and reduced-motion support
- Optional first-run tutorial, mute control, reduced-motion support, and local high-score storage

## How to play

Open `index.html` in a modern browser, or serve the folder with any static file server. Use **WASD** or **arrow keys** to move, **E** or **Space** to interact, **Shift** to sprint, **P** to pause, and the **mouse wheel** to zoom the 3D camera. On mobile, use the directional controls. Meet the elder, gather the toolkit and gasket, then complete the pump repair challenge before your energy runs out.

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
