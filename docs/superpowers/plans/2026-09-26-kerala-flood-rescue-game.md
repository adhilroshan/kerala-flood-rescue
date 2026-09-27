# Kerala Flood Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one complete, playable browser-based 3D rescue mission combining boat navigation, relief logistics, and character stories.

**Architecture:** A pure TypeScript mission model owns all requests and resources. A Three.js world owns spatial movement and visuals; a controller coordinates the world/model with accessible HTML screens. Authored geometry and mission data run locally without network assets.

**Tech Stack:** TypeScript, Vite, Three.js, Vitest, native HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-09-26-kerala-flood-rescue-game-design.md`

## Global Constraints

- Single-player, keyboard-first desktop browser game; one roughly 10–15-minute mission in a fictional composite Kerala neighborhood during the 2018 floods.
- No combat, leaderboard, casualty countdown, multiplayer, mobile touch steering, or named real survivors.
- Three households have two, one, and one evacuee; two supply requests require one crate each; two passenger seats and two crate slots. The boat starts empty; the shelter starts with two crates.
- A mission is complete only after all four evacuees reach the shelter and both crates reach their requesting stops.
- Use local authored geometry/materials and fictional copy; explain the real-event/fictional framing in opening and closing cards.
- Desktop keyboard and mouse controls, keyboard-operable HTML overlays, reduced-motion treatment, WebGL fallback, and recoverable boat movement are required.
- The workspace is currently not a git repository; do not create commits unless explicitly requested.

## File map

- `package.json`, `tsconfig.json`, `index.html`, `vite.config.ts`: runnable Vite/TypeScript app and test scripts.
- `src/mission/types.ts`: model types and fixed stop identifiers.
- `src/mission/data.ts`: households, coordinates, and fictional dialogue/copy.
- `src/mission/model.ts`: pure transition functions, capacity checks, completion.
- `src/mission/model.test.ts`: rule and non-happy-path tests.
- `src/world/world.ts`: Three.js scene, boat physics, spatial proximity, collision, camera, reset and disposal.
- `src/world/world.test.ts`: pure spatial helpers/collision bounds tests only (no WebGL mocks).
- `src/game/controller.ts`: keyboard events, radio discovery, interaction orchestration, overlay pause, mission/world synchronization.
- `src/game/clock.ts`, `src/game/clock.test.ts`: fixed-step simulation clock and low-frame-rate timing coverage.
- `src/ui/render.ts`: semantic HTML HUD, map, stop dialogue, opening/pause/epilogue screens and focus management.
- `src/ui/styles.css`: responsive overlay and HUD styling.
- `src/audio/ambience.ts`: synthesized rain/water ambience and mute toggle without remote assets.
- `src/main.ts`: boot, WebGL fallback, animation loop and cleanup.
- `README.md`: run instructions and controls.

---

### Task 1: Pure mission rules and runnable project

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/mission/types.ts`, `src/mission/data.ts`, `src/mission/model.ts`, `src/mission/model.test.ts`.

**Interfaces:** Produce `StopId = 'shelter' | 'house-a' | 'house-b' | 'house-c'`, `StopDefinition` with `{id,label,x,z,evacuees,supplyRequested,story}`, `STOPS: readonly StopDefinition[]`, `createMission(): MissionState`, and `applyMissionAction(state: MissionState, action: MissionAction): {state: MissionState; message: string; changed: boolean}`. Actions are `{type:'discover'; stop:StopId}`, `{type:'board'; stop:HouseId}`, `{type:'deliver'; stop:HouseId}`, `{type:'unload'}`, `{type:'reload'}`. MissionState includes `discovered: StopId[]`, `waiting: Record<HouseId,number>`, `pendingSupplies: HouseId[]`, `passengers: number`, `boatCrates: number`, `shelterCrates: number`, `rescued: number`, `delivered: number`, `complete: boolean`.

- [ ] **Step 1: Add project scripts and test-first model fixtures.**

