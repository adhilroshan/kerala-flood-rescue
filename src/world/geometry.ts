import * as THREE from 'three';

export interface BuildingPalette {
  plaster: THREE.Material;
  shadow: THREE.Material;
  roof: THREE.Material;
  roofLight: THREE.Material;
  timber: THREE.Material;
  glass: THREE.Material;
  leaf: THREE.Material;
  leafLight: THREE.Material;
}

function mesh(
  parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry,
  material: THREE.Material, x: number, y: number, z: number,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent: THREE.Object3D, name: string, size: THREE.Vector3Tuple,
  material: THREE.Material, position: THREE.Vector3Tuple): THREE.Mesh {
  return mesh(parent, name, new THREE.BoxGeometry(...size), material, ...position);
}

function post(parent: THREE.Object3D, name: string, x: number, z: number,
  bottom: number, top: number, material: THREE.Material, radius = 0.09): void {
  mesh(parent, name, new THREE.CylinderGeometry(radius, radius * 1.18, top - bottom, 8),
    material, x, (top + bottom) / 2, z);
}

export function textPlate(text: string, width: number, height: number,
  background: string, foreground: string, font = 'bold 42px system-ui, sans-serif'): THREE.Texture {
  if (typeof document === 'undefined') {
    const fallback = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = Math.max(1, Math.round((256 * height) / Math.max(width, 0.01)));
  const context = canvas.getContext('2d')!;
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground;
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function gable(parent: THREE.Object3D, name: string, z: number,
  wallTop: number, peak: number, material: THREE.Material): void {
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.94, wallTop, z, 1.94, wallTop, z, 0, peak, z,
  ], 3));
  shape.computeVertexNormals();
  const face = mesh(parent, name, shape, material, 0, 0, 0);
  face.material = (material as THREE.MeshStandardMaterial).clone();
  (face.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
}

function dressOccupiedHouse(house: THREE.Group, palette: BuildingPalette, full: boolean): void {
  // Warm porch lamp: an emissive cue that this household is occupied.
  box(house, 'lamp-bracket', [0.08, 0.08, 0.5], palette.timber, [1.89, 3.62, 3.7]);
  const lamp = mesh(house, 'porch-lamp', new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#e8a94e', emissiveIntensity: 1.6 }),
    1.89, 3.48, 3.5);
  lamp.castShadow = false;
  // Festival bunting across the veranda: motion + occupancy signal.
  const bunting = new THREE.Group();
  bunting.name = 'bunting';
  house.add(bunting);
  const ropeCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-1.89, 3.62, 4.0), new THREE.Vector3(0, 3.2, 4.05), new THREE.Vector3(1.89, 3.62, 4.0));
  const rope = new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 12, 0.015, 5), palette.timber);
  rope.name = 'bunting-rope';
  bunting.add(rope);
  const flagColors = ['#c65f45', '#e5c86f', '#527e79', '#c65f45', '#e5c86f'];
  for (let i = 0; i < 5; i += 1) {
    const t = 0.12 + i * 0.19;
    const point = ropeCurve.getPoint(t);
    const flagShape = new THREE.Shape([new THREE.Vector2(-0.09, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0, -0.22)]);
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape),
      new THREE.MeshStandardMaterial({ color: flagColors[i], side: THREE.DoubleSide, roughness: 0.9 }));
    flag.name = 'bunting-flag';
    flag.position.copy(point);
    bunting.add(flag);
  }
  if (!full) return;
  // Rain-water tank and clothesline dress the hero household's daily life.
  mesh(house, 'water-tank', new THREE.CylinderGeometry(0.42, 0.42, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: '#3d5a66', roughness: 0.6 }), -2.5, 1.9, -1.2);
  post(house, 'tank-stand', -2.5, -1.2, 0, 1.5, palette.timber, 0.12);
  post(house, 'clothesline-pole', 2.6, 0.4, 1.3, 2.6, palette.timber, 0.06);
  const lineCurve = new THREE.LineCurve3(new THREE.Vector3(1.89, 2.55, 0.4), new THREE.Vector3(2.6, 2.55, 0.4));
  house.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lineCurve.getPoints(2)),
    new THREE.LineBasicMaterial({ color: '#d8ccb1' })));
  for (const [offset, color] of [[0, '#c65f45'], [0.35, '#e5d7ae']] as Array<[number, string]>) {
    const cloth = mesh(house, 'laundry', new THREE.PlaneGeometry(0.28, 0.34),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.95 }),
      1.95 + offset, 2.36, 0.4);
    cloth.castShadow = false;
  }
}

