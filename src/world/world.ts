import * as THREE from 'three';
import { STOPS } from '../mission/data';
import type { MissionState, StopId } from '../mission/types';
import { createVisualActors } from './actors';
import type { WorldAssets } from './assets';
import { BACKGROUND_HOUSES, SCENE_LAYOUT, WORLD_LIMIT } from './anchors';
import { createBoat } from './boat';
import { createFarHouse, createHouse, createPalm, textPlate, type BuildingPalette } from './geometry';
import { chooseQuality } from './quality';

const INTERACTION_RADIUS = 4;
export const SUBMERGED_STREET_OPACITY = 0.52;
export const SUBMERGED_STREET_EDGE_OPACITY = 0.46;
const HOUSE_FOOTPRINTS = Object.entries(SCENE_LAYOUT)
  .filter(([id]) => id !== 'shelter')
  .map(([, layout]) => ({ cx: layout.building[0], cz: layout.building[2], halfWidth: 2.2, halfDepth: 2.2 }));
const STAIR_FOOTPRINTS = Object.entries(SCENE_LAYOUT)
  .filter(([id]) => id !== 'shelter')
  .map(([, layout]) => ({ cx: layout.building[0] + 1.12, cz: layout.building[2] + 4.68, halfWidth: 0.5, halfDepth: 1.35 }));
const BACKGROUND_FOOTPRINTS = BACKGROUND_HOUSES
  .map(({ x, z }) => ({ cx: x, cz: z, halfWidth: 2.2, halfDepth: 2.2 }));

export interface RendererDiagnostics {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface World {
  tick(dt: number, input: { throttle: number; steer: number; paused?: boolean }): void;
  setMission(state: MissionState): void;
  nearestStop(): StopId | null;
  dockReady(): boolean;
  position(): { x: number; z: number };
  resetToSafeWater(): void;
  render(): void;
  dispose(): void;
  diagnostics?(): RendererDiagnostics;
}

export function clampToWater(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, x)),
    z: Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, z)),
  };
}

export function isBlocked(x: number, z: number, radius = 0): boolean {
  return [...HOUSE_FOOTPRINTS, ...STAIR_FOOTPRINTS, ...BACKGROUND_FOOTPRINTS].some(({ cx, cz, halfWidth, halfDepth }) =>
    Math.abs(x - cx) < halfWidth + radius && Math.abs(z - cz) < halfDepth + radius,
  );
}

export function advanceSpeed(speed: number, throttle: number, dt: number): number {
  const frameTime = Math.max(0, Math.min(dt, 0.05));
  const accelerated = speed + THREE.MathUtils.clamp(throttle, -1, 1) * 5.8 * frameTime;
  const drag = throttle === 0 ? 0.94 : 0.99;
  return THREE.MathUtils.clamp(accelerated * Math.pow(drag, frameTime * 60), -2.1, 6.1);
}

export function advanceHeading(heading: number, steer: number, speed: number, dt: number): number {
  const rudder = 0.28 + Math.min(Math.abs(speed), 6.1) * 0.19;
  return heading + THREE.MathUtils.clamp(steer, -1, 1) * rudder * Math.max(0, dt) * (speed < -0.05 ? -1 : 1);
}

export function headingTowards(x: number, z: number, targetX: number, targetZ: number): number {
  return Math.atan2(targetX - x, targetZ - z);
}

export function initialRescueHeading(x: number, z: number): number {
  const [dockX, , dockZ] = SCENE_LAYOUT['house-a'].dock;
  return headingTowards(x, z, dockX + 3.7, dockZ);
}

export function isDockReady(distance: number, speed: number): boolean {
  return distance <= INTERACTION_RADIUS && Math.abs(speed) <= 1.45;
}

function material(color: THREE.ColorRepresentation, roughness = 0.8): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function addRoad(scene: THREE.Scene, material: THREE.Material, x: number, z: number, width: number, depth: number, rotation = 0): void {
  const path = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = rotation;
  path.position.set(x, -0.11, z);
  scene.add(path);
}

