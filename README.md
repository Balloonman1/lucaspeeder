# Speeder Forager

A 3D hover-bike survival race through the Veyra canyon, created by a 7-year-old game developer. Up to 10 riders per race; bots fill any empty seats.

- Solo against 9 bots, or create a room and share the 4-letter code (or the invite link) with friends.
- Classic 5-minute races or 90-second quick play. Last rider with energy wins; if the clock runs out, highest energy wins.
- Food restores energy, energy drinks give turbo, cherries spawn a helper clone, tomatoes jam a rival's GPS.
- Combos for fast food chains, close-call bonuses for jumping over rocks, personal bests and achievements saved in the browser.
- Procedural music and sound effects (Web Audio), day/night cycle, graphics quality settings with automatic step-down on slow devices.

Multiplayer uses a public MQTT relay over WebSocket, so it works behind home routers with nothing to host.

Controls: W/S drive, A/D steer, Space jump, F throw tomato, Tab spectate, P pause (solo). On phones: drag left thumb to steer, tap right side to jump, hold to brake.

Built with Three.js r128 in a single `index.html`.
