import { expect, test, vi } from 'vitest';
import { createAmbience } from './ambience';

test('ambience builds a local loop only when enabled and releases its audio context', () => {
  const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), loop: false, buffer: null };
  const filter = { connect: vi.fn(), type: '', frequency: { value: 0 } };
  const gain = { connect: vi.fn(), gain: { value: 0, setTargetAtTime: vi.fn() } };
  const context = {
    currentTime: 3,
    sampleRate: 8000,
    destination: {},
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(8000) })),
    createBufferSource: vi.fn(() => source),
    createBiquadFilter: vi.fn(() => filter),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  } as unknown as AudioContext;
  const ambience = createAmbience(() => context);

  expect(context.createBufferSource).not.toHaveBeenCalled();
  ambience.setEnabled(true);
  expect(source.loop).toBe(true);
  expect(source.start).toHaveBeenCalledOnce();
  expect(filter.frequency.value).toBe(720);
  ambience.setEnabled(false);
  expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.4);

  ambience.dispose();
  expect(source.stop).toHaveBeenCalledOnce();
  expect(context.close).toHaveBeenCalledOnce();
});