function makeBuildingPalette(assets: WorldAssets): BuildingPalette {
  const plasterMap = assets.textures.get('plaster');
  if (plasterMap) plasterMap.repeat.set(2.5, 1.4);
  const plasterNormal = assets.textures.get('plasterNormal');
  if (plasterNormal) plasterNormal.repeat.set(2.5, 1.4);
  const roofMap = assets.textures.get('roof');
  if (roofMap) roofMap.repeat.set(2, 1.5);
  const roofNormal = assets.textures.get('roofNormal');
  if (roofNormal) roofNormal.repeat.set(2, 1.5);
  const timberMap = assets.textures.get('timber');
  if (timberMap) timberMap.repeat.set(2, 1);
  const timberNormal = assets.textures.get('timberNormal');
  if (timberNormal) timberNormal.repeat.set(2, 1);
  if (plasterNormal) plasterNormal.channel = 0;
  const plasterMaterial = new THREE.MeshStandardMaterial({ color: '#c7bda6', roughness: 0.96,
    ...(plasterMap ? { map: plasterMap } : {}), ...(plasterNormal ? { normalMap: plasterNormal } : {}) });
  const shadowMaterial = new THREE.MeshStandardMaterial({ color: '#9fa99c', roughness: 0.98,
    ...(plasterMap ? { map: plasterMap } : {}), ...(plasterNormal ? { normalMap: plasterNormal } : {}) });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#b16a4d', roughness: 0.91,
    ...(roofMap ? { map: roofMap } : {}), ...(roofNormal ? { normalMap: roofNormal } : {}) });
  const roofLightMaterial = new THREE.MeshStandardMaterial({ color: '#8a4937', roughness: 0.92,
    ...(roofMap ? { map: roofMap } : {}), ...(roofNormal ? { normalMap: roofNormal } : {}) });
  const timberMaterial = new THREE.MeshStandardMaterial({ color: '#917456', roughness: 0.87,
    ...(timberMap ? { map: timberMap } : {}), ...(timberNormal ? { normalMap: timberNormal } : {}) });
  if (plasterNormal) {
    plasterMaterial.normalScale.set(0.24, 0.24);
    shadowMaterial.normalScale.set(0.24, 0.24);
  }
  if (roofNormal) {
    roofMaterial.normalScale.set(0.4, 0.4);
    roofLightMaterial.normalScale.set(0.4, 0.4);
  }
  if (timberNormal) timberMaterial.normalScale.set(0.32, 0.32);
  return {
    plaster: plasterMaterial,
    shadow: shadowMaterial,
    roof: roofMaterial,
    roofLight: roofLightMaterial,
    timber: timberMaterial,
    glass: new THREE.MeshStandardMaterial({ color: '#416c71', roughness: 0.3, emissive: '#23474b', emissiveIntensity: 0.3 }),
    leaf: material('#315e49'),
    leafLight: material('#4e7e5b'),
  };
}