```json
{"type":"module","scripts":{"dev":"vite --host 0.0.0.0","build":"tsc --noEmit && vite build","test":"vitest run"},"dependencies":{"three":"^0.180.0"},"devDependencies":{"@types/three":"^0.180.0","typescript":"^5.9.0","vite":"^7.1.0","vitest":"^5.0.2","jsdom":"^26.1.0"}}
```

```ts
// src/mission/model.test.ts
import { expect, test } from 'vitest';
import { applyMissionAction, createMission } from './model';

test('capacity forces a return trip and a failed board leaves state intact', () => {
  let state = createMission();
  state = applyMissionAction(state, { type: 'board', stop: 'house-a' }).state;
  const rejected = applyMissionAction(state, { type: 'board', stop: 'house-b' });
  expect(rejected.changed).toBe(false);
  expect(rejected.state).toEqual(state);
  expect(state.passengers).toBe(2);
});

test('crates are unique and every objective is required to finish', () => {
  let state = createMission();
  state = applyMissionAction(state, { type: 'reload' }).state;
  for (const stop of ['house-a', 'house-b'] as const) state = applyMissionAction(state, { type: 'deliver', stop }).state;
  expect(state.delivered).toBe(2);
  expect(state.complete).toBe(false);
  expect(applyMissionAction(state, { type: 'deliver', stop: 'house-a' }).changed).toBe(false);
  state = applyMissionAction(state, { type: 'board', stop: 'house-a' }).state;
  state = applyMissionAction(state, { type: 'unload' }).state;
  for (const stop of ['house-b', 'house-c'] as const) state = applyMissionAction(state, { type: 'board', stop }).state;
  state = applyMissionAction(state, { type: 'unload' }).state;
  expect(state.complete).toBe(true);
});
```

- [ ] **Step 2: Install dependencies and verify red tests.** Run `npm install && npm test`; expect tests to fail because `./model` does not exist. Create only the test and package configuration before this run.
- [ ] **Step 3: Implement immutable mission transitions and fixed world data.** Discovering the shelter is automatic; the boat starts with zero crates and the shelter stores two. Reloading at the shelter fills the boat up to its two-crate capacity. Boarding takes an entire household, and unloading/reloading occurs only when the controller reports the shelter as the nearby stop. Keep every unchanged result referentially identical to its input.

```ts
// src/mission/types.ts
export type HouseId = 'house-a' | 'house-b' | 'house-c';
export type StopId = 'shelter' | HouseId;
export interface StopDefinition { id: StopId; label: string; x: number; z: number; evacuees: number; supplyRequested: boolean; story: string }
export interface MissionState {
  discovered: StopId[]; waiting: Record<HouseId, number>; pendingSupplies: HouseId[];
  passengers: number; boatCrates: number; shelterCrates: number;
  rescued: number; delivered: number; complete: boolean;
}
export type MissionAction = { type:'discover'; stop:StopId } | { type:'board' | 'deliver'; stop:HouseId } | { type:'unload' | 'reload' };
export interface MissionResult { state: MissionState; message: string; changed: boolean }
```

```ts
// src/mission/data.ts — keep stops spatially separated, inside the world bounds
import type { StopDefinition } from './types';
export const STOPS: readonly StopDefinition[] = [
  { id:'shelter', label:'Relief shelter', x:0, z:15, evacuees:0, supplyRequested:false, story:'Volunteers are ready to receive neighbors.' },
  { id:'house-a', label:'Canal house', x:-18, z:4, evacuees:2, supplyRequested:true, story:'Two neighbors wait by the upper landing. A nearby family needs a crate.' },
  { id:'house-b', label:'Palm lane', x:17, z:-5, evacuees:1, supplyRequested:true, story:'One neighbor is ready to leave. Others staying nearby need supplies.' },
  { id:'house-c', label:'School road', x:-3, z:-19, evacuees:1, supplyRequested:false, story:'A neighbor signals from a shaded porch.' },
];
```

