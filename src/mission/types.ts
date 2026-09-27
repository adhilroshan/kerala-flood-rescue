export type HouseId = 'house-a' | 'house-b' | 'house-c';

export type StopId = 'shelter' | HouseId;

export interface StopDefinition {
  id: StopId;
  label: string;
  x: number;
  z: number;
  evacuees: number;
  supplyRequested: boolean;
  story: string;
}

export interface MissionState {
  discovered: StopId[];
  waiting: Record<HouseId, number>;
  pendingSupplies: HouseId[];
  passengers: number;
  boatCrates: number;
  shelterCrates: number;
  rescued: number;
  delivered: number;
  complete: boolean;
}

export type MissionAction =
  | { type: 'discover'; stop: StopId }
  | { type: 'board' | 'deliver'; stop: HouseId }
  | { type: 'unload' | 'reload' };

export interface MissionResult {
  state: MissionState;
  message: string;
  changed: boolean;
}