function addShelter(scene: THREE.Scene, palette: BuildingPalette, warmLight: THREE.PointLight): void {
  const shelter = new THREE.Group();
  shelter.position.set(...SCENE_LAYOUT.shelter.building);
  const timber = palette.timber as THREE.MeshStandardMaterial;
  const deck = new THREE.MeshStandardMaterial({ color: '#957151', map: timber.map, normalMap: timber.normalMap, roughness: 0.9 });
  const canvas = new THREE.MeshStandardMaterial({ color: '#788a80', roughness: 0.9 });
  const corrugatedRoof = new THREE.MeshStandardMaterial({ color: '#68766f', metalness: 0.38, roughness: 0.72 });
  const floodStain = new THREE.MeshStandardMaterial({ color: '#514b3c', roughness: 0.98 });
  const add = (name: string, size: THREE.Vector3Tuple, mat: THREE.Material,
    position: THREE.Vector3Tuple): THREE.Mesh => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    object.name = name;
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    shelter.add(object);
    return object;
  };
  const pier = (x: number, z: number): void => {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 3.55, 9), palette.timber);
    column.name = 'shelter-pier';
    column.position.set(x, 1.72, z);
    column.castShadow = true;
    column.receiveShadow = true;
    shelter.add(column);
    for (const y of [0.08, 0.42]) {
      const mark = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 6, 14), floodStain);
      mark.name = 'shelter-flood-line';
      mark.position.set(x, y, z);
      mark.rotation.x = Math.PI / 2;
      shelter.add(mark);
    }
  };
  add('shelter-main-platform', [5.9, 0.22, 4.7], deck, [0, 1.16, 0]);
  add('shelter-loading-dock', [8.2, 0.18, 2.6], deck, [1.35, 1.15, 2.15]);
  for (const x of [-2.55, 2.55]) {
    for (const z of [-2.0, 2.0]) pier(x, z);
  }
  for (const x of [-1, 1]) {
    const beam = add('shelter-crossbeam', [0.16, 0.18, 4.8], palette.timber, [x * 2.3, 3.48, 0]);
    beam.castShadow = true;
  }
  const roofPeak = 4.56;
  const eave = 3.55;
  const pitch = Math.atan2(roofPeak - eave, 2.85);
  const panelWidth = Math.hypot(2.85, roofPeak - eave) + 0.22;
  for (const side of [-1, 1]) {
    const panel = add('shelter-corrugated-roof', [panelWidth, 0.13, 5.35],
      corrugatedRoof,
      [side * 1.43, (roofPeak + eave) / 2, 0]);
    panel.rotation.z = -side * pitch;
    for (let rib = 0; rib <= 12; rib += 1) {
      const distance = 0.23 + rib * 0.215;
      const x = side * distance;
      const y = roofPeak - distance * Math.tan(pitch) + 0.08;
      const corrugation = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 5.4, 6),
        rib % 2 === 0 ? corrugatedRoof : canvas);
      corrugation.name = 'shelter-roof-rib';
      corrugation.position.set(x, y, 0);
      corrugation.rotation.x = Math.PI / 2;
      corrugation.castShadow = true;
      shelter.add(corrugation);
    }
  }
  add('shelter-ridge', [0.2, 0.17, 5.45], palette.timber, [0, roofPeak + 0.08, 0]);
  for (const z of [-2.25, 2.25]) {
    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -2.82, eave, z, 2.82, eave, z, 0, roofPeak, z,
    ], 3));
    faceGeometry.computeVertexNormals();
    const gable = new THREE.Mesh(faceGeometry, canvas);
    gable.name = 'shelter-gable';
    gable.material.side = THREE.DoubleSide;
    shelter.add(gable);
  }
  add('relief-signboard', [2.6, 0.58, 0.12], palette.timber, [0, 2.91, 2.36]);
  const signTexture = textPlate('RELIEF SHELTER', 2.28, 0.31, '#e4d4ad', '#334e4a');
  add('sign-inset', [2.28, 0.31, 0.035],
    new THREE.MeshBasicMaterial({ map: signTexture }), [0, 2.91, 2.44]);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 7), palette.timber);
  flagPole.name = 'shelter-flag-pole';
  flagPole.position.set(2.55, 5.4, -1.9);
  flagPole.castShadow = true;
  shelter.add(flagPole);
  const shelterFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshStandardMaterial({ color: '#c65f45', side: THREE.DoubleSide, roughness: 0.9 }));
  shelterFlag.name = 'shelter-flag';
  shelterFlag.position.set(3.02, 6.1, -1.9);
  shelter.add(shelterFlag);
  add('shelter-ramp', [2.25, 0.12, 2.8], deck, [-2.1, 0.65, 3.15]).rotation.x = 0.25;
  warmLight.position.set(0, 3, 0);
  shelter.add(warmLight);
  scene.add(shelter);
}

function addWake(boat: THREE.Group): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.48, -0.08, -1.05, -1.95, -0.08, -4.8, -1.65, -0.08, -4.8,
    0.48, -0.08, -1.05, 1.65, -0.08, -4.8, 1.95, -0.08, -4.8,
  ], 3));
  geometry.computeVertexNormals();
  const wake = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: '#d5e4d4', transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide,
  }));
  wake.renderOrder = 1;
  boat.add(wake);
  return wake;
}