```ts
// src/mission/model.ts — required initial shape and transition result
import type {MissionAction, MissionResult, MissionState} from './types';
export function createMission(): MissionState {
  return { discovered:['shelter'], waiting:{'house-a':2,'house-b':1,'house-c':1},
    pendingSupplies:['house-a','house-b'], passengers:0, boatCrates:0,
    shelterCrates:2, rescued:0, delivered:0, complete:false };
}
export function applyMissionAction(state: MissionState, action: MissionAction): MissionResult {
  const reject = (message: string): MissionResult => ({state, message, changed:false});
  const accept = (next: MissionState, message: string): MissionResult => ({
    state:{...next, complete:next.rescued === 4 && next.delivered === 2}, message, changed:true
  });
  switch (action.type) {
    case 'discover':
      return state.discovered.includes(action.stop) ? reject('Already on the map.')
        : accept({...state, discovered:[...state.discovered, action.stop]}, 'New stop added to the map.');
    case 'board': {
      const count = state.waiting[action.stop];
      if (!count) return reject('Everyone here has boarded.');
      if (state.passengers + count > 2) return reject('Not enough seats. Return to the shelter first.');
      return accept({...state, passengers:state.passengers + count,
        waiting:{...state.waiting, [action.stop]:0}}, `${count} neighbor(s) aboard.`);
    }
    case 'deliver':
      if (!state.pendingSupplies.includes(action.stop)) return reject('No outstanding crate request here.');
      if (!state.boatCrates) return reject('No crates aboard. Return to the shelter.');
      return accept({...state, boatCrates:state.boatCrates - 1, delivered:state.delivered + 1,
        pendingSupplies:state.pendingSupplies.filter(id => id !== action.stop)}, 'Supplies delivered.');
    case 'unload':
      if (!state.passengers) return reject('No passengers to bring ashore.');
      return accept({...state, rescued:state.rescued + state.passengers, passengers:0}, 'Neighbors are safe at the shelter.');
    case 'reload': {
      const count = Math.min(2 - state.boatCrates, state.shelterCrates);
      if (!count) return reject('No crates left to load.');
      return accept({...state, boatCrates:state.boatCrates + count,
        shelterCrates:state.shelterCrates - count}, 'Crates loaded.');
    }
  }
}
```

- [ ] **Step 4: Run `npm test` and `npm run build`.** Expect both to pass after adding Vite configuration, TS DOM configuration, and an `index.html` entrypoint with `<div id="app"></div>` and `<script type="module" src="/src/main.ts"></script>`. Provide `src/main.ts` with a visible title until Task 4 replaces it. Check that a failed action does not mutate nested arrays or records.

### Task 2: Navigable 3D neighborhood

**Files:** Create `src/world/world.ts`, `src/world/world.test.ts`, `src/world/geometry.ts` (house/plant geometry helpers).

**Interfaces:** Consume `STOPS`, `StopId`. Produce `createWorld(container: HTMLElement, reducedMotion: boolean): World` where `World` has `tick(dt: number, input: {throttle:number; steer:number; paused?:boolean}): void`, `nearestStop(): StopId | null`, `position(): {x:number;z:number}`, `resetToSafeWater(): void`, `render(): void`, `dispose(): void`. Export pure `clampToWater(x,z)`, `isBlocked(x,z)`, and `advanceSpeed(speed,throttle,dt)` from `world.ts` for focused tests. Keep the map coordinate system identical to `STOPS`.

- [ ] **Step 1: Write a failing spatial test.**

```ts
// src/world/world.test.ts
import { expect, test } from 'vitest';
import { clampToWater, isBlocked } from './world';
test('boat stays inside the playable water and cannot cross a house footprint', () => {
  expect(clampToWater(80, -80)).toEqual({ x: 26, z: -26 });
  expect(isBlocked(-18, 4)).toBe(true);
  expect(isBlocked(0, 15)).toBe(false);
});
```

