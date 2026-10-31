# Speeder Forager

A 3D hover-bike survival game for up to 10 riders (humans plus bots).

- Solo: play against 9 bots.
- Online: one player creates a room and shares the 4-letter code; friends open the site and join. Empty seats are filled by bots. Players connect through a public MQTT relay over WebSocket, so it works behind home routers; no server to run.

Controls: W/S drive, A/D steer, Space jump, F throw tomato, Tab spectate, P pause (solo).
Races last up to 5 minutes. Last rider with energy wins.
