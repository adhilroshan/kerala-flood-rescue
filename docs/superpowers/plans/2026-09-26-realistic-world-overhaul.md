# Realistic World Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visibly disconnected primitive scene with a coherent, detailed Kerala-inspired flooded neighborhood that remains playable on desktop and phones.

**Architecture:** Keep the existing pure mission model and controller. Introduce an asynchronous, locally bundled visual-asset layer and explicit spatial anchors, then replace the house, shelter, boat, human, and vegetation visuals without changing stop identities or mission rules. World creation waits for critical assets, applies device-appropriate quality, and keeps docking/collision positions aligned with the visuals.

**Tech Stack:** TypeScript, Three.js 0.180, Vite 7, Vitest 5, glTF/GLB, locally hosted PBR textures, HTML/CSS loading and error states.

**Spec:** `docs/superpowers/specs/2026-09-26-realistic-world-overhaul-design.md`

## Global Constraints

- Preserve the rescue mission, stop identities, passenger/cargo rules, and respectful fictional framing; household coordinates expand 30% along their current shelter-to-stop vectors.
- Expand the playable water boundary to ±36 world units, and keep road geometry and map normalization within that extent.
- Show flood depth with mud/waterline bands on support piers and clearer lane/edge marks beneath the water; do not add floating debris in this pass.
- Left/right input is screen-relative to the following camera; keyboard, arrows, and touch use the same corrected sign mapping.
- Desktop and phones are supported; the existing touch input remains usable.
- All approved assets ship locally; no third-party origin is requested at runtime. Prefer CC0, and document redistribution rights and attribution for any other licensed asset.
- Reject mismatched generic assets instead of compromising the fictional Kerala setting. Inspect every replacement from the actual follow camera.
- The boat begins empty; two relief crates begin at the shelter. Preserve the three household counts (2, 1, 1) and current delivery rules.
- This workspace is not a git repository. Do not run commit commands unless the user separately requests Git initialization.

## File map

- `src/world/assets.ts`, `src/world/assets.test.ts`: manifest types, bundle path validation, critical-load orchestration and failure semantics. `public/assets/` contains approved local CC0 PBR textures and `public/assets/manifest.json` documents their provenance and transformations. No suitable free model for the boat, Kerala houses, or people passed the fit/accessibility check; those remain locally authored geometry.
- `src/world/anchors.ts`, `src/world/anchors.test.ts`: scene scale, stop positions, dock coordinates, floor heights, actor slots, seat/cargo slots and collision envelopes in one canonical convention.
- `src/world/geometry.ts`, `src/world/geometry.test.ts`: context-specific buildings/shelter and vegetation geometry, instantiated materials and local anchors where imported assets do not fit.
- `src/world/boat.ts`, `src/world/boat.test.ts`: rescue boat visual assembly, orientation and seat/cargo attachment groups.
- `src/world/actors.ts`, `src/world/actors.test.ts`: resident/volunteer visual instances and mission-driven actor/prop visibility.
- `src/world/quality.ts`, `src/world/quality.test.ts`: desktop/phone renderer profile and shadow/texture/vegetation choices.
- `src/world/world.ts`, `src/world/world.test.ts`: scene assembly, boat physics/camera, aligned docking and collision, resource disposal. Keep exported physics helpers and `World` behavior intact.
- `src/main.ts`, `src/ui/styles.css`: asynchronous loading, readable progress/retry/error states, safe teardown.
- `README.md`: updated asset credits, visual targets, test/device measurements and run instructions.

### Approved follow-up: expand world and clarify flood evidence

Keep the shelter at its existing location and multiply each household's offset from the shelter (1.3x first pass, then ~1.6–1.7x for the large world). Update `SCENE_LAYOUT` from those stop positions; retain per-stop dock offsets, 4-unit interaction radius, and stair/building collision tests. Set the symmetric playable bound to `WORLD_LIMIT = 70`; extend submerged roads, rain field, and map coordinate projection so all stops fit. Add 12 background houses with collision footprints, waterline foam rings, dock reeds, and a rim light. Fix the screen-relative steering inversion at the controller input mapping, with parallel keyboard and touch regression tests. Do not alter mission counts, routes' identities, or resource rules.

- [x] Add failing regression tests for screen-relative steering, ±70 bounds, 40+ unit stop spacing, map projection, waterline stains, and submerged-road visibility.
- [x] Apply the shared stop/map/collision coordinates, longer roads, pier waterlines, lane markings, and left/right sign correction.
- [x] Premium pass: hero boat dressing, occupied-house dressing, far-house LOD, stenciled crates, dock furniture, signboard text, sky dome, tree-line ring, dock pillars, dock-ready pulse, flag motion, renderer diagnostics.
- [x] Verify steering direction, Canal House dock + boarding, flood cues, and the expanded map at desktop and phone-sized viewports with measured diagnostics.