- [ ] **Step 2: Run `npm test -- src/world/world.test.ts`.** Expect a missing-module failure.
- [ ] **Step 3: Implement bounded boat physics and visual scene.** Use a 54×54 water plane with playable center coordinates clamped to `[-26,26]`; each house has an explicit solid footprint and a dock at `(x, z + 3.2)` within 4 world units of its stop coordinate. On attempted collision, retain the previous position and damp speed. Use `advanceSpeed(speed, throttle, dt)` to cap forward speed at `6.1`, reverse at `-2.1`, and apply stronger coasting drag when throttle is released so the boat remains dockable. Create water, house roofs, palms, street details, colored dock lights, shelter, boat hull and passenger markers with Three.js primitives/materials. A camera follows from above/behind using damped position, except with reduced motion where it snaps or uses minimal smoothing. Rain is a bounded particle field disabled/reduced under reduced motion. `tick` integrates speed/heading and stops the boat when `paused` is true; `nearestStop` returns a stop only within 4 units of its dock; `resetToSafeWater` returns to the last valid water position or shelter dock. Allocate scene resources once and dispose geometries/materials/renderer in `dispose`.

```ts
// src/world/world.ts — spatial boundaries also used by createWorld
import type { StopId } from '../mission/types';
const HOUSE_FOOTPRINTS = [
  {cx:-18,cz:4,halfWidth:2.2,halfDepth:2.2},
  {cx:17,cz:-5,halfWidth:2.2,halfDepth:2.2},
  {cx:-3,cz:-19,halfWidth:2.2,halfDepth:2.2},
] as const;
export interface World {
  tick(dt: number, input: { throttle: number; steer: number; paused?: boolean }): void;
  nearestStop(): StopId | null; position(): { x: number; z: number };
  resetToSafeWater(): void; render(): void; dispose(): void;
}
export function clampToWater(x: number, z: number) {
  return { x: Math.max(-26, Math.min(26, x)), z: Math.max(-26, Math.min(26, z)) };
}
export function isBlocked(x: number, z: number): boolean {
  return HOUSE_FOOTPRINTS.some(({cx,cz,halfWidth,halfDepth}) =>
    Math.abs(x-cx) < halfWidth && Math.abs(z-cz) < halfDepth);
}
// Sustained throttle reaches a useful cruising speed; zero throttle applies
// stronger drag so a player can stop inside the landing interaction radius.
export function advanceSpeed(speed: number, throttle: number, dt: number): number {
  const frameTime = Math.max(0, Math.min(dt, 0.05));
  const accelerated = speed + Math.max(-1, Math.min(1, throttle)) * 5.8 * frameTime;
  const drag = throttle === 0 ? 0.94 : 0.99;
  return Math.max(-2.1, Math.min(6.1, accelerated * Math.pow(drag, frameTime * 60)));
}
```

- [ ] **Step 4: Run `npm test` and `npm run build`.** In a local dev-server view, check the camera and dock positions with a direct `createWorld` mount; both test and build should pass.

### Task 3: Game controller and interaction flow

**Files:** Create `src/game/controller.ts`, `src/game/controller.test.ts`.

**Interfaces:** Consume mission model, `World`, and an optional `Ambience` with `setEnabled(enabled:boolean)` and `dispose()`. Produce `createController(world: World, onChange: (snapshot: GameSnapshot) => void, ambience?: Ambience): GameController` with `start()`, `tick(dt)`, `interact()`, `act(action: 'board' | 'deliver' | 'unload' | 'reload')`, `toggleMap()`, `togglePause()`, `closeOverlay()`, `resetBoat()`, `toggleSound()`, `dispose()`. `GameSnapshot` contains `{mission:MissionState; overlay:'opening'|'map'|'pause'|'stop'|'epilogue'|null; nearby:StopId|null; message:string; radio:string; boat:{x:number;z:number}; soundOn:boolean}`. World receives zero throttle/steering and `paused:true` whenever an overlay is open. Controller enforces proximity for all stop actions.

- [ ] **Step 1: Write a failing controller behavior test with a minimal World fake.**

