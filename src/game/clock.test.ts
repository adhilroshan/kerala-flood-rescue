import { expect, test } from 'vitest';
import { advanceClock, FIXED_STEP } from './clock';

test('low frame rates preserve elapsed simulation time', () => {
  let remainder = 0;
  let simulatedSteps = 0;

  for (let frame = 0; frame < 8; frame += 1) {
    const result = advanceClock(0.125, remainder);
    simulatedSteps += result.steps;
    remainder = result.remainder;
  }

  expect(simulatedSteps).toBe(60);
  expect(remainder).toBeCloseTo(0, 10);
  expect(FIXED_STEP).toBeCloseTo(1 / 60, 10);
});

test('long background stalls have a bounded catch-up instead of a movement jump', () => {
  const result = advanceClock(2, 0);

  expect(result.steps).toBe(15);
  expect(result.remainder).toBeCloseTo(0, 10);
});
