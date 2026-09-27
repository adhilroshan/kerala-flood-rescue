import { expect, test } from 'vitest';
import { STOPS } from '../mission/data';
import { BACKGROUND_HOUSES, BOAT_SLOTS, SCENE_LAYOUT, WORLD_LIMIT } from './anchors';

test('household docks remain reachable while waiting people stand on dry platforms', () => {
  for (const stop of STOPS) {
    const layout = SCENE_LAYOUT[stop.id];
    expect(Math.hypot(layout.dock[0] - stop.x, layout.dock[2] - stop.z)).toBeLessThanOrEqual(4);
    if (stop.id === 'shelter') continue;
    expect(layout.building[0]).toBe(stop.x);
    expect(layout.building[2]).toBe(stop.z);
    expect(layout.waiting).toHaveLength(stop.evacuees);
    expect(layout.dock[2] - stop.z).toBeGreaterThan(2.2);
    for (const [x, y, z] of layout.waiting) {
      expect(Math.abs(x - stop.x)).toBeLessThan(2);
      expect(y).toBeCloseTo(layout.floorY);
      expect(z - stop.z).toBeGreaterThan(1.5);
      expect(z - stop.z).toBeLessThan(4.1);
      expect(y).toBeGreaterThan(1.2);
    }
  }
});

test('household destinations are spread farther from the shelter across the expanded neighborhood', () => {
  const shelter = STOPS.find((stop) => stop.id === 'shelter')!;
  for (const stop of STOPS.filter((item) => item.id !== 'shelter')) {
    expect(Math.hypot(stop.x - shelter.x, stop.z - shelter.z)).toBeGreaterThan(40);
  }
});

test('background village props stay outside mission docks and inside world bounds', () => {
  expect(BACKGROUND_HOUSES.length).toBeGreaterThanOrEqual(10);
  for (const house of BACKGROUND_HOUSES) {
    expect(Math.abs(house.x)).toBeLessThanOrEqual(WORLD_LIMIT);
    expect(Math.abs(house.z)).toBeLessThanOrEqual(WORLD_LIMIT);
    for (const stop of STOPS) {
      const layout = SCENE_LAYOUT[stop.id];
      expect(Math.hypot(house.x - layout.dock[0], house.z - layout.dock[2])).toBeGreaterThan(6);
    }
  }
});

test('seats and cargo slots fit the narrow boat deck', () => {
  expect(BOAT_SLOTS.seats).toHaveLength(2);
  expect(BOAT_SLOTS.cargo).toHaveLength(2);
  for (const [x, y, z] of [...BOAT_SLOTS.seats, ...BOAT_SLOTS.cargo]) {
    expect(Math.abs(x)).toBeLessThan(0.55);
    expect(Math.abs(z)).toBeLessThan(1);
    expect(y).toBeGreaterThan(0.35);
  }
});