```ts
// src/game/controller.test.ts
import { expect, test, vi } from 'vitest';
import type { World } from '../world/world';
import { createController } from './controller';
test('a remote stop action cannot change mission and map pauses boat input', () => {
  const world = { tick:vi.fn(), nearestStop:()=>null, position:()=>({x:0,z:15}),
    resetToSafeWater:vi.fn(), render:vi.fn(), dispose:vi.fn() } as World;
  const game = createController(world, () => {});
  game.start(); game.act('board');
  expect(game.snapshot().mission.passengers).toBe(0);
  game.toggleMap(); game.tick(0.016);
  expect(world.tick).toHaveBeenCalledWith(0.016, {throttle:0,steer:0,paused:true});
  game.dispose();
});
```

- [ ] **Step 2: Run `npm test -- src/game/controller.test.ts`.** Expect a missing-module failure.
- [ ] **Step 3: Implement input and controller state.** Add `snapshot(): GameSnapshot` to the interface. Handle WASD/arrows, E/M/Escape with keydown/keyup, ignoring repeated E and editable targets. `start` dismisses opening. `interact` discovers a nearby house and opens its stop dialogue, or opens the shelter dialogue. `act` maps the four commands to mission actions, rejects action if not at the matching stop, publishes result messages, and opens the epilogue on completion. `tick` discovers stops in proximity and introduces remaining radio messages on a short fixed cadence without gating physical access. `toggleMap` and `togglePause` restore the previous playing state when closed; `dispose` unregisters listeners. Keep movement paused while any overlay is open. For now `toggleSound` only toggles a boolean; Task 4 connects the actual ambience.

```ts
export interface GameSnapshot {
  mission: MissionState; overlay: 'opening'|'map'|'pause'|'stop'|'epilogue'|null;
  nearby: StopId|null; message: string; radio: string; boat: {x:number;z:number}; soundOn:boolean;
}
export interface GameController {
  start():void; tick(dt:number):void; interact():void;
  act(action:'board'|'deliver'|'unload'|'reload'):void;
  toggleMap():void; togglePause():void; closeOverlay():void;
  resetBoat():void; toggleSound():void; snapshot():GameSnapshot; dispose():void;
}
// Inside createController, route model actions through a proximity check:
function canAct(action:'board'|'deliver'|'unload'|'reload', nearby:StopId|null): boolean {
  return action === 'board' || action === 'deliver'
    ? nearby !== null && nearby !== 'shelter'
    : nearby === 'shelter';
}
// The actual stop-specific action uses `nearby` as its stop; never accept a
// stop ID supplied by the UI. Ignore E/M/Escape when an editable element has focus.
```

- [ ] **Step 4: Run `npm test` and `npm run build`.** Expect capacity tests and paused-input controller test to pass. Manually ensure a keyboard event does not drive the boat while the map is open.

### Task 4: Playable interface and boot

**Files:** Create `src/ui/render.ts`, `src/ui/styles.css`, `src/audio/ambience.ts`, `README.md`; modify `src/game/controller.ts`, `src/main.ts`, `index.html`.

**Interfaces:** Consume `GameSnapshot` and `GameController`; export `createInterface(root: HTMLElement, controller: GameController): {update(snapshot:GameSnapshot):void; dispose():void}`. `main.ts` instantiates world, controller and interface, then runs the animation loop. Initial model state remains owned only by controller.

- [ ] **Step 1: Implement the page shell and accessible HTML templates.** Create a skip link, canvas container, HUD with counters and contextual `E` prompt, map/pause buttons, a `role="dialog"` overlay with `aria-labelledby` and an explicit close button, live-status region for messages/radio, and a visible WebGL-error panel. For each household, use `STOPS` story text and only show valid action buttons; keep an explanatory message for rejected actions. Render map markers in the same x/z coordinate system as `STOPS`, distinguish discovered/unresolved/completed stops, and show the boat marker. Build DOM elements with `textContent` for story/status strings to avoid HTML injection.

