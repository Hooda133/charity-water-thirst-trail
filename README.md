# Thirst Trail: Find the Safe Source 💧

A playable, responsive **charity: water–inspired student game prototype** made with HTML, CSS, and vanilla JavaScript for the Global Career Accelerator web development project.

## Play the game

To play locally, download or clone this repository and open `index.html` in a modern browser. Click **Start the mission** to begin. No build tools, frameworks, accounts, or external libraries are needed.

### Run in GitHub Codespaces

1. Open this repository on GitHub and choose **Code → Codespaces → Create codespace on main**.
2. In the Codespaces terminal, run `python3 -m http.server 8000`.
3. Open the **Ports** tab and click the forwarded **8000** port's browser link. If prompted, select **Open in Browser**.
4. To stop the server, press `Ctrl+C` in the terminal.

### Optional: publish on GitHub Pages

Open the repository's **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose **main** and **/(root)**, then click **Save**. The game uses relative paths and works as a static website once Pages is enabled and deployment finishes.

## How to play

- Select any of four map locations. Each trip to a different location costs 9% thirst.
- Choose actions to earn impact points and collect useful items.
- **Pump route:** Collect the repair toolkit at the Village, travel to the Old Water Pump, inspect it, then repair it.
- **Spring route:** Collect treatment supplies at River Bend, travel to Hill Spring, test the spring, then treat its water.
- Win by finding a safe water source before your thirst reaches 0%. If you run out, you lose. Press **Play again** or **Restart game** to reset.

## Assignment requirements

- **HTML:** Start screen, interactive location buttons, score and thirst displays, results dialog.
- **CSS:** Responsive layout for desktop and mobile, progress bar, clear action buttons.
- **JavaScript:** Click actions, location tracking, score updates, thirst costs, item requirements, win/lose logic, and restarting.

## Project files

- `index.html` — screen structure and controls
- `styles.css` — styles and mobile layout
- `script.js` — interactive game logic

**Note:** The game is a fictional educational prototype, not official charity: water content or real-world water safety guidance. Water testing and treatment are simplified as game mechanics.