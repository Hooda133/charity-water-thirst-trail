# Thirst Trail final stabilization audit — October 29, 2026

Baseline: GitHub `main` at `40a24d01c4a1357d8f1ae9b9bf3d8bc20334a738`.
Branch: `codex/final-production-audit`. Existing working tree was clean. Other local branches were preserved. The latest scrolling/camera reverts were retained.

## Verified fixes

- **Audio recovery:** a thrown oscillator start/stop left a counted voice behind. Nine failures could permanently suppress subsequent effects. Failed starts now release nodes and voice slots. Disposing the engine also releases pending voices immediately, and late events from a closed context cannot decrement new voices. Existing tones, style choices, volume/mute storage, cooldowns and lazy initialization are unchanged. The new fault-injection regression fails against the baseline with 9 leaked voices and passes with the fix.
- **Keyboard dialogs:** Tab and Shift+Tab could leave chapter dialogs and reach background controls. One shared listener now wraps focus within the visible Valley, Canyon or Coast dialog, prioritizing Settings when open. It resolves current enabled controls after puzzle updates. Existing Escape and gameplay handlers remain responsible for their actions. Settings now has an accessible dialog role and name.
- **Decorative title preview:** axe identified focusable content inside the `aria-hidden` hero illustration (including the shared WebGL canvas). The decorative container is now inert. When play begins, the existing renderer moves its canvas into the active game stage, outside that container.
- **QA:** added actual Chromium dialog/settings keyboard coverage, responsive title checks at five viewport sizes, footer checks and local 404/page-error monitoring. Wired the regression into CI and enabled the scenery test to use the graphics suite's exact cached Three.js modules.

No story, mission, scoring, difficulty, collision, character geometry, yellow backpack, graphic, audio palette, footer, donation destination or scrolling behavior was replaced. No dependency, asset or functional feature was removed. The production code changes are deliberately small.

## Chapter coverage

| Chapter | Executed evidence and preservation |
| --- | --- |
| Greenwater Valley | Real fallback interface: movement, click navigation, elder/toolkit/gasket, nine-pipe repair, safety questions, completion, Canyon unlock, checkpoint reload and mobile controls. Offline tests cover all 262,144 pipe rotations, navigation, supplies and quest callbacks. Shared dialog/audio fixes apply here. |
| Forgotten Canyon | Real fallback interface: all five goals, seal kit, 69 kPa valve calibration, ordered aqueduct repair, safety inspection, four-litre measuring lock, reload and final victory. Shared focus/audio fixes apply here. “Sunstone” names the final cistern; this version has no separate Sunstone collectible mechanic. |
| Stormbreak Coast | Desktop/mobile interface: circuit, bridge counterweights, partial reload, three tank layers, sluices, guarded release, celebration and replay. Live difficulty and partial-work preservation were tested. Shared focus/audio fixes apply here. |
| Village Life | Desktop/mobile interface: jug filling and conservation, all three household deliveries, all three leak repairs, all three projects and reload. Difficulty tests cover Hard's six-litre deliveries and preservation of earned work. Shared audio and Valley dialog behavior apply here. |

## Checks actually executed

