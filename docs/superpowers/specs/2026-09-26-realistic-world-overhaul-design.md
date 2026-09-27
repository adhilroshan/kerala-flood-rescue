# Kerala Flood Rescue — Realistic World Overhaul

## Goal

Replace the first playable's visibly disconnected primitive models with a coherent, more realistic 3D neighborhood while preserving the rescue mission, stop identities, controls, and respectful fictional framing. Expand the playable waterways and spread households farther from the relief shelter. The result must be usable on both desktop and phones. Visual fidelity is judged in the running game from the following boat camera, not from isolated asset previews.

This spec supersedes the first-playable design's **low-poly/local authored geometry** direction and its **desktop-only input target** for the visual overhaul. The implemented mission continues to start with an empty boat and two crates at the shelter.

## Art direction and asset policy

- Depict a fictional Kerala-inspired flooded neighborhood under overcast monsoon light: weathered plaster, tiled sloped roofs, timber and painted metal, wet surfaces, murky water, and restrained warm light at occupied locations. Avoid generic European houses, tropical-resort imagery, disaster spectacle, or toy-like primary-colored geometry.
- Prefer a hybrid of suitable licensed models and context-specific authored geometry. An asset is accepted only if its silhouette, scale, topology, material response, and cultural context work in the actual scene. If a free asset does not fit, model the specific element rather than shipping a visibly mismatched replacement.
- Bundle approved assets with the application. No model, texture, or license information requires a third-party service at runtime. Prefer CC0; other licenses require explicit redistribution rights and a recorded attribution entry. Keep an asset manifest with source URL, author, license, downloaded version, local path, and transformations for each third-party asset.
- Use glTF/GLB for imported geometry with physically based materials. Prepare optimized desktop and phone variants from the same art direction, retaining silhouettes and mission-critical details. Do not embed large source-resolution textures when smaller ones read equivalently from the game camera.

## Models and composition

- **Three houses:** Each has joined roof planes with visible thickness, proper eaves, walls with convincing doors/windows, a raised dry waiting area, supports that meet their floors, and a legible route to the docking side. Roof color/material and porch/roofline distinguish the houses while preserving their mission identities. Decorative details must not obstruct waiting residents or docking markers.
- **Shelter:** A plausible raised relief staging area with a complete roof, structural posts, readable boat-facing dock, place for volunteers and two supply crates, and a separate safe area for arriving residents.
- **Boat:** A recognizable narrow rescue-boat hull with bow/stern, gunwales, seats, motor or propulsion detail, and stable places for up to two visible passengers and two crates. The model's forward direction must agree with controls, camera, wake, and navigation lights.
- **People and crates:** Human figures with believable proportions, grounded feet, distinct volunteer/resident clothing, and poses that read at gameplay distance; no floating limbs or intersections with the boat, floors, or roofs. Visual counts still follow mission state. Crates rest on the dock, boat, or household landing as applicable.
- **Vegetation and environment:** Palms have tapered trunks and broad, curved fronds rather than spike-like cones. Add restrained local foliage and flood-level cues. Buildings, boat, people, palms, and props must share one real-world scale and lighting/material treatment.

## World extent and flood cues

- Move each household farther from the shelter along its existing shelter-to-house vector (first pass 30%, then roughly 60–70% for a large-world feel); leave the shelter, mission IDs, requests, and passenger/cargo rules unchanged.
- Expand the playable water boundary from ±26 to ±36 and then to ±70 world units. Extend submerged street geometry and map normalization to the same bound so the expanded destinations remain navigable and visible on the schematic map. Add a background village of 12 decorative houses for midground/far depth.
- Mark the flood level with stained bands on the raised house and shelter supports. Make the submerged street surface and its lane/edge markings more legible through the water. Do not add floating debris in this pass.
- Orient the left/right control mapping to the following-camera screen: left input turns the view left and right input turns it right. Keyboard arrows/WASD and touch controls must use the same sign convention.

## Scene and loading architecture

- Retain the pure mission model and controller interfaces. The world owns asset loading, instancing, transforms, lighting, camera, weather, LOD/quality selection, spatial markers, and disposal. Mission state drives visibility/placement through named actor groups or anchors; no game rules move into the asset layer.
- Define consistent units, forward axis, ground origin, model scale, collision footprint, and attachment anchors (waiting positions, seats, cargo slots, dock, safe area) in scene data. Validate anchors against surfaces and camera visibility. Keep docking positions and collision boundaries aligned to the replacement meshes; do not allow a prettier model to make a stop unreachable.
- Start the mission only after critical scene assets (boat, houses, shelter, people and crates) have loaded or produced a clear recoverable failure. Provide an accessible loading state with progress/status text and a helpful failure/retry state. A missing decorative asset may fall back to a coherent local placeholder; critical objects must not silently disappear.
- Preserve the WebGL-unavailable message and reduced-motion behavior. Dispose textures, geometries, cloned materials, loaders' resources, and event listeners when the scene shuts down.

## Desktop and phone quality

- Use device-aware pixel ratio, shadows, texture resolution, vegetation density, and model LOD. Reduce expensive reflections and shadow work on phones before sacrificing the recognizability of the boat, waiting people, docks, or houses.
- Keep model loads local and cache repeated resources; share geometry/materials where safe. Prefer compressed meshes/textures only when the necessary decoders are bundled and their loading failure is handled. Test with an actual phone or representative mobile GPU when available; a narrow desktop viewport checks layout but is not a performance substitute.
- Measure initial asset transfer size, load-to-interactive time, frame pacing, draw calls, texture memory, and long frames. Tune against sustained smooth control on a mid-range phone and higher fidelity on desktop rather than a single desktop screenshot. Record test devices and observed measurements in the implementation notes.

## Error and verification contract

- Regression tests check transform conventions, anchor placement versus floors/deck, boat facing versus heading, all required actors/props and their mission-driven visibility, asset manifest completeness, and handling of a failed critical load. Tests must catch previously observed floating/intersecting geometry without merely asserting arbitrary coordinates.
- Review screenshots from the actual follow camera at the shelter and each of the three household docks, from desktop and phone-sized views, in initial, boarded, and unloaded states. Inspect roof joints, people on landings, passenger fit, crate placement, palms, waterline, occlusion, and readability under rain/fog. Iterate on visual defects before claiming the models are fixed.
- Run the full test suite and production build. Play the rescue flow end to end on desktop and touch input; confirm every stop remains dockable, stateful models agree with mission counters, and no asset network request points to a third-party runtime origin. Record any asset that could not meet the realism target rather than presenting a primitive fallback as final art.

## Out of scope

Historically precise reconstruction, named real survivors, paid or unlicensed assets, combat, new mission rules, and photorealistic simulation of the flood. The target is the most convincing coherent browser-game presentation practical for this scene and its desktop/phone performance needs.