export function createFarHouse(scene: THREE.Scene, x: number, z: number,
  palette: BuildingPalette, variation: number): THREE.Group {
  // Background-village LOD: silhouette, roof, stilts and waterline in ~8 meshes,
  // sharing palette materials with no clones and no shadow casting.
  const house = new THREE.Group();
  house.name = `far-house-${variation}`;
  house.position.set(x, 0, z);
  const wall = variation === 1 ? palette.shadow : palette.plaster;
  box(house, 'far-undercroft', [3.6, 1.1, 3.2], palette.timber, [0, 0.55, 0]);
  box(house, 'far-platform', [4.0, 0.18, 3.6], palette.timber, [0, 1.18, 0]);
  box(house, 'far-walls', [3.6, 1.9, 3.2], wall, [0, 2.2, -0.1]);
  const peak = 3.9 + (variation % 2) * 0.3;
  const pitch = Math.atan2(peak - 3.15, 1.8);
  for (const side of [-1, 1]) {
    const panel = box(house, 'far-roof', [2.1, 0.12, 3.9],
      side < 0 ? palette.roof : palette.roofLight, [side * 0.9, (peak + 3.15) / 2, -0.1]);
    panel.rotation.z = -side * pitch;
  }
  box(house, 'far-door', [0.7, 1.2, 0.08], palette.timber, [0, 1.9, 1.55]);
  const band = box(house, 'far-waterline', [4.15, 0.32, 3.75],
    new THREE.MeshStandardMaterial({ color: '#514b3c', roughness: 0.98, transparent: true, opacity: 0.9 }),
    [0, 0.3, 0]);
  band.castShadow = false;
  house.traverse((object) => { object.castShadow = false; });
  scene.add(house);
  return house;
}

