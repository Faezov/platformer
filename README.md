# Crownline Vale

Crownline Vale is an original side-scrolling crown defense prototype built for desktop Linux. You ride between camps, spend coins to hire travelers, raise walls and towers, grow farms, and survive night waves from the forest edge.

## Run

The game code itself has no build step. Open `src/index.html` in a browser to play the canvas version.

For the desktop shell:

```bash
npm install
npm start
```

If you are running from the VS Code snap integrated terminal, `npm start` may inherit Electron-specific environment variables from VS Code. The start script clears the important one, but if Chromium sandboxing is still blocked by snap confinement, run from a normal system terminal or use the browser fallback:

```bash
npm run start:web
```

Then open `http://localhost:8080/src/`.

## Controls

- `A` / `D` or arrow keys: ride left and right
- `Shift`: gallop while stamina lasts
- `Space`, `E`, or `Enter`: spend coins on the closest prompt
- `P` or `Escape`: pause

Pointer input also works: press the left or right side of the screen to move, and press the center area to spend coins.

## Package For Ubuntu App Center

Ubuntu App Center installs apps distributed through the Snap Store. This project uses Electron Builder's Snap target, configured in `package.json`.

```bash
npm install
npm run dist:snap
```

The generated `.snap` appears in `dist/`. For a store-ready release, change `build.snap.grade` from `devel` to `stable`, set final publisher metadata, add screenshots, and upload the snap through the Snapcraft dashboard or CLI.

## Test

The core simulation is separated from rendering, so the rules can be tested without Electron or a browser:

```bash
npm test
```

## Project Layout

- `src/game-core.js`: deterministic game rules, economy, waves, saves
- `src/game.js`: canvas rendering, input, audio, HUD
- `src/index.html`: app surface
- `main.js`: Electron desktop wrapper
- `tests/`: Node test suite for the core loop
