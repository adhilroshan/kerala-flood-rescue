export interface Ambience {
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createAmbience(contextFactory?: () => AudioContext): Ambience {
  let context: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let disposed = false;

  function initialize(): boolean {
    if (context) return true;
    if (!contextFactory && typeof AudioContext === 'undefined') return false;

    try {
      context = contextFactory ? contextFactory() : new AudioContext();
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] = Math.random() * 2 - 1;
      }

      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 720;
      gain = context.createGain();
      gain.gain.value = 0;
      source.connect(lowPass);
      lowPass.connect(gain);
      gain.connect(context.destination);
      source.start();
      return true;
    } catch {
      source = null;
      gain = null;
      void context?.close();
      context = null;
      return false;
    }
  }

  return {
    setEnabled(enabled: boolean): void {
      if (disposed) return;
      if (enabled && !initialize()) return;
      if (!context || !gain) return;
      if (context.state === 'suspended') void context.resume().catch(() => {});
      gain.gain.setTargetAtTime(enabled ? 0.035 : 0, context.currentTime, 0.4);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        source?.stop();
      } catch {
        // The source can already be stopped if its context was closed externally.
      }
      void context?.close();
      source = null;
      gain = null;
      context = null;
    },
  };
}