- All **17** `tools/*.mjs` regression/asset scripts passed, including actual Three.js explorer geometry, grounding, yellow jug placement, obstruction fading/restoration and 19,602 ramp raycasts. The explorer test used the exact pinned r170 module cached in ignored `work/` because direct Node fetch could not use the proxy.
- `node --check` passed for every top-level production JavaScript file.
- Python unittest discovery passed all **4** asset-import tests.
- `test-browser.py` passed the real Valley → Canyon fallback walkthrough, reloads, completion and its mobile checks.
- `test-expansion-browser.py` passed desktop and `--mobile` Village Life/Coast walkthroughs.
- `test-difficulty-browser.py` passed desktop and mobile Settings, actual movement costs, preserved village work, Canyon pressure ranges and Coast partial puzzles.
- `test-dom-interactions-browser.py` passed desktop and mobile supply/pipeline DOM outcomes, stale-click reward guards, stable nodes, keyboard focus, reload and replay.
- `test-audio-browser.py` passed actual mute, volume/style persistence, preview, finite audio events and no autoplay checks.
- `test-dialog-keyboard-browser.py` passed forward/reverse focus wrapping, initial dialog navigation, Settings priority, Escape, five responsive title viewports, footer destinations, and no local 404s or uncaught page errors.
- `test-graphics-browser.py --smoke` passed actual WebGL/PBR/water/postprocessing compilation, nonblank output and disposal.
- axe-core 4.10.3 WCAG A/AA title scan initially found `aria-hidden-focus`; after the inert fix it returned **zero violations**. This is not a Lighthouse score or a full assistive-technology audit.
- Both preserved charity: water destinations returned HTTP **200** through the session proxy.
- `git diff --check` passed. Final changes were reviewed for feature loss and unintended deletions.

## Incomplete checks and limits

- Full WebGL scenery and Low/High/live-settings runs did **not** complete successfully: Chromium timed out waiting for chapter globals or controls during startup. One initial scenery attempt loaded 9/12 Valley decorative models and captured a rendered scene, but that is not a four-scene pass. The ordinary WebGL gameplay run timed out at the initial five-second movement assertion. These failures are recorded separately from the passing shader smoke and fallback walkthroughs; they are not represented as completed visual/gameplay verification.
- `tools/test-supply-dom.py` is a stale older suite: it waits for the removed `TrailDifficulty` API, seeds the obsolete preference key, and expects obsolete mode-dependent pickup recovery. It timed out. The maintained `test-dom-interactions-browser.py` covers supply interactions and passes at desktop/mobile sizes; production behavior was not changed to satisfy obsolete test expectations.
- Settings/help axe scans timed out; zero title violations does not establish zero violations in every state. Lighthouse, screen-reader usability, physical touch hardware, human audio listening, representative GPU frame rate/memory, and a continuous human playthrough remain unverified.
- The original external Three.js requirement and playable 2D fallback remain. No speculative performance or visual rewrite was made in response to test-machine timeouts.

## Git delivery

### October 29 debugging follow-up

The earlier audit was merged through PR #28 (`302f574`). Follow-up work starts from that main commit on `codex/debug-webgl-and-supply`.

- Repaired the older `test-supply-dom.py` suite to use the actual `TrailMode` preference/API, current supply DOM selectors, immediate nearby collection, the existing 12-energy recovery on every difficulty, the capped-recovery toast and final-item status focus. It now passes desktop/mobile interaction, stale-click and modal guards, stable nodes, reload, restart, all difficulty recovery values, energy caps and final-item focus with no page errors. No production game behavior was changed to satisfy the test. Added it to browser CI.
- A test-only instrumented WebGL run loaded the original explorer and village models, reported 26 loaded PBR maps with zero failures, rendered the active Valley, and moved the explorer from x=310 to x=353 using keyboard input. A second run with software compositing also moved the explorer and captured the scene. This establishes startup/rendering/movement in those diagnostic runs, not full chapter completion in WebGL.
- Profiling found multi-second animation-frame gaps on SwiftShader, while sampled JavaScript render calls were typically tens of milliseconds after initial compilation. Visibility queries also consumed measurable CPU time. The source of all remaining graphics timing overhead is not conclusively isolated, so no speculative renderer or gameplay rewrite was made. The complete WebGL walkthrough and representative hardware performance remain unverified.
- The initial stale-supply failure described above is resolved by this follow-up. Historical failed runs remain recorded; they are not counted as passes.

Implementation commits: `3037df3` (audio lifecycle), `9fbfb87` (dialog keyboard/QA), `83820ce` (decorative preview), `a4859e0` (portable browser selection). Report and final verification are saved in a subsequent commit. Changes are delivered on the feature branch for review; this audit does not authorize or perform a merge into `main`.
