// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { createMission } from '../mission/model';
import type { GameController, GameSnapshot } from '../game/controller';
import { SCENE_LAYOUT, WORLD_LIMIT } from '../world/anchors';
import { createInterface } from './render';

function setup(snapshot: GameSnapshot) {
  const root = document.createElement('div');
  document.body.append(root);
  const controller = {
    start: vi.fn(),
    tick: vi.fn(),
    interact: vi.fn(),
    act: vi.fn(),
    toggleMap: vi.fn(),
    togglePause: vi.fn(),
    closeOverlay: vi.fn(),
    resetBoat: vi.fn(),
    toggleSound: vi.fn(),
    setDriveInput: vi.fn(),
    snapshot: vi.fn(() => snapshot),
    dispose: vi.fn(),
  } as unknown as GameController;
  const view = createInterface(root, controller);
  view.update(snapshot);
  return { root, controller, view };
}

afterEach(() => document.body.replaceChildren());

test('opening screen explains the mission and starts from a labeled button', () => {
  const { root, controller, view } = setup({
    mission: createMission(), overlay: 'opening', nearby: 'shelter', message: '', radio: '',
    boat: { x: 0, z: 12.3 }, soundOn: false, dockReady: true,
  });

  expect(root.querySelector('[role="dialog"]')).not.toBeNull();
  expect(root.textContent).toContain('fictional neighborhood');
  expect(root.textContent).toContain('A/D to steer');
  root.querySelector<HTMLButtonElement>('button[data-action="start"]')?.click();
  expect(controller.start).toHaveBeenCalledOnce();
  view.dispose();
});

test('household dialogue presents real requests and invokes the chosen action', () => {
  const mission = {
    ...createMission(),
    discovered: ['shelter', 'house-a'] as GameSnapshot['mission']['discovered'],
    boatCrates: 2,
  };
  const { root, controller, view } = setup({
    mission, overlay: 'stop', nearby: 'house-a', message: '', radio: '',
    boat: { x: -18, z: 7.2 }, soundOn: false, dockReady: true,
  });

  expect(root.textContent).toContain('Two neighbors wait by the upper landing');
  expect(root.querySelector('.overlay-layer')?.classList.contains('is-landing')).toBe(true);
  root.querySelector<HTMLButtonElement>('button[data-action="board"]')?.click();
  expect(controller.act).toHaveBeenCalledWith('board');
  root.querySelector<HTMLButtonElement>('button[data-action="deliver"]')?.click();
  expect(controller.act).toHaveBeenCalledWith('deliver');
  view.dispose();
});

test('playing state removes the modal backdrop from the 3D world', () => {
  const { root, view } = setup({
    mission: createMission(), overlay: null, nearby: null, message: '', radio: '',
    boat: { x: 0, z: 12.3 }, soundOn: false, dockReady: false,
  });

  expect(root.querySelector('.overlay-layer')?.hasAttribute('hidden')).toBe(true);
  expect(root.querySelector('.overlay-layer')?.classList.contains('is-landing')).toBe(false);
  view.dispose();
});

test('opening a landing and closing it keep keyboard focus inside the game', () => {
  const mission = createMission();
  const { root, view } = setup({
    mission, overlay: null, nearby: 'house-a', message: '', radio: '',
    boat: { x: -18, z: 7.2 }, soundOn: false, dockReady: true,
  });
  root.querySelector<HTMLButtonElement>('button[data-action="interact"]')?.focus();

  view.update({
    mission, overlay: 'stop', nearby: 'house-a', message: '', radio: '',
    boat: { x: -18, z: 7.2 }, soundOn: false, dockReady: true,
  });
  expect(document.activeElement?.id).toBe('dialog-title');

  view.update({
    mission, overlay: null, nearby: 'house-a', message: '', radio: '',
    boat: { x: -18, z: 7.2 }, soundOn: false, dockReady: true,
  });
  expect((document.activeElement as HTMLElement).dataset.action).toBe('map');
  view.dispose();
});

test('HUD updates preserve focus on the active map or pause control', () => {
  const mission = createMission();
  const { root, view } = setup({
    mission, overlay: null, nearby: 'shelter', message: '', radio: '',
    boat: { x: 0, z: 12.3 }, soundOn: false, dockReady: true,
  });
  root.querySelector<HTMLButtonElement>('button[data-action="map"]')?.focus();

  view.update({
    mission, overlay: null, nearby: 'house-a', message: '', radio: '',
    boat: { x: -18, z: 7.2 }, soundOn: false, dockReady: true,
  });

  expect((document.activeElement as HTMLElement).dataset.action).toBe('map');
  view.dispose();
});

test('pause overlay reflects sound changes without losing focus', () => {
  const mission = createMission();
  const { root, view } = setup({
    mission, overlay: 'pause', nearby: 'shelter', message: '', radio: '',
    boat: { x: 0, z: 12.3 }, soundOn: false, dockReady: true,
  });
  const sound = root.querySelector<HTMLButtonElement>('button[data-action="sound"]')!;
  sound.focus();

  view.update({
    mission, overlay: 'pause', nearby: 'shelter', message: '', radio: '',
    boat: { x: 0, z: 12.3 }, soundOn: true, dockReady: true,
  });

  expect(root.querySelector('button[data-action="sound"]')?.textContent).toBe('Mute rain ambience');
  expect((document.activeElement as HTMLElement).dataset.action).toBe('sound');
  view.dispose();
});

test('a moving boat gets a slow-down cue instead of a dock action', () => {
  const { root, view } = setup({
    mission: createMission(), overlay: null, nearby: 'house-a', dockReady: false,
    message: '', radio: '', boat: { x: -18, z: 7.2 }, soundOn: false,
  });
  expect(root.querySelector('button[data-action="interact"]')).toBeNull();
  expect(root.querySelector('.interaction-prompt')?.textContent).toContain('Slow to dock');
  view.dispose();
});

test('touch drive buttons send press and release while the game is active', () => {
  const { root, controller, view } = setup({
    mission: createMission(), overlay: null, nearby: 'shelter', dockReady: true,
    message: '', radio: '', boat: { x: 0, z: 12.3 }, soundOn: false,
  });
  const forward = root.querySelector<HTMLButtonElement>('button[data-action="forward"]')!;
  expect(forward).not.toBeNull();
  forward.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  forward.dispatchEvent(new Event('pointerup', { bubbles: true }));
  expect(controller.setDriveInput).toHaveBeenNthCalledWith(1, 'forward', true);
  expect(controller.setDriveInput).toHaveBeenNthCalledWith(2, 'forward', false);
  view.dispose();
});

test('map places expanded-world dock markers inside the schematic bounds', () => {
  const mission = createMission();
  mission.discovered = ['shelter', 'house-a', 'house-b', 'house-c'];
  const { root, view } = setup({
    mission, overlay: 'map', nearby: null, dockReady: false,
    message: '', radio: '', boat: { x: -15, z: 4 }, soundOn: false,
  });
  const markers = [...root.querySelectorAll<HTMLElement>('.map-marker')];
  expect(markers).toHaveLength(4);
  for (const id of ['shelter', 'house-a', 'house-b', 'house-c'] as const) {
    const marker = markers[['shelter', 'house-a', 'house-b', 'house-c'].indexOf(id)];
    const [x, , z] = SCENE_LAYOUT[id].dock;
    expect(parseFloat(marker.style.left)).toBeCloseTo(((x + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100, 1);
    expect(parseFloat(marker.style.top)).toBeCloseTo(100 - ((z + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100, 1);
  }
  view.dispose();
});