```ts
// src/ui/render.ts — element ownership and callback contract
import { STOPS } from '../mission/data';
import type { GameController, GameSnapshot } from '../game/controller';
export function createInterface(root: HTMLElement, controller: GameController) {
  root.innerHTML = '<a class="skip" href="#game-controls">Skip to controls</a><div id="game-controls"></div><div id="game-status" role="status" aria-live="polite"></div><div id="game-overlay"></div>';
  const controls = root.querySelector<HTMLElement>('#game-controls')!;
  const status = root.querySelector<HTMLElement>('#game-status')!;
  const overlay = root.querySelector<HTMLElement>('#game-overlay')!;
  let previousOverlay: GameSnapshot['overlay'] = null;
  let previousMission: GameSnapshot['mission'] | null = null;
  let previousNearby: GameSnapshot['nearby'] = null;
  return {
    update(snapshot: GameSnapshot) {
      if (previousMission !== snapshot.mission || previousNearby !== snapshot.nearby) {
        controls.replaceChildren();
        const summary = document.createElement('p');
        summary.textContent = `Safe ${snapshot.mission.rescued}/4 · Supplies ${snapshot.mission.delivered}/2 · Aboard ${snapshot.mission.passengers}/2 · Crates ${snapshot.mission.boatCrates}/2 · ${snapshot.nearby ? 'E: interact' : 'Follow the radio calls'}`;
        const map = document.createElement('button'); map.textContent = 'Map (M)';
        map.onclick = () => controller.toggleMap();
        const pause = document.createElement('button'); pause.textContent = 'Pause (Esc)';
        pause.onclick = () => controller.togglePause();
        controls.append(summary, map, pause);
      }
      status.textContent = [snapshot.radio, snapshot.message].filter(Boolean).join(' · ');
      if (previousOverlay !== snapshot.overlay || previousMission !== snapshot.mission) {
        const changedOverlay = previousOverlay !== snapshot.overlay;
        overlay.replaceChildren();
        if (snapshot.overlay) {
          const dialog = document.createElement('section');
          dialog.className = 'dialog'; dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'dialog-title');
          const heading = document.createElement('h2'); heading.id = 'dialog-title';
          heading.tabIndex = -1; heading.textContent = snapshot.overlay === 'stop'
            ? STOPS.find(stop => stop.id === snapshot.nearby)?.label ?? 'Nearby stop'
            : snapshot.overlay === 'epilogue' ? 'Neighbors brought to safety'
            : snapshot.overlay === 'opening' ? 'Kerala Flood Rescue' : snapshot.overlay === 'map' ? 'Request map' : 'Paused';
          const close = document.createElement('button'); close.textContent = 'Close';
          close.onclick = () => controller.closeOverlay();
          dialog.append(heading);
          if (snapshot.overlay === 'opening') {
            const intro = document.createElement('p');
            intro.textContent = 'A fictional neighborhood inspired by the 2018 Kerala floods. Use WASD or arrow keys to steer; E to dock, M for the map, Esc to pause. Bring four neighbors to shelter and deliver two crates.';
            const start = document.createElement('button'); start.textContent = 'Begin rescue';
            start.onclick = () => controller.start(); dialog.append(intro, start);
          } else if (snapshot.overlay === 'stop' && snapshot.nearby) {
            const stop = STOPS.find(item => item.id === snapshot.nearby)!;
            const story = document.createElement('p'); story.textContent = stop.story;
            dialog.append(story);
            const actions: Array<'board'|'deliver'|'unload'|'reload'> = stop.id === 'shelter'
              ? [snapshot.mission.passengers ? 'unload' : null, snapshot.mission.shelterCrates ? 'reload' : null].filter((x): x is 'unload'|'reload' => x !== null)
              : [snapshot.mission.waiting[stop.id] && snapshot.mission.passengers + snapshot.mission.waiting[stop.id] <= 2 ? 'board' : null,
                snapshot.mission.pendingSupplies.includes(stop.id) && snapshot.mission.boatCrates ? 'deliver' : null].filter((x): x is 'board'|'deliver' => x !== null);
            for (const action of actions) {
              const button = document.createElement('button'); button.textContent = action;
              button.onclick = () => controller.act(action); dialog.append(button);
            }
            if (!actions.length) {
              const reason = document.createElement('p');
              reason.textContent = stop.id !== 'shelter' && snapshot.mission.waiting[stop.id] ? 'Not enough seats. Return to the shelter first.' : 'No further action needed here.';
              dialog.append(reason);
            }
          } else if (snapshot.overlay === 'map') {
            const mapList = document.createElement('ul'); mapList.className = 'map-list';
            for (const stop of STOPS.filter(item => snapshot.mission.discovered.includes(item.id))) {
              const marker = document.createElement('li'); marker.textContent = `${stop.label} — ${stop.id === 'shelter' ? 'shelter' : `${snapshot.mission.waiting[stop.id]} waiting, ${snapshot.mission.pendingSupplies.includes(stop.id) ? 'crate needed' : 'supplies delivered or not requested'}`}`;
              marker.style.setProperty('--x', `${((stop.x + 26) / 52) * 100}%`);
              marker.style.setProperty('--z', `${((stop.z + 26) / 52) * 100}%`);
              mapList.append(marker);
            }
            const boat = document.createElement('li'); boat.textContent = 'Your boat';
            boat.style.setProperty('--x', `${((snapshot.boat.x + 26) / 52) * 100}%`);
            boat.style.setProperty('--z', `${((snapshot.boat.z + 26) / 52) * 100}%`);
            mapList.append(boat); dialog.append(mapList);
          } else if (snapshot.overlay === 'pause') {
            const help = document.createElement('p'); help.textContent = 'WASD/arrows steer · E interact · M map · Esc pause';
            const reset = document.createElement('button'); reset.textContent = 'Return boat to safe water';
            reset.onclick = () => controller.resetBoat(); dialog.append(help, reset);
            const sound = document.createElement('button'); sound.textContent = snapshot.soundOn ? 'Mute ambience' : 'Play ambience';
            sound.onclick = () => controller.toggleSound(); dialog.append(sound);
          } else if (snapshot.overlay === 'epilogue') {
            const ending = document.createElement('p');
            ending.textContent = 'Four neighbors reached the shelter and two crates reached those staying nearby. This fictional story honors the community rescue efforts during the 2018 Kerala floods.';
            dialog.append(ending);
          }
          if (snapshot.overlay !== 'epilogue') dialog.append(close);
          overlay.append(dialog);
          if (changedOverlay) heading.focus();
        }
        previousOverlay = snapshot.overlay;
        previousMission = snapshot.mission;
      }
      previousNearby = snapshot.nearby;
    },
    dispose() { controls.replaceChildren(); overlay.replaceChildren(); }
  };
}
```