export function createHouse(scene: THREE.Scene, x: number, z: number,
  palette: BuildingPalette, variation: number, opts?: { dressed?: boolean; fullDress?: boolean }): THREE.Group {
  const house = new THREE.Group();
  house.name = `house-${variation}`;
  house.position.set(x, 0, z);
  const wall = variation === 1 ? palette.shadow : palette.plaster;
  const roof = (palette.roof as THREE.MeshStandardMaterial).clone();
  roof.color.set(variation === 1 ? '#b8b5a6' : variation === 2 ? '#dbc199' : '#ffffff');
  const darkRoof = (palette.roofLight as THREE.MeshStandardMaterial).clone();
  darkRoof.color.set(variation === 1 ? '#a7b4a4' : variation === 2 ? '#d6bd9e' : '#f3ded0');

  // A raised occupied storey with stilts that actually meet the floor.
  box(house, 'lower-floor', [4.15, 0.22, 3.8], palette.timber, [0, 1.18, 0]);
  for (const sx of [-1.65, 1.65]) for (const sz of [-1.35, 1.35]) {
    post(house, 'foundation-pier', sx, sz, -0.12, 1.1, palette.timber, 0.14);
  }
  const floodStain = new THREE.MeshStandardMaterial({ color: '#514b3c', roughness: 0.98 });
  for (const sx of [-1.65, 1.65]) for (const sz of [-1.35, 1.35]) {
    for (const y of [0.08, 0.42]) {
      const mark = mesh(house, 'flood-line-stain', new THREE.TorusGeometry(0.16, 0.026, 6, 14),
        floodStain, sx, y, sz);
      mark.rotation.x = Math.PI / 2;
    }
  }
  box(house, 'walls', [3.85, 2.3, 3.45], wall, [0, 2.38, -0.12]);
  const wallTop = 3.53;
  const peak = variation === 1 ? 4.33 : variation === 2 ? 4.67 : 4.52;
  gable(house, 'front-gable', 1.615, wallTop, peak, wall);
  gable(house, 'back-gable', -1.855, wallTop, peak, wall);

  const pitch = Math.atan2(peak - wallTop, 1.94);
  const panelWidth = Math.hypot(1.94, peak - wallTop) + 0.24;
  for (const side of [-1, 1]) {
    const panel = box(house, side < 0 ? 'roof-slope-left' : 'roof-slope-right',
      [panelWidth, 0.16, 4.25], side < 0 ? roof : darkRoof,
      [side * 0.97, (peak + wallTop) / 2, -0.12]);
    panel.rotation.z = -side * pitch;
    const bargeboard = box(house, 'gable-bargeboard', [panelWidth, 0.09, 0.09],
      palette.timber, [side * 0.97, (peak + wallTop) / 2, 2.0]);
    bargeboard.rotation.z = -side * pitch;
    const gutter = mesh(house, 'eave-gutter', new THREE.CylinderGeometry(0.065, 0.065, 4.3, 8),
      palette.timber, side * 2.06, wallTop - 0.01, -0.12);
    gutter.rotation.x = Math.PI / 2;
  }
  box(house, 'ridge-tiles', [0.18, 0.13, 4.27], palette.timber, [0, peak + 0.07, -0.12]);
  box(house, 'fascia-front', [4, 0.13, 0.12], palette.timber, [0, wallTop - 0.02, 1.96]);

  for (const side of [-1, 1]) {
    const wx = side * 1.12;
    box(house, 'recessed-window', [0.76, 0.82, 0.075], palette.timber, [wx, 2.23, 1.645]);
    box(house, 'window-glass', [0.57, 0.64, 0.085], palette.glass, [wx, 2.23, 1.698]);
    box(house, 'window-divider', [0.045, 0.72, 0.09], palette.timber, [wx, 2.23, 1.76]);
    box(house, 'window-sill', [0.91, 0.09, 0.18], palette.timber, [wx, 1.79, 1.72]);
  }
  box(house, 'front-door', [0.89, 1.71, 0.1], palette.timber, [0, 2.19, 1.66]);
  mesh(house, 'door-handle', new THREE.SphereGeometry(0.045, 8, 6),
    palette.roofLight, 0.32, 2.1, 1.74);

  // A single continuous veranda supports the waiting residents and canopy posts.
  box(house, 'waiting-platform', [4.25, 0.18, 2.48], palette.timber, [0, 1.29, 2.88]);
  const supports = new THREE.Group();
  supports.name = 'veranda-supports';
  house.add(supports);
  for (const sx of [-1.87, 1.87]) for (const sz of [1.84, 3.9]) {
    post(supports, 'veranda-pier', sx, sz, 0, 1.2, palette.timber, 0.115);
  }
  for (const sx of [-1, 1]) {
    box(house, 'side-balustrade', [0.09, 0.58, 2.15], palette.timber, [sx * 2.06, 1.69, 2.87]);
  }
  const canopy = box(house, 'veranda-roof', [variation === 1 ? 5.0 : 4.45, 0.14, 2.45],
    darkRoof, [0, 3.74, 3.05]);
  canopy.rotation.x = -0.07;
  for (const sx of [-1.89, 1.89]) post(house, 'canopy-column', sx, 4.0, 1.39, 3.65, palette.timber);

  // The steps descend from the dry veranda towards the water-facing dock.
  for (let i = 0; i < 5; i += 1) {
    const top = 1.28 - i * 0.27;
    box(house, 'landing-step', [1.1, 0.14, 0.43], palette.timber,
      [1.12, top - 0.07, 3.9 + i * 0.39]);
  }

  if (variation === 0) {
    for (const sx of [-1.15, 1.15]) {
      box(house, 'facade-shutter', [0.17, 0.91, 0.12], palette.timber, [sx * 1.14, 2.23, 1.79]);
    }
  } else if (variation === 1) {
    for (const sx of [-2.14, 2.14]) post(house, 'wide-eave-post', sx, 3.9, 2.72, 4.51, palette.timber);
  } else {
    box(house, 'roof-vent', [0.74, 0.48, 0.65], wall, [0, peak + 0.27, -0.52]);
    const cap = box(house, 'roof-vent-cap', [0.96, 0.12, 0.88], roof, [0, peak + 0.56, -0.52]);
    cap.rotation.z = 0.08;
  }
  if (opts?.dressed) dressOccupiedHouse(house, palette, opts.fullDress === true);
  scene.add(house);
  return house;
}

