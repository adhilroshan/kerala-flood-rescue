import { expect, test } from 'vitest';
import { SCENE_LAYOUT } from './anchors';
import {
  advanceHeading, advanceSpeed, clampToWater, initialRescueHeading, isBlocked, isDockReady,
  SUBMERGED_STREET_EDGE_OPACITY, SUBMERGED_STREET_OPACITY,
} from './world';

test('boat stays inside the playable water and cannot cross a house footprint', () => {
  expect(clampToWater(60, -60)).toEqual({ x: 60, z: -60 });
  expect(clampToWater(120, -120)).toEqual({ x: 70, z: -70 });
  expect(isBlocked(SCENE_LAYOUT['house-a'].building[0], SCENE_LAYOUT['house-a'].building[2])).toBe(true);
  expect(isBlocked(0, 15)).toBe(false);
});

test('the offset dock remains navigable and the front stair is a solid obstruction', () => {
  for (const id of ['house-a', 'house-b', 'house-c'] as const) {
    const layout = SCENE_LAYOUT[id];
    const [dockX, , dockZ] = layout.dock;
    expect(isBlocked(dockX, dockZ, 0.45)).toBe(false);
    expect(Math.hypot(dockX - layout.building[0], dockZ - layout.building[2])).toBeLessThanOrEqual(4);
    expect(isBlocked(layout.building[0] + 1.12, layout.building[2] + 4.68, 0.25)).toBe(true);
  }
});

test('the shelter-to-canal approach corridor avoids the household stairs and stays in docking range', () => {
  const dock = SCENE_LAYOUT['house-a'].dock;
  const heading = initialRescueHeading(0, 12.3);
  const approachDistance = Math.hypot(dock[0] + 3.7, dock[2] - 12.3);
  const approach = {
    x: Math.sin(heading) * approachDistance,
    z: 12.3 + Math.cos(heading) * approachDistance,
  };
  expect(Math.hypot(approach.x - dock[0], approach.z - dock[2])).toBeCloseTo(3.7);
  for (let step = 1; step <= 40; step += 1) {
    const distance = (approachDistance * step) / 40;
    const x = Math.sin(heading) * distance;
    const z = 12.3 + Math.cos(heading) * distance;
    expect(isBlocked(x, z, 0.45), `approach blocked at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
  }
});

test('submerged street paint remains visible through floodwater', () => {
  expect(SUBMERGED_STREET_OPACITY).toBeGreaterThanOrEqual(0.5);
  expect(SUBMERGED_STREET_EDGE_OPACITY).toBeGreaterThanOrEqual(0.4);
});

test('boat reaches useful cruising speed under sustained throttle', () => {
  let speed = 0;
  for (let frame = 0; frame < 60; frame += 1) speed = advanceSpeed(speed, 1, 1 / 60);

  expect(speed).toBeGreaterThan(4);
  expect(speed).toBeLessThanOrEqual(6.1);
});

test('boat slows promptly after release so the player can dock', () => {
  let speed = 6.1;
  for (let frame = 0; frame < 60; frame += 1) speed = advanceSpeed(speed, 0, 1 / 60);

  expect(speed).toBeLessThan(1);
});

test('rudder responds while moving and reverses direction when backing up', () => {
  const forward = advanceHeading(0, 1, 4, 0.5);
  const reverse = advanceHeading(0, 1, -2, 0.5);

  expect(forward).toBeGreaterThan(0.35);
  expect(reverse).toBeLessThan(-0.2);
  expect(advanceHeading(0, 1, 0, 0.5)).toBeLessThan(forward);
});

test('positive heading turn moves the boat nose toward screen-left in the +Z follow camera', () => {
  const turned = advanceHeading(0, 1, 4, 0.5);
  const screenRightX = -1;
  const forwardX = Math.sin(turned);
  expect(forwardX * screenRightX).toBeLessThan(0);
});

test('initial route heading points from the shelter launch to a clear point beside the canal dock', () => {
  const heading = initialRescueHeading(0, 12.3);
  const dock = SCENE_LAYOUT['house-a'].dock;
  const routeX = dock[0] + 3.7;
  const routeZ = dock[2] - 12.3;
  expect(Math.sin(heading)).toBeCloseTo(routeX / Math.hypot(routeX, routeZ));
  expect(Math.cos(heading)).toBeLessThan(0);
});

test('docking requires a close, slow approach but allows a stationary boat', () => {
  expect(isDockReady(2.5, 0)).toBe(true);
  expect(isDockReady(2.5, 2.5)).toBe(false);
  expect(isDockReady(4.5, 0)).toBe(false);
});
