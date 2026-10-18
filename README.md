# Thirst Trail: The Last Well 💧

**A playable 2D adventure game for a charity: water-inspired web development project.** Built in plain HTML, CSS, and JavaScript, without game engines, npm, server code, images to download, or third-party libraries.

## Play the game

- Visit the GitHub Pages website (after Pages is enabled), or open `index.html` directly in a modern web browser.
- Click **Start adventure**.
- Move your character with **W A S D** or the **arrow keys**. Use **E** or **Space** to interact with nearby glowing locations. Hold **Shift** to sprint (at a higher energy cost).
- You can also **click the map** to walk somewhere or **click a destination in the Expedition Log** to auto-walk there, including crossing the bridge.
- On touch devices, use the on-screen movement pad and **ACT** button.
- **P** pauses the game; the top toolbar includes Pause, Restart, help, and sound options.

## The main quest

1. **Village Elder:** Learn how the broken pump has affected the village.
2. **Workshop:** Collect a repair toolkit.
3. **Supply Depot:** Cross the river bridge and pick up a replacement gasket.
4. **Old Water Pump:** Solve a three-step repair and water-safety challenge to restore the pump.

## Optional discoveries

- **Rest Camp:** Restore 32 energy from sealed drinking-water supplies, up to twice per game.
- **River Bank:** Answer water-safety questions to earn a test kit.
- **Hill Spring:** Use the test kit to explore a second way to finish the expedition.

Movement and wrong answers cost energy. Reaching zero energy ends the mission. Earn Impact points by helping the village, finishing challenges, and preserving energy. Your **highest score is saved in this browser's localStorage**; active gameplay isn't saved across refreshes.

## Play in GitHub Codespaces

1. In this repo, choose **Code → Codespaces → Create codespace on main**.
2. Open a terminal and run `python3 -m http.server 8000`.
3. In the **Ports** tab, select the link for port `8000`.
4. Play in the browser! Edit the HTML, CSS, or JavaScript and refresh to see changes.

## Publish it as a public game with GitHub Pages

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Choose **main** and the **/(root)** folder, then click **Save**.
4. After deployment finishes, open `https://hooda133.github.io/charity-water-thirst-trail/`.

The Pages URL will only become live **after Pages is enabled and deployment succeeds**.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Start screen, game HUD, canvas, mission UI, modal dialogs |
| `styles.css` | Graphics, layout, responsiveness, keyboard focus, touch controls |
| `script.js` | Animation loop, camera, map, player movement, mission logic, mini-quizzes, scoring, energy, sound, high scores |

## About the project

This is **an independent fictional educational game** inspired by the mission of charity: water. It is **not an official charity: water product or affiliation**. In-game water testing, repair, and safety scenarios are simplified for learning and **are not drinking-water, health, or engineering instructions**. Always follow qualified local guidance for real-world water quality and drinking-water safety.