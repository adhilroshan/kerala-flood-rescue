import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createBoat } from './boat';
import { BOAT_SLOTS } from './anchors';
import { chooseQuality } from './quality';

test('rescue boat has a bow-forward hull and seats/cargo inside its gunwales', () => {
  const boat = createBoat({ models: new Map(), textures: new Map() }, chooseQuality(false, false));
  expect(boat.forward.toArray()).toEqual([0, 0, 1]);
  expect(boat.seats).toHaveLength(2);
  expect(boat.cargo).toHaveLength(2);
  const hull = boat.group.getObjectByName('shaped-hull');
  expect(hull).toBeInstanceOf(THREE.Mesh);
  const bounds = new THREE.Box3().setFromObject(hull!);
  expect(bounds.max.z).toBeGreaterThan(1.2);
  expect(bounds.min.z).toBeLessThan(-1.2);
  expect(bounds.min.y).toBeLessThan(0.05);
  for (const [index, anchor] of boat.seats.entries()) {
    expect(anchor.position.toArray()).toEqual(BOAT_SLOTS.seats[index]);
    expect(bounds.containsPoint(anchor.position.clone().setY(0.2))).toBe(true);
  }
});

test('rescue boat carries safety dressing with named, inspectable parts', () => {
  const boat = createBoat({ models: new Map(), textures: new Map() }, chooseQuality(false, false));
  for (const name of ['life-ring', 'rope-coil', 'hull-registration', 'stern-lantern', 'fuel-tank', 'paddle']) {
    expect(boat.group.getObjectByName(name)).toBeDefined();
  }
});