export function createPalm(scene: THREE.Scene, x: number, z: number, scale: number,
  palette: Pick<BuildingPalette, 'timber' | 'leaf' | 'leafLight'>): THREE.Group {
  const palm = new THREE.Group();
  palm.position.set(x, 0, z);
  palm.scale.setScalar(scale);

  const trunkPoints = [new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0.14, 1.3, 0),
    new THREE.Vector3(0.3, 2.75, -0.06), new THREE.Vector3(0.35, 4.35, -0.15)];
  for (let i = 0; i < trunkPoints.length - 1; i += 1) {
    const a = trunkPoints[i], b = trunkPoints[i + 1];
    const section = mesh(palm, 'tapered-palm-trunk',
      new THREE.CylinderGeometry(0.18 - i * 0.035, 0.28 - i * 0.034, a.distanceTo(b), 9),
      palette.timber, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    section.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }

  const vertices: number[] = [];
  const colors: number[] = [];
  const green = new THREE.Color('#315a40');
  const lightGreen = new THREE.Color('#71915e');
  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color): void => {
    vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    for (let i = 0; i < 3; i += 1) colors.push(color.r, color.g, color.b);
  };
  for (let frond = 0; frond < 9; frond += 1) {
    const angle = (frond / 9) * Math.PI * 2;
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const center = (t: number): THREE.Vector3 => new THREE.Vector3(0.35, 4.43, -0.15)
      .addScaledVector(outward, t * 2.8)
      .add(new THREE.Vector3(0, 0.47 * Math.sin(t * Math.PI) - 1.05 * t * t, 0));
    // Individual tapered pinnae provide a feathered silhouette rather than a solid cone.
    for (let i = 0; i < 11; i += 1) {
      const t = 0.11 + i * 0.074;
      for (const side of [-1, 1]) {
        const origin = center(t);
        const next = center(Math.min(t + 0.105, 1));
        const spread = 0.22 + 0.53 * Math.sin(Math.PI * t);
        const tip = origin.clone().addScaledVector(across, side * spread)
          .addScaledVector(outward, 0.20).add(new THREE.Vector3(0, -0.22 - t * 0.17, 0));
        addTriangle(origin, next, tip, (frond + i) % 3 === 0 ? lightGreen : green);
      }
    }
  }
  const fronds = new THREE.BufferGeometry();
  fronds.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  fronds.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  fronds.computeVertexNormals();
  const leaves = mesh(palm, 'palm-fronds', fronds,
    new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 }), 0, 0, 0);
  leaves.castShadow = true;
  for (const offset of [-0.18, 0.12, 0.4]) {
    mesh(palm, 'coconut', new THREE.SphereGeometry(0.16, 8, 6), palette.timber,
      0.35 + offset, 4.25, -0.1 + offset * 0.5);
  }
  scene.add(palm);
  return palm;
}
