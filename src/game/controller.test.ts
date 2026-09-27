import { afterEach, expect, test, vi } from 'vitest';
import type { World } from '../world/world';
import { createController } from './controller';

const eventHandlers = new Map<string, Set<EventListener>>();
const fakeWindow = {
  addEventListener: vi.fn((type: string, listener: EventListener) => {
    const handlers = eventHandlers.get(type) ?? new Set<EventListener>();
    handlers.add(listener);
    eventHandlers.set(type, handlers);
  }),
  removeEventListener: vi.fn((type: string, listener: EventListener) => eventHandlers.get(type)?.delete(listener)),
  dispatch(type: string, event: Event): void {
    for (const listener of eventHandlers.get(type) ?? []) listener(event);
  },
};

afterEach(() => {
  eventHandlers.clear();
  vi.unstubAllGlobals();
});

function keyboardEvent(key: string): KeyboardEvent {
  return Object.assign(new Event('keydown'), { key, repeat: false }) as KeyboardEvent;
}

test('a remote stop action cannot change mission and map pauses boat input', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const world = {
    tick: vi.fn(),
    setMission: vi.fn(),
    dockReady: () => true,
    nearestStop: () => null,
    position: () => ({ x: 0, z: 12.3 }),
    resetToSafeWater: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});

  game.start();
  game.act('board');
  expect(game.snapshot().mission.passengers).toBe(0);

  fakeWindow.dispatch('keydown', keyboardEvent('w'));
  fakeWindow.dispatch('keydown', keyboardEvent('m'));
  game.tick(0.016);
  expect(world.tick).toHaveBeenCalledWith(0.016, { throttle: 0, steer: 0, paused: true });
  game.closeOverlay();
  game.tick(0.016);
  expect(world.tick).toHaveBeenLastCalledWith(0.016, { throttle: 1, steer: 0, paused: false });

  game.dispose();
  expect(fakeWindow.removeEventListener).toHaveBeenCalledTimes(3);
  expect(eventHandlers.get('blur')?.size).toBe(0);
});

test('docking discovers a household and boards its whole party', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  let nearby: ReturnType<World['nearestStop']> = 'house-a';
  const world = {
    tick: vi.fn(),
    setMission: vi.fn(),
    dockReady: () => true,
    nearestStop: () => nearby,
    position: () => ({ x: -18, z: 7.2 }),
    resetToSafeWater: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});

  game.start();
  game.interact();
  expect(game.snapshot().mission.discovered).toContain('house-a');
  game.act('board');
  expect(game.snapshot().mission.passengers).toBe(2);
  expect(game.snapshot().mission.waiting['house-a']).toBe(0);
  expect(world.setMission).toHaveBeenLastCalledWith(game.snapshot().mission);

  nearby = null;
  game.act('deliver');
  expect(game.snapshot().mission.delivered).toBe(0);
  game.dispose();
});

test('opening a stop already discovered by proximity does not show a rejected-discovery message', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const world = {
    tick: vi.fn(),
    setMission: vi.fn(),
    dockReady: () => true,
    nearestStop: () => 'house-a' as const,
    position: () => ({ x: -18, z: 7.2 }),
    resetToSafeWater: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});

  game.start();
  game.tick(0.016);
  game.interact();
  expect(game.snapshot().mission.discovered).toContain('house-a');
  expect(game.snapshot().message).not.toBe('Already on the map.');
  game.dispose();
});

test('radio calls reveal requests on the map in a fixed order', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const world = {
    tick: vi.fn(),
    setMission: vi.fn(),
    dockReady: () => true,
    nearestStop: () => 'shelter' as const,
    position: () => ({ x: 0, z: 12.3 }),
    resetToSafeWater: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});
  game.start();
  for (let frame = 0; frame < 72; frame += 1) game.tick(0.05);

  expect(game.snapshot().radio).toContain('near the canal');
  expect(game.snapshot().mission.discovered).toContain('house-a');
  game.dispose();
});

test('completed mission summary can be dismissed without resetting mission results', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  let nearby: ReturnType<World['nearestStop']> = 'shelter';
  const world = {
    tick: vi.fn(),
    setMission: vi.fn(),
    dockReady: () => true,
    nearestStop: () => nearby,
    position: () => ({ x: 0, z: 12.3 }),
    resetToSafeWater: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});

  game.start();
  game.act('reload');
  nearby = 'house-a';
  game.interact(); game.act('deliver'); game.act('board');
  nearby = 'shelter'; game.act('unload');
  nearby = 'house-b'; game.interact(); game.act('deliver'); game.act('board');
  nearby = 'house-c'; game.interact(); game.act('board');
  nearby = 'shelter'; game.act('unload');

  expect(game.snapshot().overlay).toBe('epilogue');
  game.closeOverlay();
  expect(game.snapshot().overlay).toBeNull();
  expect(game.snapshot().mission).toMatchObject({ rescued: 4, delivered: 2, complete: true });
  game.dispose();
});