---

### Task 1: Local assets and resilient scene boot

**Files:** Create `src/world/assets.ts`, `src/world/assets.test.ts`, `public/assets/manifest.json`; modify `src/main.ts`, `src/ui/styles.css`, `src/world/world.ts`.

**Interfaces:** `interface WorldAssets { models: Map<string, THREE.Group>; textures: Map<string, THREE.Texture> }`; `loadAssetSet(entries: AssetEntry[], load: (path: string) => Promise<THREE.Group>, onProgress?: (loaded: number, total: number) => void): Promise<WorldAssets>` orchestrates critical/decorative model loading. `loadWorldAssets(onProgress?: (loaded: number, total: number) => void): Promise<WorldAssets>` reads the manifest, uses `GLTFLoader` for accepted GLB entries, and `TextureLoader` for local PBR maps. `createWorld(container: HTMLElement, reducedMotion: boolean, assets: WorldAssets): World` stays synchronous after loading. Keep `World` methods unchanged. This iteration uses local textures without forcing in an out-of-context boat, house, or person model.

- [x] **Step 1: Record the asset selection rubric.** CC0 roof-tile, plaster and timber textures are approved and their provenance is recorded in the manifest. Poly Haven has no suitable boat/house/person model. Sketchfab model downloads require authentication in this environment; no mismatched replacement was used.
- [x] **Step 2: Write failing loader tests.** Test that a missing critical entry or rejected load produces an actionable error and does not report a successful world; that loaded entries are local `/assets/` URLs; and that a decorative failure does not suppress boat/house/people. Use a fake `(path: string) => Promise<THREE.Group>` loader injected into the orchestration function, so tests do not require WebGL or network.

```ts
const load = vi.fn(async (path: string) => {
  if (path === '/assets/boat.glb') throw new Error('404');
  return new THREE.Group();
});
await expect(loadAssetSet([{ id: 'boat', path: '/assets/boat.glb', critical: true }], load))
  .rejects.toThrow(/boat/);
expect(() => validateAssetPath('https://elsewhere.example/boat.glb')).toThrow(/local/);
```

- [x] **Step 3: Run `npm test -- src/world/assets.test.ts`; confirm the tests fail for missing loader functionality.**
- [x] **Step 4: Implement `GLTFLoader` backed by manifest entries, a validation function accepting only `/assets/` paths, and the critical/decorative failure contract.** Load once, cache immutable source scenes, clone as appropriate for repeated placements, and avoid disposing shared geometry until world teardown. Parse manifest with `fetch('/assets/manifest.json')`; show the asset ID and a retry action on critical failure. For decorative failure, log the asset ID and use a coherent local fallback.

```ts
export type AssetEntry = { id: string; path: string; critical: boolean; source: string; author: string; license: string; version: string; processing: string };
export interface WorldAssets { models: Map<string, THREE.Group>; textures: Map<string, THREE.Texture> }
export function validateAssetPath(path: string): void {
  if (!/^\/assets\/[a-z0-9/_-]+\.(glb|gltf|ktx2|webp|png|jpg)$/i.test(path))
    throw new Error(`Asset must be bundled locally: ${path}`);
}
export async function loadAssetSet(
  entries: AssetEntry[], load: (path: string) => Promise<THREE.Group>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<WorldAssets> {
  const assets: WorldAssets = { models: new Map(), textures: new Map() };
  let completed = 0;
  for (const entry of entries) {
    validateAssetPath(entry.path);
    try { assets.models.set(entry.id, await load(entry.path)); }
    catch (error) { if (entry.critical) throw new Error(`Could not load ${entry.id}`, { cause: error }); }
    onProgress?.(++completed, entries.length);
  }
  return assets;
}
```

- [x] **Step 5: Make `main.ts` await the critical load before controller/UI construction.** Render a `role="status"` loading message, update it with loaded/total, and provide a `Retry loading scene` button on failure; on retry dispose any partially created renderer and rerun the load. Keep WebGL fallback and `pagehide` disposal. Do not start the animation loop before `createWorld` succeeds.
- [x] **Step 6: Run `npm test -- src/world/assets.test.ts && npm run build`; use browser network inspection to confirm all models and textures come from the app origin.** The browser loaded assets from the app's `/assets/` paths. The phone profile requests only three diffuse maps (1,954,952 bytes from the bundled files); desktop loads all six maps (4,122,187 bytes total). No third-party runtime requests.

### Task 2: Canonical scale, anchors and quality selection

