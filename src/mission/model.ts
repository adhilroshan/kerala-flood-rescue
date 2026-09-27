import type { HouseId, MissionAction, MissionResult, MissionState } from './types';

const PASSENGER_CAPACITY = 2;
const CRATE_CAPACITY = 2;
const TOTAL_EVACUEES = 4;
const TOTAL_CRATES = 2;

export function createMission(): MissionState {
  return {
    discovered: ['shelter'],
    waiting: { 'house-a': 2, 'house-b': 1, 'house-c': 1 },
    pendingSupplies: ['house-a', 'house-b'],
    passengers: 0,
    boatCrates: 0,
    shelterCrates: TOTAL_CRATES,
    rescued: 0,
    delivered: 0,
    complete: false,
  };
}

export function applyMissionAction(state: MissionState, action: MissionAction): MissionResult {
  const reject = (message: string): MissionResult => ({ state, message, changed: false });
  const accept = (next: MissionState, message: string): MissionResult => ({
    state: {
      ...next,
      complete: next.rescued === TOTAL_EVACUEES && next.delivered === TOTAL_CRATES,
    },
    message,
    changed: true,
  });

  switch (action.type) {
    case 'discover':
      if (state.discovered.includes(action.stop)) return reject('Already on the map.');
      return accept(
        { ...state, discovered: [...state.discovered, action.stop] },
        'New stop added to the map.',
      );

    case 'board': {
      const count = state.waiting[action.stop];
      if (count === 0) return reject('Everyone here has boarded.');
      if (state.passengers + count > PASSENGER_CAPACITY) {
        return reject('Not enough seats. Return to the shelter first.');
      }
      return accept(
        {
          ...state,
          passengers: state.passengers + count,
          waiting: { ...state.waiting, [action.stop]: 0 },
        },
        `${count} neighbor${count === 1 ? '' : 's'} aboard.`,
      );
    }

    case 'deliver':
      if (!state.pendingSupplies.includes(action.stop)) {
        return reject('No outstanding crate request here.');
      }
      if (state.boatCrates === 0) return reject('No crates aboard. Return to the shelter.');
      return accept(
        {
          ...state,
          boatCrates: state.boatCrates - 1,
          delivered: state.delivered + 1,
          pendingSupplies: state.pendingSupplies.filter((stop) => stop !== action.stop),
        },
        'Supplies delivered.',
      );

    case 'unload':
      if (state.passengers === 0) return reject('No passengers to bring ashore.');
      return accept(
        { ...state, rescued: state.rescued + state.passengers, passengers: 0 },
        'Neighbors are safe at the shelter.',
      );

    case 'reload': {
      const count = Math.min(CRATE_CAPACITY - state.boatCrates, state.shelterCrates);
      if (count === 0) return reject('No crates left to load.');
      return accept(
        {
          ...state,
          boatCrates: state.boatCrates + count,
          shelterCrates: state.shelterCrates - count,
        },
        'Crates loaded.',
      );
    }
  }
}

export function isHouseId(stop: string): stop is HouseId {
  return stop === 'house-a' || stop === 'house-b' || stop === 'house-c';
}
