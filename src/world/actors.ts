import * as THREE from 'three';
import { STOPS } from '../mission/data';
import { createMission } from '../mission/model';
import { textPlate } from './geometry';
import type { HouseId, MissionState } from '../mission/types';
import { BOAT_SLOTS, SCENE_LAYOUT } from './anchors';

const clothing = ['#669b92', '#dec779', '#718da0', '#ba806c'];
const skinColors = ['#966346', '#b47b55', '#875941', '#a66f4e'];
const material = (color: string): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.86 });

function shape(parent: THREE.Group, name: string, geometry: THREE.BufferGeometry,
  mat: THREE.Material, position: THREE.Vector3Tuple): THREE.Mesh {
  const object = new THREE.Mesh(geometry, mat);
  object.name = name;
  object.position.set(...position);
  object.castShadow = true;
  parent.add(object);
  return object;
}

function resident(name: string, color: string, index: number, volunteer = false, seated = false, signaling = false): THREE.Group {
  const figure = new THREE.Group();
  figure.name = name;
  const garment = material(color);
  const pants = material(index % 2 ? '#494d46' : '#6c6257');
  const skin = material(skinColors[index % skinColors.length]);
  const hair = material(index % 3 ? '#211d1b' : '#3d3029');
  const shoes = material('#32302c');

  const legs = new THREE.Group();
  legs.name = 'shoes';
  figure.add(legs);
  for (const side of [-1, 1]) {
    const leg = shape(legs, 'trouser-leg', new THREE.CylinderGeometry(0.085, 0.10, 0.52, 10),
      pants, [side * 0.13, 0.35, seated ? 0.08 : 0]);
    if (seated) leg.rotation.x = -0.7;
    const shoe = shape(legs, 'shoe', new THREE.SphereGeometry(1, 10, 8),
      shoes, [side * 0.13, 0.085, seated ? 0.33 : 0.08]);
    shoe.scale.set(0.11, 0.075, 0.18);
  }
  const hips = shape(figure, 'hips', new THREE.CylinderGeometry(0.18, 0.19, 0.22, 12),
    pants, [0, 0.69, 0]);
  if (seated) hips.position.y = 0.59;
  const torso = shape(figure, 'torso', new THREE.LatheGeometry([
    new THREE.Vector2(0.15, -0.39), new THREE.Vector2(0.18, -0.26),
    new THREE.Vector2(0.175, -0.10), new THREE.Vector2(0.205, 0.12),
    new THREE.Vector2(0.27, 0.31), new THREE.Vector2(0.285, 0.38),
    new THREE.Vector2(0.20, 0.45),
  ], 14), garment, [0, seated ? 0.88 : 1.0, 0]);
  torso.scale.z = 0.78;
  shape(figure, 'neck', new THREE.CylinderGeometry(0.073, 0.076, 0.14, 10),
    skin, [0, seated ? 1.25 : 1.39, 0]);
  const headY = seated ? 1.43 : 1.57;
  const head = shape(figure, 'head', new THREE.SphereGeometry(0.185, 16, 12),
    skin, [0, headY, 0.025]);
  head.scale.set(0.94, 1.12, 0.86);
  const hairCap = shape(figure, 'hair', new THREE.SphereGeometry(0.188, 16, 10),
    hair, [0, headY + 0.118, -0.014]);
  hairCap.scale.set(0.97, 0.52, 0.94);
  for (const side of [-1, 1]) {
    const ear = shape(figure, 'ear', new THREE.SphereGeometry(0.046, 8, 6), skin,
      [side * 0.17, headY - 0.005, 0.015]);
    ear.scale.set(0.72, 1.0, 0.58);
    shape(figure, 'eye', new THREE.SphereGeometry(0.013, 6, 5), hair,
      [side * 0.068, headY + 0.01, 0.177]);
    shape(figure, 'brow', new THREE.BoxGeometry(0.05, 0.012, 0.012), hair,
      [side * 0.068, headY + 0.052, 0.177]);
    const arm = shape(figure, 'sleeve', new THREE.CylinderGeometry(0.085, 0.065, 0.48, 9),
      garment, [side * 0.275, seated ? 0.96 : 1.06, 0]);
    arm.rotation.z = signaling && side === 1 ? 0.72 : side * 0.22;
    shape(figure, signaling && side === 1 ? 'raised-hand' : 'hand',
      new THREE.SphereGeometry(0.066, 8, 6), skin,
      [signaling && side === 1 ? 0.44 : side * 0.34,
        signaling && side === 1 ? 1.32 : seated ? 0.7 : 0.8, 0.04]);
  }
  const nose = shape(figure, 'nose', new THREE.SphereGeometry(0.035, 8, 6), skin,
    [0, headY - 0.018, 0.185]);
  nose.scale.set(0.78, 1.0, 1.28);
  shape(figure, 'mouth', new THREE.BoxGeometry(0.075, 0.014, 0.012),
    hair, [0, headY - 0.09, 0.173]);
  for (let button = 0; button < 3; button += 1) {
    shape(figure, 'shirt-button', new THREE.SphereGeometry(0.018, 6, 5),
      material('#d9cfb6'), [0, (seated ? 0.89 : 1.01) + button * 0.13, 0.166]);
  }
  if (volunteer || seated) {
    const vest = shape(figure, 'relief-vest', new THREE.LatheGeometry([
      new THREE.Vector2(0.18, -0.24), new THREE.Vector2(0.2, -0.1),
      new THREE.Vector2(0.24, 0.14), new THREE.Vector2(0.265, 0.25),
    ], 12), material('#c0a35f'), [0, seated ? 0.96 : 1.08, 0.012]);
    vest.scale.set(1, 0.92, 0.83);
    for (const side of [-1, 1]) {
      shape(figure, 'reflective-band', new THREE.BoxGeometry(0.065, 0.43, 0.015),
        material('#e9d7a0'), [side * 0.12, seated ? 0.96 : 1.1, 0.157]);
    }
  }
  return figure;
}

