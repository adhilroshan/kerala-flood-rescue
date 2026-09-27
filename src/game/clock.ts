export const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25;

export interface ClockAdvance {
  steps: number;
  remainder: number;
}

export function advanceClock(elapsed: number, remainder: number): ClockAdvance {
  const boundedElapsed = Math.max(0, Math.min(elapsed, MAX_FRAME_TIME));
  const accumulated = Math.max(0, remainder) + boundedElapsed;
  const steps = Math.floor((accumulated + 1e-10) / FIXED_STEP);
  return {
    steps,
    remainder: Math.max(0, accumulated - steps * FIXED_STEP),
  };
}
