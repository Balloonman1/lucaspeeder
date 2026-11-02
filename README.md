# Speeder Forager

A 3D hover-bike survival race through the Veyra canyon, created by a 7-year-old game developer. Up to 10 riders per race; bots fill empty seats.

## Play
- Solo against 9 bots, or create a room and share the 4-letter code / invite link.
- Classic 5-minute races or 90-second quick play. Last rider with energy wins.
- Three places to race: Veyra Canyon, Kaldris Ice Shelf (slippery, snowfall) and New York City (street grid, Central Park, parked taxis, pizza).
- Four vehicle classes (Scout, Blitz, Hauler, Hopper) with paint, trim and pattern customization.
- Food (rice and beans, vegetables, strawberries, raspberries, milk, bagels, toast, french fries, ice cream) restores energy; energy drinks give turbo; cherries spawn a helper clone; tomatoes jam a rival's GPS; jumps (and double-tap backflips) launch you forward but cost energy.

Controls: W/S drive, A/D steer, Space jump (double-tap = backflip), F throw tomato, Tab spectate, P pause. Phone: drag left thumb to steer, tap right side to jump, hold to brake.

## Project
- `index.html`, `src/` — Vite + three.js (r170) modular build: `engine.js` (renderer, shadows, GTAO, bloom, SMAA, grade), `sky.js` (sun/moon cycle, HDRI IBL), `terrain.js` (height field, 4-layer PBR splat material, triplanar rock material), `props.js` (canyon walls, obstacles, instanced vegetation), `audio.js` (procedural Web Audio), `game.js` (gameplay, bots, networking, HUD, menus), `config.js`.
- `public/assets/` — CC0 textures, models and HDRI; see `public/assets/CREDITS.md`.
- `public/legacy/index.html` — the previous single-file version, still playable at `/legacy/`.
- Multiplayer uses a public MQTT relay over WebSocket; nothing to host.

## Develop
```
npm install
npm run dev      # local dev server
npm run build    # outputs dist/ (Netlify builds this automatically, see netlify.toml)
```
