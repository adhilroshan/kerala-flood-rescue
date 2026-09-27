import * as THREE from 'three';
import { expect, test } from 'vitest';
import { applyMissionAction, createMission } from '../mission/model';
import { SCENE_LAYOUT } from './anchors';
import { createVisualActors } from './actors';

test('waiting neighbors, passengers, and crates follow mission state', () => {
  const scene = new THREE.Scene();
  const boat = new THREE.Group();
  const visuals = createVisualActors(scene, boat);
  let mission = createMission();

  expect(scene.getObjectByName('waiting-house-a-0')?.visible).toBe(true);
  expect(scene.getObjectByName('waiting-house-a-1')?.visible).toBe(true);
  expect(scene.getObjectByName('waiting-house-a-0')!.position.y).toBe(SCENE_LAYOUT['house-a'].floorY);
  expect(scene.getObjectByName('waiting-house-a-0')!.position.z).toBe(SCENE_LAYOUT['house-a'].waiting[0][2]);
  expect(Math.abs(scene.getObjectByName('waiting-house-a-0')!.position.x - scene.getObjectByName('waiting-house-a-1')!.position.x)).toBeGreaterThan(1.9);
  const first = scene.getObjectByName('waiting-house-a-0')!.position;
  const second = scene.getObjectByName('waiting-house-a-1')!.position;
  expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThan(1.4);
  expect(scene.getObjectByName('volunteer-0')?.visible).toBe(true);
  expect(scene.getObjectByName('waiting-house-a-0')!.getObjectByName('raised-hand')?.position.y).toBeGreaterThan(1.3);
  expect(scene.getObjectByName('volunteer-1')?.visible).toBe(true);
  expect(scene.getObjectByName('safe-0')?.visible).toBe(false);
  expect(scene.getObjectByName('shelter-crate-0')?.visible).toBe(true);
  expect(scene.getObjectByName('volunteer-0')!.position.z).toBeGreaterThan(16);
  expect(scene.getObjectByName('volunteer-0')!.position.x).toBeGreaterThan(-2);
  expect(boat.getObjectByName('passenger-0')?.visible).toBe(false);
  expect(boat.getObjectByName('crate-0')?.visible).toBe(false);

  mission = applyMissionAction(mission, { type: 'reload' }).state;
  mission = applyMissionAction(mission, { type: 'board', stop: 'house-a' }).state;
  mission = applyMissionAction(mission, { type: 'deliver', stop: 'house-a' }).state;
  visuals.update(mission);

  expect(scene.getObjectByName('waiting-house-a-0')?.visible).toBe(false);
  expect(scene.getObjectByName('waiting-house-a-1')?.visible).toBe(false);
  expect(boat.getObjectByName('passenger-0')?.visible).toBe(true);
  expect(boat.getObjectByName('passenger-1')?.visible).toBe(true);
  expect(boat.getObjectByName('crate-0')?.visible).toBe(true);
  expect(boat.getObjectByName('crate-1')?.visible).toBe(false);
  expect(scene.getObjectByName('delivered-house-a')?.visible).toBe(true);

  mission = applyMissionAction(mission, { type: 'unload' }).state;
  visuals.update(mission);
  expect(boat.getObjectByName('passenger-0')?.visible).toBe(false);
  expect(scene.getObjectByName('safe-0')?.visible).toBe(true);
});

test('people have grounded feet, natural head proportions and boat passengers fit on seats', () => {
  const scene = new THREE.Scene();
  const boat = new THREE.Group();
  createVisualActors(scene, boat);
  const resident = scene.getObjectByName('waiting-house-a-0')!;
  const head = resident.getObjectByName('head')!;
  const torso = resident.getObjectByName('torso')!;
  const feet = resident.getObjectByName('shoes')!;
  const personBounds = new THREE.Box3().setFromObject(resident);
  const headBounds = new THREE.Box3().setFromObject(head);
  const feetBounds = new THREE.Box3().setFromObject(feet);
  expect(personBounds.min.y).toBeCloseTo(resident.position.y, 1);
  expect(headBounds.min.y).toBeGreaterThan(resident.position.y + 1.1);
  expect(headBounds.max.y - headBounds.min.y).toBeLessThan((personBounds.max.y - personBounds.min.y) * 0.3);
  expect((torso as THREE.Mesh).geometry).toBeInstanceOf(THREE.LatheGeometry);
  expect(new THREE.Box3().setFromObject(torso).getSize(new THREE.Vector3()).x)
    .toBeGreaterThan(headBounds.getSize(new THREE.Vector3()).x);
  expect(feetBounds.min.y).toBeGreaterThanOrEqual(resident.position.y - 0.05);
  expect(boat.getObjectByName('passenger-0')?.parent?.name).toBe('seat-0');
  expect(boat.getObjectByName('passenger-0')?.getObjectByName('relief-vest')).toBeDefined();
  expect(boat.getObjectByName('crate-0')?.getObjectByName('crate-stencil')).toBeDefined();
  expect(resident.position.y).toBe(SCENE_LAYOUT['house-a'].floorY);
});
