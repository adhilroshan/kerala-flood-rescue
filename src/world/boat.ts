import * as THREE from 'three';
import { BOAT_SLOTS } from './anchors';
import type { WorldAssets } from './assets';
import { textPlate } from './geometry';
import type { QualityProfile } from './quality';

function part(group: THREE.Group, name: string, geometry: THREE.BufferGeometry,
  material: THREE.Material, position: THREE.Vector3Tuple): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  group.add(object);
  return object;
}

function plank(group: THREE.Group, name: string, size: THREE.Vector3Tuple,
  position: THREE.Vector3Tuple, material: THREE.Material): void {
  part(group, name, new THREE.BoxGeometry(...size), material, position);
}

export function createBoat(assets: WorldAssets, _quality: QualityProfile): {
  group: THREE.Group; seats: THREE.Group[]; cargo: THREE.Group[]; forward: THREE.Vector3;
} {
  const group = new THREE.Group();
  group.name = 'rescue-boat';
  const hullPaint = new THREE.MeshStandardMaterial({ color: '#b45f3d', roughness: 0.67, side: THREE.DoubleSide });
  const interior = new THREE.MeshStandardMaterial({ color: '#423b33', roughness: 0.87 });
  const edging = new THREE.MeshStandardMaterial({ color: '#503831', roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: '#566360', metalness: 0.48, roughness: 0.5 });
  const timberMap = assets.textures.get('timber');
  const timber = new THREE.MeshStandardMaterial({ color: '#a97e59', roughness: 0.8,
    ...(timberMap ? { map: timberMap } : {}) });

  // Bow is +Z. Successive cross-sections give the hull a curved, tapered plan
  // and a keel that sits below the deck instead of a flat floating rectangle.
  const sections = [
    { z: -1.52, w: 0.30, keel: -0.03 }, { z: -1.10, w: 0.58, keel: -0.11 },
    { z: -0.4, w: 0.72, keel: -0.14 }, { z: 0.4, w: 0.73, keel: -0.14 },
    { z: 1.04, w: 0.54, keel: -0.08 }, { z: 1.62, w: 0.04, keel: 0.10 },
  ];
  const vertices: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  };
  for (let i = 0; i < sections.length - 1; i += 1) {
    const a = sections[i], b = sections[i + 1];
    for (const side of [-1, 1]) {
      const aRim = new THREE.Vector3(side * a.w, 0.49, a.z);
      const bRim = new THREE.Vector3(side * b.w, 0.49, b.z);
      const aChine = new THREE.Vector3(side * a.w * 0.60, 0.12, a.z);
      const bChine = new THREE.Vector3(side * b.w * 0.60, 0.12, b.z);
      const aKeel = new THREE.Vector3(0, a.keel, a.z);
      const bKeel = new THREE.Vector3(0, b.keel, b.z);
      triangle(aRim, bRim, aChine); triangle(bRim, bChine, aChine);
      triangle(aChine, bChine, aKeel); triangle(bChine, bKeel, aKeel);
    }
  }
  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  hullGeometry.computeVertexNormals();
  part(group, 'shaped-hull', hullGeometry, hullPaint, [0, 0, 0]);

  plank(group, 'inside-sole', [0.98, 0.09, 2.33], [0, 0.25, -0.10], interior);
  for (const side of [-1, 1]) {
    const rail = part(group, 'gunwale', new THREE.BoxGeometry(0.105, 0.12, 2.42),
      edging, [side * 0.64, 0.50, -0.18]);
    rail.rotation.y = side * 0.04;
    plank(group, 'stern-fender', [0.13, 0.19, 0.32], [side * 0.33, 0.48, -1.37], edging);
    part(group, 'rope-cleat', new THREE.CylinderGeometry(0.045, 0.045, 0.15, 8),
      metal, [side * 0.55, 0.61, 0.82]);
  }
  plank(group, 'bow-cap', [0.34, 0.09, 0.34], [0, 0.55, 1.35], timber);
  plank(group, 'rear-bench', [1.05, 0.09, 0.21], [0, 0.46, -0.93], timber);
  plank(group, 'front-bench', [1.11, 0.09, 0.23], [0, 0.46, 0.25], timber);
  plank(group, 'outboard-motor', [0.31, 0.42, 0.36], [0, 0.57, -1.57], metal);
  const tiller = part(group, 'tiller', new THREE.CylinderGeometry(0.035, 0.035, 0.64, 8),
    edging, [0.27, 0.68, -1.26]);
  tiller.rotation.z = Math.PI / 2.7;
  part(group, 'bow-navigation-light', new THREE.SphereGeometry(0.065, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#f2d59d', emissive: '#e9bb71', emissiveIntensity: 0.85 }),
    [0, 0.66, 1.42]);

  // Safety dressing: life ring, rope coil, registration marks, cushions,
  // fuel, paddle and a stern lantern for dusk readability.
  const lifeRingMat = new THREE.MeshStandardMaterial({ color: '#e8e2d2', roughness: 0.7 });
  const lifeRingBand = new THREE.MeshStandardMaterial({ color: '#c65f45', roughness: 0.7 });
  for (const [i, z] of [[0, 0.62], [1, -0.5]] as Array<[number, number]>) {
    const ring = part(group, 'life-ring', new THREE.TorusGeometry(0.16, 0.055, 8, 18),
      i === 0 ? lifeRingMat : lifeRingBand, [0.62, 0.62, z]);
    ring.rotation.y = Math.PI / 2;
  }
  for (let i = 0; i < 2; i += 1) {
    const coil = part(group, 'rope-coil', new THREE.TorusGeometry(0.14 - i * 0.02, 0.035, 6, 16),
      timber, [-0.3, 0.52 + i * 0.06, 0.95]);
    coil.rotation.x = Math.PI / 2;
  }
  const registration = new THREE.MeshBasicMaterial({ map: textPlate('RSC-18', 1.4, 0.28, '#7a3b28', '#f0e2c4') });
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.17), registration);
    plate.name = 'hull-registration';
    plate.position.set(side * 0.66, 0.32, -0.15);
    plate.rotation.y = side * Math.PI / 2;
    group.add(plate);
  }
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#3f6b66', roughness: 0.9 });
  plank(group, 'bench-cushion', [0.9, 0.06, 0.18], [0, 0.53, -0.93], cushionMat);
  plank(group, 'bench-cushion', [0.95, 0.06, 0.2], [0, 0.53, 0.25], cushionMat);
  plank(group, 'fuel-tank', [0.34, 0.26, 0.3], [-0.28, 0.42, -1.2],
    new THREE.MeshStandardMaterial({ color: '#8a2f28', roughness: 0.55, metalness: 0.25 }));
  const paddleShaft = part(group, 'paddle', new THREE.CylinderGeometry(0.03, 0.03, 1.1, 7),
    timber, [0.42, 0.55, -0.5]);
  paddleShaft.rotation.z = Math.PI / 2.2;
  plank(group, 'paddle', [0.16, 0.04, 0.4], [0.62, 0.5, 0.15], timber);
  part(group, 'stern-lantern-pole', new THREE.CylinderGeometry(0.03, 0.04, 0.9, 7),
    edging, [-0.5, 0.95, -1.45]);
  part(group, 'stern-lantern', new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#ffe3ae', emissive: '#e8a94e', emissiveIntensity: 1.8 }),
    [-0.5, 1.44, -1.45]);

  const makeAnchors = (name: string, slots: THREE.Vector3Tuple[]): THREE.Group[] => slots.map((location, index) => {
    const anchor = new THREE.Group();
    anchor.name = `${name}-${index}`;
    anchor.position.set(...location);
    group.add(anchor);
    return anchor;
  });
  return {
    group, seats: makeAnchors('seat', BOAT_SLOTS.seats),
    cargo: makeAnchors('cargo-slot', BOAT_SLOTS.cargo),
    forward: new THREE.Vector3(0, 0, 1),
  };
}