let stencilTexture: THREE.Texture | null = null;
function crate(name: string): THREE.Group {
  const parcel = new THREE.Group();
  parcel.name = name;
  const wood = material('#9e714f');
  const binding = material('#d7c499');
  shape(parcel, 'crate-body', new THREE.BoxGeometry(0.44, 0.37, 0.42), wood, [0, 0.19, 0]);
  for (const side of [-1, 1]) {
    shape(parcel, 'crate-binding', new THREE.BoxGeometry(0.05, 0.38, 0.44), binding,
      [side * 0.15, 0.19, 0]);
  }
  if (!stencilTexture) stencilTexture = textPlate('RELIEF', 0.4, 0.1, '#9e714f', '#f0e2c4');
  const stencilMat = new THREE.MeshBasicMaterial({ map: stencilTexture, transparent: true });
  for (const side of [-1, 1]) {
    const stencil = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), stencilMat);
    stencil.name = 'crate-stencil';
    stencil.position.set(0, 0.19, side * 0.215);
    if (side < 0) stencil.rotation.y = Math.PI;
    parcel.add(stencil);
  }
  return parcel;
}

function seatAnchor(boat: THREE.Group, index: number): THREE.Group {
  const name = `seat-${index}`;
  const existing = boat.getObjectByName(name);
  if (existing instanceof THREE.Group) return existing;
  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.set(...BOAT_SLOTS.seats[index]);
  boat.add(anchor);
  return anchor;
}

function cargoAnchor(boat: THREE.Group, index: number): THREE.Group {
  const name = `cargo-slot-${index}`;
  const existing = boat.getObjectByName(name);
  if (existing instanceof THREE.Group) return existing;
  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.set(...BOAT_SLOTS.cargo[index]);
  boat.add(anchor);
  return anchor;
}

export function createVisualActors(scene: THREE.Scene, boat: THREE.Group): { update(state: MissionState): void } {
  const waiting: Record<HouseId, THREE.Group[]> = { 'house-a': [], 'house-b': [], 'house-c': [] };
  const delivered: Partial<Record<HouseId, THREE.Group>> = {};
  let personIndex = 0;
  for (const stop of STOPS) {
    if (stop.id === 'shelter') continue;
    for (let index = 0; index < stop.evacuees; index += 1) {
      const person = resident(`waiting-${stop.id}-${index}`, clothing[personIndex % clothing.length], personIndex++, false, false, true);
      person.position.set(...SCENE_LAYOUT[stop.id].waiting[index]);
      person.scale.setScalar(0.96);
      scene.add(person);
      waiting[stop.id].push(person);
    }
    if (stop.supplyRequested) {
      const supplies = crate(`delivered-${stop.id}`);
      supplies.position.set(stop.x + 1.35, SCENE_LAYOUT[stop.id].floorY, stop.z + 3.1);
      supplies.visible = false;
      scene.add(supplies);
      delivered[stop.id] = supplies;
    }
  }

  const passengers = [0, 1].map((index) => {
    const person = resident(`passenger-${index}`, clothing[index], index, false, true);
    person.scale.setScalar(0.78);
    seatAnchor(boat, index).add(person);
    return person;
  });
  const boatCrates = [0, 1].map((index) => {
    const parcel = crate(`crate-${index}`);
    cargoAnchor(boat, index).add(parcel);
    return parcel;
  });
  const shelterCrates = [0, 1].map((index) => {
    const parcel = crate(`shelter-crate-${index}`);
    parcel.position.set(-5.2 + index * 0.65, SCENE_LAYOUT.shelter.floorY, 15.5);
    scene.add(parcel);
    return parcel;
  });
  const safe = Array.from({ length: 4 }, (_, index) => {
    const person = resident(`safe-${index}`, clothing[index], index);
    person.position.set(-6.3 + index * 0.85, SCENE_LAYOUT.shelter.floorY, 14.1);
    person.scale.setScalar(0.88);
    scene.add(person);
    return person;
  });
  const volunteers = [0, 1].map((index) => {
    const person = resident(`volunteer-${index}`, index === 0 ? '#456c67' : '#806750', index + 1, true);
    person.position.set(-1.8 + index * 1.2, SCENE_LAYOUT.shelter.floorY, 16.2);
    person.scale.setScalar(0.9);
    scene.add(person);
    return person;
  });

  const update = (state: MissionState): void => {
      for (const stop of STOPS) {
        if (stop.id === 'shelter') continue;
        const id = stop.id as HouseId;
        waiting[id].forEach((person, index) => { person.visible = index < state.waiting[id]; });
        const parcel = delivered[id];
        if (parcel) parcel.visible = !state.pendingSupplies.includes(id);
      }
      passengers.forEach((person, index) => { person.visible = index < state.passengers; });
      boatCrates.forEach((parcel, index) => { parcel.visible = index < state.boatCrates; });
      shelterCrates.forEach((parcel, index) => { parcel.visible = index < state.shelterCrates; });
      safe.forEach((person, index) => { person.visible = index < state.rescued; });
      volunteers.forEach((person) => { person.visible = true; });
  };
  update(createMission());
  return { update };
}