function createRain(scene: THREE.Scene, reducedMotion: boolean): { points: THREE.Points | null; values: Float32Array } {
  const count = reducedMotion ? 0 : 320;
  const values = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    values[index * 3] = (Math.random() - 0.5) * 70;
    values[index * 3 + 1] = Math.random() * 12 + 2;
    values[index * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(values, 3));
  const points = count === 0 ? null : new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#b9d8d1', size: 0.055, transparent: true, opacity: 0.37, depthWrite: false }),
  );
  if (points) scene.add(points);
  return { points, values };
}

export function createWorld(container: HTMLElement, reducedMotion: boolean, assets: WorldAssets): World {
  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;
  const quality = chooseQuality(isMobile, reducedMotion);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#6c918c');
  scene.fog = new THREE.FogExp2('#6c918c', 0.008);

  const camera = new THREE.PerspectiveCamera(quality.cameraFov, 1, 0.1, 180);
  camera.position.set(0, 7, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap));
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), isMobile ? 2 : 8);
  for (const texture of assets.textures.values()) texture.anisotropy = anisotropy;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  container.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight('#e1e9e2', '#68786e', 3.15));
  scene.add(new THREE.AmbientLight('#b1c0b4', 0.38));
  const sun = new THREE.DirectionalLight('#fff0d6', 2.1);
  sun.position.set(-19, 31, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 5;
  sun.shadow.camera.left = -75;
  sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75;
  sun.shadow.camera.bottom = -75;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#cfe4dd', 0.65);
  rim.position.set(24, 14, -30);
  scene.add(rim);

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: '#385f5d', roughness: isMobile ? 0.48 : 0.34, metalness: 0.04,
    transparent: true, opacity: 0.95,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.09;
  water.receiveShadow = true;
  scene.add(water);

  const submergedRoad = new THREE.MeshStandardMaterial({ color: '#83917a', roughness: 0.94, transparent: true, opacity: SUBMERGED_STREET_OPACITY });
  const roadEdge = new THREE.MeshStandardMaterial({ color: '#dac183', roughness: 0.75, transparent: true, opacity: SUBMERGED_STREET_EDGE_OPACITY });
  addRoad(scene, submergedRoad, 0, -1, 5.4, 140);
  addRoad(scene, submergedRoad, -2, -1, 110, 4.5, Math.PI / 2.5);
  addRoad(scene, submergedRoad, -0.5, -7, 5.2, 135, -0.83);
  addRoad(scene, roadEdge, -0.5, -7, 0.12, 135, -0.83);
  addRoad(scene, submergedRoad, 0, 10, 115, 3.5, 0.12);
  for (let z = -61; z <= 59; z += 10) addRoad(scene, roadEdge, 0, z, 0.14, 2.8);
  addRoad(scene, submergedRoad, -20, -30, 60, 4.2, Math.PI / 3.2);
  addRoad(scene, submergedRoad, 18, -34, 62, 4.2, -Math.PI / 3.4);

  const palette = makeBuildingPalette(assets);
  const warmLight = new THREE.PointLight('#ffc77b', 8, 12, 2);
  addShelter(scene, palette, warmLight);
  const [houseAX, , houseAZ] = SCENE_LAYOUT['house-a'].building;
  const [houseBX, , houseBZ] = SCENE_LAYOUT['house-b'].building;
  const [houseCX, , houseCZ] = SCENE_LAYOUT['house-c'].building;
  const missionHouses = [
    createHouse(scene, houseAX, houseAZ, palette, 0, { dressed: true, fullDress: true }),
    createHouse(scene, houseBX, houseBZ, palette, 1, { dressed: true }),
    createHouse(scene, houseCX, houseCZ, palette, 2, { dressed: true }),
  ];
  const flagWaves: THREE.Object3D[] = [];
  for (const house of missionHouses) {
    const bunting = house.getObjectByName('bunting');
    if (bunting) flagWaves.push(bunting);
  }
  const shelterFlag = scene.getObjectByName('shelter-flag');
  if (shelterFlag) flagWaves.push(shelterFlag);

  const palmSpots: Array<[number, number, number]> = [
    [-55, 25, 1.1], [-30, 32, 0.85], [15, 38, 0.95], [45, 28, 1.1],
    [60, 5, 0.9], [48, -32, 1.0], [25, -52, 0.9], [-20, -62, 1.0],
    [-45, -55, 0.85], [-60, -10, 0.95], [-50, -30, 0.8], [10, 25, 0.75],
    [-14, 30, 0.9], [30, 8, 0.85],
  ];
  for (const [x, z, scale] of palmSpots.slice(0, quality.foliageCount)) createPalm(scene, x, z, scale, palette);

  for (const house of BACKGROUND_HOUSES) {
    const group = createFarHouse(scene, house.x, house.z, palette, house.variation);
    group.scale.setScalar(house.scale);
  }

  const foamMaterial = new THREE.MeshBasicMaterial({
    color: '#cfe0d8', transparent: true, opacity: 0.35, depthWrite: false,
  });
  const foamGeometry = new THREE.TorusGeometry(3.1, 0.09, 6, 40);
  for (const stop of STOPS) {
    const [bx, , bz] = SCENE_LAYOUT[stop.id].building;
    const foam = new THREE.Mesh(foamGeometry, foamMaterial);
    foam.name = 'flood-foam-ring';
    foam.rotation.x = Math.PI / 2;
    foam.position.set(bx, 0.02, bz);
    foam.scale.setScalar(stop.id === 'shelter' ? 1.5 : 1);
    scene.add(foam);
  }

  const reedGeometry = new THREE.ConeGeometry(0.09, 1.1, 5);
  const reedMaterial = new THREE.MeshStandardMaterial({ color: '#4e7e5b', roughness: 0.9 });
  const reedSpots: Array<[number, number]> = [];
  for (const stop of STOPS) {
    const [dx, , dz] = SCENE_LAYOUT[stop.id].dock;
    reedSpots.push([dx + 2.2, dz + 1.4], [dx - 2.2, dz - 1.2]);
  }
  const reedCount = isMobile ? 8 : reedSpots.length * 3;
  let placed = 0;
  for (const [rx, rz] of reedSpots) {
    for (let i = 0; i < 3 && placed < reedCount; i += 1) {
      const reed = new THREE.Mesh(reedGeometry, reedMaterial);
      reed.name = 'foreground-reed';
      reed.position.set(rx + (i - 1) * 0.35, 0.4, rz + ((i * 37) % 3 - 1) * 0.3);
      reed.rotation.z = ((i * 53) % 10 - 5) * 0.03;
      scene.add(reed);
      placed += 1;
    }
  }

  // Gradient sky dome and a distant tree-line ring give the large world
  // far-field depth in two draw calls.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 128;
  const skyContext = skyCanvas.getContext('2d')!;
  const skyGradient = skyContext.createLinearGradient(0, 0, 0, 128);
  skyGradient.addColorStop(0, '#5f8a90');
  skyGradient.addColorStop(0.55, '#8fb0ab');
  skyGradient.addColorStop(0.8, '#d9dfcd');
  skyGradient.addColorStop(1, '#e8e2cc');
  skyContext.fillStyle = skyGradient;
  skyContext.fillRect(0, 0, 4, 128);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 20, 12),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false }));
  sky.name = 'sky-dome';
  scene.add(sky);

  const treeRingGeometry = new THREE.ConeGeometry(3.2, 5, 6);
  const treeRingMaterial = new THREE.MeshStandardMaterial({ color: '#41655a', roughness: 1 });
  const treeRing = new THREE.InstancedMesh(treeRingGeometry, treeRingMaterial, 26);
  treeRing.name = 'distant-tree-line';
  const treeDummy = new THREE.Object3D();
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2 + (i % 3) * 0.05;
    const radius = 66 + (i % 4) * 1.2;
    treeDummy.position.set(Math.cos(angle) * radius, 0.6 + (i % 3) * 0.4, Math.sin(angle) * radius);
    treeDummy.scale.setScalar(0.9 + (i % 5) * 0.12);
    treeDummy.updateMatrix();
    treeRing.setMatrixAt(i, treeDummy.matrix);
  }
  treeRing.instanceMatrix.needsUpdate = true;
  scene.add(treeRing);

  const markers = new Map<StopId, THREE.Group>();
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: '#f3d486', emissive: '#d99845', emissiveIntensity: 1.1,
    roughness: 0.35, transparent: true, opacity: 0.88,
  });
  const pillarMaterial = new THREE.MeshBasicMaterial({
    color: '#f6c676', transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const pillarGeometry = new THREE.CylinderGeometry(0.09, 0.16, 5.5, 8);
  for (const stop of STOPS) {
    const marker = new THREE.Group();
    const [dockX, , dockZ] = SCENE_LAYOUT[stop.id].dock;
    marker.position.set(dockX, 0.08, dockZ);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 32), markerMaterial);
    ring.rotation.x = Math.PI / 2;
    marker.add(ring);
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 6), markerMaterial);
    beacon.position.y = 0.9;
    marker.add(beacon);
    const light = new THREE.PointLight('#f6c676', 1.4, 4, 2);
    light.position.y = 1.15;
    marker.add(light);
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.name = 'dock-pillar';
    pillar.position.set(dockX, 2.8, dockZ);
    scene.add(pillar);
    scene.add(marker);
    markers.set(stop.id, marker);
  }

  // Dock furniture: tire fenders on the shelter dock, mooring posts with rope
  // loops at every landing.
  const tireMaterial = new THREE.MeshStandardMaterial({ color: '#2e2c29', roughness: 0.95 });
  const tireGeometry = new THREE.TorusGeometry(0.22, 0.09, 8, 16);
  for (const offset of [-2.4, 0, 2.4]) {
    const tire = new THREE.Mesh(tireGeometry, tireMaterial);
    tire.name = 'dock-fender';
    tire.position.set(-4.5 + offset, 1.0, 18.6);
    tire.rotation.x = Math.PI / 2 - 0.15;
    scene.add(tire);
  }
  const mooringMaterial = palette.timber;
  for (const stop of STOPS) {
    const [dockX, , dockZ] = SCENE_LAYOUT[stop.id].dock;
    const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.0, 8), mooringMaterial);
    postMesh.name = 'mooring-post';
    postMesh.position.set(dockX + 1.4, 0.5, dockZ + 0.6);
    postMesh.castShadow = true;
    scene.add(postMesh);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 14), mooringMaterial);
    loop.name = 'mooring-rope';
    loop.position.set(dockX + 1.4, 0.85, dockZ + 0.6);
    scene.add(loop);
  }

  const boatVisual = createBoat(assets, quality);
  const boat = boatVisual.group;
  boat.position.set(0, 0.04, 12.3);
  scene.add(boat);
  const wake = addWake(boat);
  const actors = createVisualActors(scene, boat);
  const rain = createRain(scene, reducedMotion);
  let heading = initialRescueHeading(boat.position.x, boat.position.z);
  boat.rotation.y = heading;
  let speed = 0;
  let elapsed = 0;
  let lastSafe = { x: boat.position.x, z: boat.position.z };
  const forward = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();

  const resize = (): void => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    setMission(state: MissionState): void {
      actors.update(state);
    },
    tick(dt: number, input: { throttle: number; steer: number; paused?: boolean }): void {
      const frameTime = Math.max(0, Math.min(dt, 0.05));
      elapsed += frameTime;
      forward.set(Math.sin(heading), 0, Math.cos(heading));
      if (input.paused) {
        speed = 0;
      } else {
        speed = advanceSpeed(speed, input.throttle, frameTime);
        heading = advanceHeading(heading, input.steer, speed, frameTime);
        forward.set(Math.sin(heading), 0, Math.cos(heading));

        const nextX = boat.position.x + forward.x * speed * frameTime;
        const nextZ = boat.position.z + forward.z * speed * frameTime;
        const bounded = clampToWater(nextX, nextZ);
        const hitHouse = isBlocked(bounded.x, bounded.z, 0.45);
        if (hitHouse) {
          speed *= -0.18;
        } else {
          boat.position.x = bounded.x;
          boat.position.z = bounded.z;
          lastSafe = { x: boat.position.x, z: boat.position.z };
        }
        boat.rotation.y = heading;
      }

      boat.position.y = 0.04 + (reducedMotion ? 0 : Math.sin(elapsed * 2.2) * 0.035);
      boat.rotation.z = reducedMotion ? 0 : THREE.MathUtils.lerp(boat.rotation.z, -input.steer * Math.min(Math.abs(speed), 6) * 0.014, 1 - Math.exp(-frameTime * 6));
      (wake.material as THREE.MeshBasicMaterial).opacity = reducedMotion ? 0 : Math.min(0.32, Math.abs(speed) * 0.055);

      const stopY = reducedMotion ? 0 : Math.sin(elapsed * 1.8) * 0.08;
      for (const [id, marker] of markers) marker.position.y = 0.08 + stopY + (id === 'shelter' ? 0 : 0.02);

      // Event-driven dock cue: the reachable landing's ring breathes once the
      // boat is slow and inside its radius. Bunting and the shelter flag stir
      // gently unless reduced motion is requested.
      const readyId = this.nearestStop();
      const readyPulse = !reducedMotion && readyId !== null && Math.abs(speed) <= 1.45;
      for (const [id, marker] of markers) {
        const ring = marker.children[0];
        ring.scale.setScalar(readyPulse && id === readyId ? 1 + 0.14 * Math.sin(elapsed * 6) : 1);
      }
      if (!reducedMotion) {
        for (const wave of flagWaves) {
          wave.rotation.y = Math.sin(elapsed * 2.4 + wave.position.x * 0.7 + wave.position.z) * 0.22;
        }
      }

      if (rain.points) {
        const positions = rain.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let index = 0; index < positions.count; index += 1) {
          const y = positions.getY(index) - frameTime * 9.5;
          if (y < 0.5) {
            positions.setXYZ(
              index,
              boat.position.x + (Math.random() - 0.5) * 70,
              10 + Math.random() * 5,
              boat.position.z + (Math.random() - 0.5) * 70,
            );
          } else {
            positions.setY(index, y);
          }
        }
        positions.needsUpdate = true;
      }

      desiredCamera.set(boat.position.x - forward.x * quality.cameraDistance,
        isMobile ? 8.2 : 7.5, boat.position.z - forward.z * quality.cameraDistance);
      if (reducedMotion) camera.position.copy(desiredCamera);
      else camera.position.lerp(desiredCamera, 1 - Math.exp(-frameTime * 4.8));
      camera.lookAt(
        boat.position.x + forward.x * 2.7,
        0.55,
        boat.position.z + forward.z * 2.7,
      );
    },

    nearestStop(): StopId | null {
      let closest: StopId | null = null;
      let closestDistance = INTERACTION_RADIUS;
      for (const stop of STOPS) {
        const [dockX, , dockZ] = SCENE_LAYOUT[stop.id].dock;
        const distance = Math.hypot(boat.position.x - dockX, boat.position.z - dockZ);
        if (distance <= closestDistance) {
          closest = stop.id;
          closestDistance = distance;
        }
      }
      return closest;
    },

    dockReady(): boolean {
      return this.nearestStop() !== null && isDockReady(0, speed);
    },

    position(): { x: number; z: number } {
      return { x: boat.position.x, z: boat.position.z };
    },

    resetToSafeWater(): void {
      boat.position.set(lastSafe.x, 0.04, lastSafe.z);
      speed = 0;
    },

    render(): void {
      renderer.render(scene, camera);
    },

    diagnostics(): RendererDiagnostics {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },

    dispose(): void {
      window.removeEventListener('resize', resize);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const item of materials) item.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