**Files:** Create `src/world/anchors.ts`, `src/world/anchors.test.ts`, `src/world/quality.ts`, `src/world/quality.test.ts`; modify `src/world/world.ts`, `src/world/actors.ts`.

**Interfaces:** `SCENE_LAYOUT: Record<StopId, StopLayout>` maps each stop to `{ building: THREE.Vector3Tuple; dock: THREE.Vector3Tuple; waiting: THREE.Vector3Tuple[]; floorY: number }`. `BOAT_SLOTS: { seats: THREE.Vector3Tuple[]; cargo: THREE.Vector3Tuple[] }` maps passenger and cargo indices to boat-local tuples. `chooseQuality(isMobile: boolean, reducedMotion: boolean): QualityProfile` returns pixel ratio cap, shadow map size, foliage count, texture resolution class, water effect switch, and mobile camera FOV/distance.

- [x] **Step 1: Write failing layout tests against actual mission coordinates.** Assert that each household's `building` x/z matches `STOPS`, that waiting slots sit over its waiting platform at `floorY` within a small foot-height tolerance, and that dock points are outside the solid building envelope yet within interaction radius. Assert that passenger/cargo slots lie inside the boat's usable deck and that forward `+z` matches movement heading `0`.

```ts
for (const stop of STOPS.filter((item) => item.id !== 'shelter')) {
  const layout = SCENE_LAYOUT[stop.id];
  expect(layout.building[0]).toBe(stop.x);
  expect(layout.building[2]).toBe(stop.z);
  expect(layout.waiting).toHaveLength(stop.evacuees);
  expect(Math.hypot(layout.dock[0] - stop.x, layout.dock[2] - stop.z)).toBeLessThanOrEqual(4);
}
```

- [x] **Step 2: Run `npm test -- src/world/anchors.test.ts src/world/quality.test.ts`; confirm failure before implementation.**
- [x] **Step 3: Implement layout constants from existing `STOPS` and existing dock offsets, extracting collision and interaction coordinates from the same values.** Store model-local anchor coordinates separately from world coordinates and provide a transform helper that composes translation/rotation/scale. Update actors to attach to anchors instead of manually repeating stop offsets.
- [x] **Step 4: Implement the phone profile to lower pixel ratio, shadow resolution, water cost and foliage density while retaining people/docks.** Detect mobile capability conservatively using pointer/touch and viewport/device pixel ratio; let tests supply the boolean explicitly. The profile chooses render quality, not mission rules.

```ts
export interface QualityProfile {
  pixelRatioCap: number; shadowSize: number; foliageCount: number;
  textureClass: 'mobile' | 'desktop'; waterHighlights: boolean;
  showPeople: boolean; showDockMarkers: boolean;
  cameraFov: number; cameraDistance: number;
}
export const chooseQuality = (isMobile: boolean, reducedMotion: boolean): QualityProfile => ({
  pixelRatioCap: isMobile ? 1.25 : 1.7,
  shadowSize: isMobile ? 512 : 1024,
  foliageCount: isMobile ? 5 : 10,
  textureClass: isMobile ? 'mobile' : 'desktop',
  waterHighlights: !isMobile && !reducedMotion,
  showPeople: true, showDockMarkers: true,
  cameraFov: isMobile ? 66 : 54, cameraDistance: isMobile ? 12 : 11,
});
```

- [x] **Step 5: Run the focused tests, then `npm test && npm run build`.** Verify shelter and household docking still work with the current boat collision envelopes. Collision tests cover all three docks and stair obstructions.

### Task 3: Rebuild houses, shelter and vegetation

**Files:** Modify `src/world/geometry.ts`, `src/world/world.ts`; create `src/world/geometry.test.ts`; add accepted local models/textures and their manifest entries under `public/assets/`.

**Interfaces:** The implementation uses `createHouse(scene: THREE.Scene, x: number, z: number, palette: BuildingPalette, variation: number): THREE.Group` and the shelter assembler in `world.ts`. `createPalm(scene: THREE.Scene, x: number, z: number, scale: number, palette: Pick<BuildingPalette, 'timber' | 'leaf' | 'leafLight'>): THREE.Group` creates broad-frond authored geometry. `SCENE_LAYOUT` defines contact heights and waiting anchors.

