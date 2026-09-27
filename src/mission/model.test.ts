import { expect, test } from 'vitest';
import { applyMissionAction, createMission } from './model';

test('capacity forces a return trip and a failed board leaves state intact', () => {
  let state = createMission();
  state = applyMissionAction(state, { type: 'board', stop: 'house-a' }).state;
  const rejected = applyMissionAction(state, { type: 'board', stop: 'house-b' });

  expect(rejected.changed).toBe(false);
  expect(rejected.state).toBe(state);
  expect(state.passengers).toBe(2);
});

test('crates are unique and every objective is required to finish', () => {
  let state = createMission();
  state = applyMissionAction(state, { type: 'reload' }).state;

  for (const stop of ['house-a', 'house-b'] as const) {
    state = applyMissionAction(state, { type: 'deliver', stop }).state;
  }

  expect(state.delivered).toBe(2);
  expect(state.complete).toBe(false);
  expect(applyMissionAction(state, { type: 'deliver', stop: 'house-a' }).changed).toBe(false);

  state = applyMissionAction(state, { type: 'board', stop: 'house-a' }).state;
  state = applyMissionAction(state, { type: 'unload' }).state;
  for (const stop of ['house-b', 'house-c'] as const) {
    state = applyMissionAction(state, { type: 'board', stop }).state;
  }
  state = applyMissionAction(state, { type: 'unload' }).state;

  expect(state.complete).toBe(true);
});

test('the boat starts empty and loading transfers shelter inventory without creating crates', () => {
  const initial = createMission();
  expect(initial.boatCrates).toBe(0);
  expect(initial.shelterCrates).toBe(2);

  const loaded = applyMissionAction(initial, { type: 'reload' }).state;
  expect(loaded.boatCrates).toBe(2);
  expect(loaded.shelterCrates).toBe(0);
  expect(loaded.boatCrates + loaded.shelterCrates + loaded.delivered).toBe(2);
});
