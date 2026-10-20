# Thirst Trail: The Last Well

**Thirst Trail** is a polished, dependency-free 2D adventure game inspired by charity: water. Explore Greenwater Valley, listen to the village, collect repair supplies, and restore a broken pump while learning why water sources need testing and maintenance.

## Features

- Canvas-based top-down exploration with click-to-walk navigation
- Energy management, sprinting, obstacles, rest stops, impact scoring, and a timed expedition
- Story quests, water-safety quizzes, a bonus spring route, and progressive mission feedback
- Start, pause, resume, restart, replay, win, and out-of-energy flows
- Responsive keyboard, pointer, and touch controls with visible focus states
- Optional first-run tutorial, mute control, reduced-motion support, and local high-score storage

## How to play

Open `index.html` in a modern browser, or serve the folder with any static file server. Use **WASD** or **arrow keys** to move, **E** or **Space** to interact, **Shift** to sprint, and **P** to pause. On mobile, use the directional controls. Meet the elder, gather the toolkit and gasket, then complete the pump repair challenge before your energy runs out.

## Run locally

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000` in your browser. No build step, backend, API key, or package installation is required.

## Technologies

HTML5, CSS3, JavaScript, Canvas 2D, Web Audio API, and localStorage.

This is an independent educational game inspired by charity: water, not an official charity: water product. Water-safety scenarios are simplified for gameplay and are not real-world drinking-water guidance.