- [x] **Step 1: Write failing structural tests for three complete, distinct houses.** Inspect mesh bounds for the roof resting on wall tops, posts intersecting both supported levels, veranda bounding boxes containing waiting positions, floor above water, and distinct roofline signatures. Test a frond's width-to-length and curvature sample points so an upright cone cannot pass as a palm. Use world-space bounds and geometry attributes rather than hardcoded source positions.
- [x] **Step 2: Run `npm test -- src/world/geometry.test.ts`; confirm failures on the existing disconnected roof, support, and spike-frond geometry.**
- [x] **Step 3: Replace house/shelter visuals incrementally, checking each from the boat camera.** Make roof planes meet the ridge/walls with a solid gable or hipped assembly and tiled PBR surface; give each house one recognizably different porch/roofline. Align windows and door to the facade, waiting surfaces and supports to the same floor heights, and shelter's volunteer/crate area to its actual dock. Retain valid collision footprints from Task 2.
- [x] **Step 4: Replace palm cones with asset-based or authored curved, tapered fronds and rooted trunks, with detail chosen by `QualityProfile`.** Add restrained small foliage and flood marks; remove the old spike meshes and floating decorative slabs. Keep shadows only on objects whose contact they clarify.
- [ ] **Step 5: Run geometry tests and `npm run build`; inspect desktop and phone screenshots at each of the three houses and the shelter.** Tests/build pass and browser screenshots were taken at the shelter and Canal House; Palm Lane and School Road still need individual screenshots.

### Task 4: Boat, people, crates and mission state

**Files:** Create `src/world/boat.ts`, `src/world/boat.test.ts`; modify `src/world/actors.ts`, `src/world/actors.test.ts`, `src/world/world.ts`; add accepted boat/human/prop assets and manifest records.

**Interfaces:** `createBoat(assets: WorldAssets, quality: QualityProfile): { group: THREE.Group; seats: THREE.Group[]; cargo: THREE.Group[]; forward: THREE.Vector3 }` returns visual anchors and a forward axis. `createVisualActors(scene: THREE.Scene, boat: THREE.Group): { update(state: MissionState): void }` retains mission-driven visuals using `SCENE_LAYOUT`.

- [x] **Step 1: Write failing tests for the boat's bow-forward orientation, attached seats/cargo slots, nonintersecting passenger feet/deck, and all mission visibility transitions.** Test initial shelter crates = 2, passengers/crates in boat = 0; after reload/board/deliver/unload, assert exactly the visual counterparts of mission counters and that all waiting/safe people stand on their respective floors.
- [x] **Step 2: Run `npm test -- src/world/boat.test.ts src/world/actors.test.ts`; confirm the new model/anchor expectations fail for the current geometry.**
- [x] **Step 3: Replace the extruded flat boat shape with a hull that has volume, bow/stern, gunwales, seats and propulsion detail.** Inspect its silhouette from behind and obliquely from the boat camera. Match `forward` to world heading and keep the wake behind the stern; preserve speed/turn physics.
- [x] **Step 4: Replace cylinder people with locally bundled, licensed human models that match the game's visual style, adjusting scale/pose for deck, veranda and shelter anchors.** No suitable free local human model passed context/licensing/access checks, so these are authored articulated models with shaped torsos, faces and clothing. They are not photorealistic scanned assets. Make crates sit on their supporting surfaces, never hover or clip.
- [ ] **Step 5: Run focused tests, the full suite, and the build.** Tests/build pass. Initial, boarded, unloaded, crate-loaded and Canal House delivery visual states were browser-verified; full mission completion remains to verify.

### Task 5: Lighting, performance, end-to-end visual acceptance

**Files:** Modify `src/world/world.ts`, `src/world/quality.ts`, `README.md`; add any targeted tests to existing world/quality test files if a measured regression reveals a stable rule.

**Interfaces:** Keep `World` and controller APIs stable. No mission change is part of this task.

- [x] **Step 1: Establish baseline measurements and screenshots.** Bundled texture sizes and desktop/mobile viewport screenshots are recorded. A physical mobile GPU was unavailable; sustained phone performance remains unverified and is documented.
- [x] **Step 2: Tune lighting/materials for overcast wet surfaces.** Balance sky light and shadow so roof details and human faces remain readable; reduce blown-out shelter highlights, harsh palm shadows and flat water. Keep rain/fog moderate enough to identify docks. Honor reduced motion.
- [x] **Step 3: Optimize measured hotspots one at a time.** The phone profile lowers pixel ratio/shadow size/foliage, widens and pulls back the camera, and skips normal maps. A hardware FPS benchmark remains unavailable.
- [ ] **Step 4: Play the mission end to end using desktop keyboard/mouse and phone touch controls.** Phone-sized touch QA reached Canal House, boarded two neighbors, delivered one crate, returned to the shelter, unloaded them and loaded two crates. Palm Lane, School Road, the second delivery, mission completion, and desktop keyboard playthrough remain to verify.
- [x] **Step 5: Run `npm test && npm run build` and update `README.md`.** Asset credits/license manifest and remaining realism/performance gaps are documented. Latest test/build evidence is in the handoff.
