# Bird Builder

A mobile-first 3D sandbox building game starring my birds: Cookie, Lightning, Pikachu, Abbas, Silver, Salman, Lemon, Aziz and Kiwi.
Walk and fly around a big open world as your bird and build anything — houses, roads, bridges, parks.

**Play:** https://abbas-is-tuff.github.io/Bird-Builder/

Built with Three.js + Vite (WebGL2). Works in phone browsers (iOS Safari, Android Chrome) and on desktop.

## Controls
- **Joystick / WASD** – move your bird
- **FLY / LAND** (Space / X) – take off and come down
- **Drag** – look around · **pinch / scroll** – zoom
- **BUILD** → pick an object → tap the ground (or press PLACE) to put it down
- **Tap an object** – move, rotate, resize, change material/colour, duplicate, delete
- **Undo / Redo** in the top bar

## Development
    npm install
    npm run dev           # local dev server (opens dev.html)
    npm run build         # builds the game into ./index.html (what GitHub Pages serves)
    npm run build:multi   # multi-file build -> dist/ (for app packaging)

GitHub Pages serves `index.html` from the main branch. Every push to `main` rebuilds it automatically (.github/workflows/deploy.yml).

## Code (src/)
- main.js      renderer, graphics presets, save/load, main loop
- world.js     terrain, lake/river/sea, sky, sun/moon, forests, rocks, grass
- birds.js     playable birds (models, walking, flying) + wandering birds
- textures.js  procedural PBR textures and materials
- library.js   building library (34 objects) + 3D thumbnails
- build.js     placement, selection, snapping/stacking, transforms, undo/redo
- controls.js  camera + touch/mouse/keyboard input
- ui.js        menus, HUD, joystick, library, inspector, settings