- [ ] **Step 2: Style responsive HUD and overlays.** Use a deliberate monsoon palette, high-contrast text, clear focus indicators, readable type, and a max-width dialog with viewport-height scrolling. At narrow desktop widths move HUD cards into a compact column. Position `map-list` markers using `left: var(--x); top: var(--z)` within a positioned container; add unresolved supply count to its accessible text. `prefers-reduced-motion: reduce` removes nonessential CSS transitions. Do not hardcode visual labels solely into the canvas. Add a visible mute/unmute button to pause/help; initialize audio only after the opening button click (browser gesture), implement ambience with a local Web Audio filtered noise buffer and a gain node, and release it on dispose. Export `createAmbience(): {setEnabled(enabled:boolean):void; dispose():void}` from `src/audio/ambience.ts`, connect it to the controller's `toggleSound`, and expose `soundOn` in snapshots.

```css
/* src/ui/styles.css — foundational rules */
:root { color-scheme: dark; font-family: system-ui, sans-serif; }
button { min-height: 44px; min-width: 44px; cursor: pointer; }
:focus-visible { outline: 3px solid #f5d07b; outline-offset: 3px; }
.dialog { max-height: min(86vh, 760px); overflow-y: auto; }
.map-list { position: relative; min-height: 260px; list-style: none; }
.map-list li { position: absolute; left: var(--x); top: var(--z); transform: translate(-50%, -50%); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
```

