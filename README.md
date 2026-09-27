# Kerala Flood Rescue

A single-player 3D boat-rescue mission for desktop and touch browsers. The neighborhood and its characters are fictional, inspired by conditions and community response during the 2018 Kerala floods.

## Run locally

```sh
npm install
npm run dev
```

Use the local URL printed by Vite. To run the mission-rule tests and production build:

```sh
npm test
npm run build
```

## Controls

- `W` / `↑`: move forward; `S` / `↓`: reverse.
- `A` / `←` and `D` / `→`: steer.
- `E`: dock at a marked landing after slowing the boat.
- `M`: open or close the rescue map.
- `Esc`: pause or close the current panel.
- Use the on-screen Map, Pause, dock, and mission-action buttons with a mouse or keyboard.
- On narrow touch screens, hold the on-screen arrow buttons to steer, move forward, or reverse. Release to coast to a stop before docking.
- Left/`←` turns the boat left on screen; right/`→` turns it right, on both keyboard and touch controls.

## Mission

Load two relief crates at the shelter, follow the radio calls, evacuate four neighbors, and deliver the crates requested at two households. The boat carries two passengers and two crates. Shelter capacity does not run out, there is no fail timer, and the mission can be completed in any route order.

Rain ambience is off until enabled from Pause & help. Use “Return boat to safe water” there if the boat gets stuck. Two volunteers wait on the shelter dock; residents wait on their homes' raised verandas. Passengers and supply crates appear in the boat as the mission changes. The interface supports reduced-motion preferences and displays a readable message if WebGL is unavailable.

## Scene assets and device quality

The neighborhood spans a ±70-unit flooded play area, with the households spread well clear of the shelter and a 12-house background village (simplified LOD, no shadows) giving midground/far depth. Waterline foam rings mark the flood level around every building, with reeds near the docks. Occupied houses fly bunting and show a warm porch lamp; the shelter has a flag, signboard, tire fenders and mooring posts. The rescue boat carries life rings, rope coil, registration marks, cushions, fuel tank, paddle and stern lantern; dock rings pulse when a slow approach is in range.

Measured renderer diagnostics (headless Chromium, software GL — draw-call/triangle counts are valid, frame times are not): desktop 356 calls / 21k triangles / 11 textures, mobile profile 249 calls / 14.8k triangles / 7 textures. Draw calls exceed the 300/150 starting budgets while triangles sit under 3% of budget; no post-processing and a single shadow-casting light keep the cost in simple shaders. Sustained FPS on a physical phone is still unmeasured. Dark waterline/mud bands on the raised supports and higher-contrast submerged lane markings make the flood depth easier to read. The scene uses bundled 1K PBR textures for weathered clay roof tile, plaster, and timber from [Poly Haven](https://polyhaven.com), licensed CC0. Sources, authors, license, version, and processing are recorded in `public/assets/manifest.json`. The files are included locally; the game makes no runtime request to Poly Haven. Desktop loads the optional OpenGL normal maps. Coarse-pointer/narrow-device profiles omit those normal maps, cap pixel ratio at 1.25, use 512px shadows, reduce foliage, and widen the follow camera. People, dock markers, and rescue props remain visible on mobile.

The three Kerala-inspired houses, shelter, rescue boat, residents, volunteers, and palms use authored scene geometry: the available free model catalogs did not provide a suitable local rescue boat, Kerala house, or human model that fit the scene. This iteration improves their shape, proportions, material response, and placement, but those assets are still custom procedural models rather than scans or photorealistic production assets. Six texture files total about 4.12 MB; the diffuse maps loaded on mobile total about 1.96 MB. Mobile visual checks use an iPhone-sized browser viewport; sustained performance on physical mid-range phones has not yet been measured.