test('sound controls delegate to ambience and dispose it with the controller', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const ambience = { setEnabled: vi.fn(), dispose: vi.fn() };
  const world = {
    tick: vi.fn(),
    setMission: vi.fn(),
    dockReady: () => true,
    nearestStop: () => 'shelter' as const,
    position: () => ({ x: 0, z: 12.3 }),
    resetToSafeWater: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {}, ambience);

  game.toggleSound();
  expect(ambience.setEnabled).toHaveBeenCalledWith(true);
  game.toggleSound();
  expect(ambience.setEnabled).toHaveBeenLastCalledWith(false);
  game.dispose();
  expect(ambience.dispose).toHaveBeenCalledOnce();
});

test('a fast approach cannot open a landing until the boat slows', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  let ready = false;
  const world = {
    tick: vi.fn(), setMission: vi.fn(), dockReady: () => ready,
    nearestStop: () => 'house-a' as const,
    position: () => ({ x: -18, z: 7.2 }), resetToSafeWater: vi.fn(),
    render: vi.fn(), dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});
  game.start();
  game.interact();
  expect(game.snapshot().overlay).toBeNull();
  expect(game.snapshot().message).toContain('Slow');

  ready = true;
  game.interact();
  expect(game.snapshot().overlay).toBe('stop');
  game.dispose();
});

test('opening a landing clears a stale radio-map status from the landing story', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const world = {
    tick: vi.fn(), setMission: vi.fn(), dockReady: () => true,
    nearestStop: () => 'shelter' as const,
    position: () => ({ x: 0, z: 12.3 }), resetToSafeWater: vi.fn(),
    render: vi.fn(), dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});
  game.start();
  for (let frame = 0; frame < 72; frame += 1) game.tick(0.05);
  expect(game.snapshot().message).toContain('added to the map');

  game.interact();
  expect(game.snapshot().message).toBe('');
  game.dispose();
});

test('holding touch throttle and steering drives the boat until release', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const world = {
    tick: vi.fn(), setMission: vi.fn(), dockReady: () => false,
    nearestStop: () => null, position: () => ({ x: 0, z: 12.3 }),
    resetToSafeWater: vi.fn(), render: vi.fn(), dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});
  game.start();
  game.setDriveInput('forward', true);
  game.setDriveInput('left', true);
  game.tick(0.016);
  expect(world.tick).toHaveBeenLastCalledWith(0.016, { throttle: 1, steer: 1, paused: false });

  game.setDriveInput('left', false);
  game.setDriveInput('right', true);
  game.tick(0.016);
  expect(world.tick).toHaveBeenLastCalledWith(0.016, { throttle: 1, steer: -1, paused: false });

  game.setDriveInput('forward', false);
  game.setDriveInput('right', false);
  game.tick(0.016);
  expect(world.tick).toHaveBeenLastCalledWith(0.016, { throttle: 0, steer: 0, paused: false });
  game.dispose();
});

test('keyboard left/right arrows follow their on-screen direction', () => {
  vi.stubGlobal('window', fakeWindow as unknown as Window);
  const world = {
    tick: vi.fn(), setMission: vi.fn(), dockReady: () => false,
    nearestStop: () => null, position: () => ({ x: 0, z: 12.3 }),
    resetToSafeWater: vi.fn(), render: vi.fn(), dispose: vi.fn(),
  } as World;
  const game = createController(world, () => {});
  game.start();

  fakeWindow.dispatch('keydown', keyboardEvent('ArrowLeft'));
  game.tick(0.016);
  expect(world.tick).toHaveBeenLastCalledWith(0.016, { throttle: 0, steer: 1, paused: false });

  fakeWindow.dispatch('keyup', Object.assign(new Event('keyup'), { key: 'ArrowLeft' }));
  fakeWindow.dispatch('keydown', keyboardEvent('ArrowRight'));
  game.tick(0.016);
  expect(world.tick).toHaveBeenLastCalledWith(0.016, { throttle: 0, steer: -1, paused: false });
  game.dispose();
});
