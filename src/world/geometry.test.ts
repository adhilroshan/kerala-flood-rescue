import * as THREE from 'three';
import { expect, test } from 'vitest';
import { SCENE_LAYOUT } from './anchors';
import { createFarHouse, createHouse, createPalm, type BuildingPalette } from './geometry';

const material = new THREE.MeshStandardMaterial();
const palette: BuildingPalette = {
  plaster: material, shadow: material, roof: material, roofLight: material,
  timber: material, glass: material, leaf: material, leafLight: material,
};

test('house roof meets its gable and waiting platform is supported', () => {
  const scene = new THREE.Scene();
  const layout = SCENE_LAYOUT['house-a'];
  const house = createHouse(scene, layout.building[0], layout.building[2], palette, 0);
  house.updateMatrixWorld(true);
  const gable = house.getObjectByName('front-gable');
  const roof = house.getObjectByName('roof-slope-left');
  const platform = house.getObjectByName('waiting-platform');
  const supports = house.getObjectByName('veranda-supports');
  expect(gable).toBeDefined();
  expect(roof).toBeDefined();
  expect(platform).toBeDefined();
  expect(supports?.children.length).toBeGreaterThanOrEqual(4);
  const floodMarks = house.getObjectsByProperty('name', 'flood-line-stain');
  expect(floodMarks.length).toBeGreaterThanOrEqual(4);
  expect(floodMarks.every((mark) => mark.position.y < layout.floorY - 0.8)).toBe(true);
  const roofBounds = new THREE.Box3().setFromObject(roof!);
  const gableBounds = new THREE.Box3().setFromObject(gable!);
  expect(Math.abs(roofBounds.max.y - gableBounds.max.y)).toBeLessThan(0.24);
  const platformBounds = new THREE.Box3().setFromObject(platform!);
  for (const [x, y, z] of layout.waiting) {
    expect(platformBounds.containsPoint(new THREE.Vector3(x, y - 0.02, z))).toBe(true);
  }
});

test('palm canopy droops into broad fronds rather than upright cones', () => {
  const palm = createPalm(new THREE.Scene(), 0, 0, 1, palette);
  const canopy = palm.getObjectByName('palm-fronds') as THREE.Mesh | undefined;
  expect(canopy).toBeDefined();
  expect(canopy!.geometry).toBeInstanceOf(THREE.BufferGeometry);
  const bounds = new THREE.Box3().setFromObject(canopy!);
  expect(bounds.max.x - bounds.min.x).toBeGreaterThan(4);
  expect(bounds.max.z - bounds.min.z).toBeGreaterThan(4);
  expect(bounds.min.y).toBeLessThan(4);
  expect(bounds.max.y).toBeLessThan(5.4);
});

test('background houses use a simplified LOD with a waterline band and no shadow casting', () => {
  const scene = new THREE.Scene();
  const far = createFarHouse(scene, 10, 10, palette, 1);
  let meshes = 0;
  far.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes += 1;
      expect(object.castShadow).toBe(false);
    }
  });
  expect(meshes).toBeLessThanOrEqual(10);
  expect(far.getObjectByName('far-waterline')).toBeDefined();
  expect(far.getObjectByName('far-roof')).toBeDefined();
});

test('mission houses carry occupancy dressing that background houses lack', () => {
  const scene = new THREE.Scene();
  const house = createHouse(scene, 0, 0, palette, 0, { dressed: true });
  expect(house.getObjectByName('porch-lamp')).toBeDefined();
  expect(house.getObjectByName('bunting')).toBeDefined();
  const plain = createHouse(scene, 20, 0, palette, 0);
  expect(plain.getObjectByName('bunting')).toBeUndefined();
});

test('all three households have finished roof assemblies and distinct local character', () => {
  const scene = new THREE.Scene();
  const houses = [0, 1, 2].map((variation) => createHouse(scene, variation * 10, 0, palette, variation));
  for (const house of houses) {
    expect(house.getObjectByName('front-gable')).toBeDefined();
    expect(house.getObjectByName('back-gable')).toBeDefined();
    expect(house.getObjectByName('ridge-tiles')).toBeDefined();
    expect(house.getObjectByName('front-door')).toBeDefined();
    expect(house.getObjectsByProperty('name', 'window-glass').length).toBe(2);
    expect(house.getObjectsByProperty('name', 'eave-gutter').length).toBe(2);
  }
  const roofColors = houses.map((house) => {
    const roof = house.getObjectByName('roof-slope-left') as THREE.Mesh;
    return (roof.material as THREE.MeshStandardMaterial).color.getHexString();
  });
  expect(new Set(roofColors).size).toBe(3);
});
