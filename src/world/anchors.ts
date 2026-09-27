import type { Vector3Tuple } from 'three';
import type { StopId } from '../mission/types';

export const WORLD_LIMIT = 70;

export interface BackgroundHouse {
  x: number;
  z: number;
  variation: number;
  scale: number;
}

export const BACKGROUND_HOUSES: BackgroundHouse[] = [
  { x: -55, z: 20, variation: 1, scale: 1 },
  { x: -30, z: 32, variation: 2, scale: 0.95 },
  { x: 20, z: 35, variation: 0, scale: 1.05 },
  { x: 48, z: 18, variation: 2, scale: 1 },
  { x: 58, z: -8, variation: 1, scale: 0.95 },
  { x: 30, z: -45, variation: 0, scale: 1 },
  { x: -30, z: -60, variation: 1, scale: 1.05 },
  { x: 12, z: -58, variation: 2, scale: 0.95 },
  { x: -58, z: -25, variation: 0, scale: 1 },
  { x: -52, z: -45, variation: 2, scale: 0.9 },
  { x: 55, z: 35, variation: 0, scale: 1 },
  { x: -15, z: 48, variation: 1, scale: 1 },
];

export interface StopLayout {
  building: Vector3Tuple;
  dock: Vector3Tuple;
  waiting: Vector3Tuple[];
  floorY: number;
}

export const SCENE_LAYOUT: Record<StopId, StopLayout> = {
  shelter: {
    building: [-4.5, 0, 15.2], dock: [0, 0, 15], floorY: 1.26, waiting: [],
  },
  'house-a': {
    building: [-39.8, 0, -9.3], dock: [-41.4, 0, -6.1], floorY: 1.38,
    waiting: [[-40.9, 1.38, -6.4], [-38.7, 1.38, -6.4]],
  },
  'house-b': {
    building: [35.4, 0, -26.6], dock: [33.8, 0, -23.4], floorY: 1.38,
    waiting: [[34.8, 1.38, -23.1]],
  },
  'house-c': {
    building: [-5.7, 0, -49.1], dock: [-7.3, 0, -45.9], floorY: 1.38,
    waiting: [[-6.6, 1.38, -46.2]],
  },
};

export const BOAT_SLOTS: { seats: Vector3Tuple[]; cargo: Vector3Tuple[] } = {
  seats: [[-0.28, 0.48, 0.24], [0.28, 0.48, 0.24]],
  cargo: [[-0.28, 0.46, -0.71], [0.28, 0.46, -0.71]],
};