- [ ] **Step 3: Wire bootstrap and useful fallback.** Change `index.html` to include sibling `<div id="scene"></div><div id="app"></div>`. Detect WebGL via a temporary canvas `getContext('webgl2') || getContext('webgl')` before constructing a renderer. On failure show a plain-language error. On success connect the renderer canvas to the page, create the controller/interface, publish snapshots on state changes, and use `requestAnimationFrame` with a fixed 1/60-second simulation step from `src/game/clock.ts`; retain elapsed time at low frame rates with a 250ms catch-up cap and render once per browser frame. `createWorld` responds to resize; page teardown disposes the loop and resources. Add `README.md` with `npm install`, `npm run dev`, `npm test`, `npm run build`, controls, and mission objective.

```ts
// src/main.ts — fallback branch
import { createWorld } from './world/world';
import { createController } from './game/controller';
import { createInterface } from './ui/render';
import './ui/styles.css';
const root = document.querySelector<HTMLElement>('#app')!;
const probe = document.createElement('canvas');
if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
  root.textContent = 'This 3D mission needs WebGL. Try an updated browser with hardware acceleration enabled.';
} else {
  const world = createWorld(document.querySelector<HTMLElement>('#scene')!, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let ui: ReturnType<typeof createInterface>;
  const game = createController(world, snapshot => ui?.update(snapshot));
  ui = createInterface(root, game);
  ui.update(game.snapshot());
  let frame = 0, last = performance.now(), active = true;
  const animate = (now: number) => {
    if (!active) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    game.tick(dt); world.render(); ui.update(game.snapshot());
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  window.addEventListener('pagehide', () => {
    active = false; cancelAnimationFrame(frame);
    game.dispose(); ui.dispose(); world.dispose();
  }, {once:true});
}
```

- [ ] **Step 4: Run `npm test` and `npm run build`, then start `npm run dev`.** In a browser, play through all four rescues and two deliveries, verify map and shelter round-trips, and check that the epilogue appears. At ~900px and ~600px viewport widths, confirm labels and dialogs remain usable. Test keyboard-only dialogue/map/pause, reduced-motion emulation, and the WebGL fallback by overriding the context probe temporarily in dev tools (do not ship the override).

### Task 5: Mission polish and end-to-end acceptance

**Files:** Modify `src/mission/data.ts`, `src/world/world.ts`, `src/ui/render.ts`, `src/ui/styles.css`, `src/main.ts`, `README.md` only where playtesting identifies gaps; add `src/mission/model.test.ts` cases for any discovered rule bugs.

**Interfaces:** Preserve all public interfaces from Tasks 1–4.

- [ ] **Step 1: Play the mission from a fresh page without using source knowledge.** Record obstacles, unreachable stops, unreadable markers, stuck states, confusing resource messages, or keyboard focus loss. Tune house/dock offsets, boat speed, camera, overlay text, and interaction radius against those observations. Verify that the story remains legible and the total play time is near 10–15 minutes for a first-time player.
- [ ] **Step 2: Check edge cases using two different routes.** Run one playthrough visiting house C before A/B and a second visiting A then shelter before B/C; in both, attempt boarding a full boat, duplicate delivery, opening map mid-motion, and reset-to-safe-water. Fix any failure with a targeted regression test for state/controller logic before changing implementation.

```ts
// Example regression if reload duplicates delivered inventory
test('reloading cannot recreate delivered crates', () => {
  let state = createMission();
  state = applyMissionAction(state, {type:'deliver', stop:'house-a'}).state;
  state = applyMissionAction(state, {type:'reload'}).state;
  expect(state.boatCrates + state.shelterCrates + state.delivered).toBe(2);
});
```

- [ ] **Step 3: Run final verification.** `npm test && npm run build`; inspect browser console for errors, verify that no external asset request is needed, inspect narrow layout and reduced-motion treatment, then update README instructions to match actual controls and behavior. A finished run must display the epilogue with rescued `4/4` and delivered `2/2`.
