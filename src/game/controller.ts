import { STOPS } from '../mission/data';
import { applyMissionAction, createMission } from '../mission/model';
import type { HouseId, MissionAction, MissionState, StopId } from '../mission/types';
import type { Ambience } from '../audio/ambience';
import type { World } from '../world/world';

export interface GameSnapshot {
  mission: MissionState;
  overlay: 'opening' | 'map' | 'pause' | 'stop' | 'epilogue' | null;
  nearby: StopId | null;
  dockReady: boolean;
  message: string;
  radio: string;
  boat: { x: number; z: number };
  soundOn: boolean;
}

export interface GameController {
  start(): void;
  tick(dt: number): void;
  interact(): void;
  act(action: 'board' | 'deliver' | 'unload' | 'reload'): void;
  toggleMap(): void;
  togglePause(): void;
  closeOverlay(): void;
  resetBoat(): void;
  toggleSound(): void;
  setDriveInput(control: 'forward' | 'reverse' | 'left' | 'right', held: boolean): void;
  snapshot(): GameSnapshot;
  dispose(): void;
}

const RADIO_CALLS: ReadonlyArray<{ stop: HouseId; message: string }> = [
  { stop: 'house-a', message: 'Radio: A family near the canal is signaling from an upstairs landing.' },
  { stop: 'house-b', message: 'Radio: One neighbor on Palm Lane is ready for a safe ride.' },
  { stop: 'house-c', message: 'Radio: A resident near the old school road needs a lift to the shelter.' },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function asHouseId(stop: StopId): HouseId | null {
  return stop === 'shelter' ? null : stop;
}

export function createController(
  world: World,
  onChange: (snapshot: GameSnapshot) => void,
  ambience?: Ambience,
): GameController {
  let mission = createMission();
  let overlay: GameSnapshot['overlay'] = 'opening';
  let returnOverlay: 'stop' | null = null;
  let nearby: StopId | null = null;
  let message = '';
  let radio = '';
  let soundOn = false;
  let started = false;
  let radioElapsed = 0;
  let radioIndex = 0;
  const pressed = new Set<string>();
  const touchPressed = new Set<'forward' | 'reverse' | 'left' | 'right'>();
  world.setMission(mission);

  const snapshot = (): GameSnapshot => ({
    mission,
    overlay,
    nearby,
    dockReady: world.dockReady(),
    message,
    radio,
    boat: world.position(),
    soundOn,
  });

  const publish = (): void => {
    if (overlay !== null) touchPressed.clear();
    onChange(snapshot());
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat && ['e', 'm', 'escape'].includes(key)) return;

    if (key === 'm') {
      toggleMap();
      return;
    }
    if (key === 'escape') {
      if (overlay === 'stop' || overlay === 'map' || overlay === 'pause') closeOverlay();
      else if (overlay === 'opening') start();
      else togglePause();
      return;
    }
    if (key === 'e') {
      if (overlay === null) interact();
      return;
    }
    pressed.add(key);
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.key.toLowerCase());
  };
  const handleBlur = (): void => { pressed.clear(); touchPressed.clear(); };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);

  function apply(action: MissionAction): void {
    const result = applyMissionAction(mission, action);
    message = result.message;
    if (result.changed) {
      mission = result.state;
      world.setMission(mission);
    }
  }

  function start(): void {
    if (overlay !== 'opening') return;
    started = true;
    overlay = null;
    message = 'Load the relief crates, then follow the radio calls.';
    publish();
  }

  function interact(): void {
    if (!started || overlay !== null) return;
    nearby = world.nearestStop();
    if (!nearby) {
      message = 'Move closer to a marked landing to interact.';
      publish();
      return;
    }
    if (!world.dockReady()) {
      message = 'Slow the boat near the landing before docking.';
      publish();
      return;
    }
    const stop = nearby;
    if (stop !== 'shelter' && !mission.discovered.includes(stop)) {
      apply({ type: 'discover', stop });
    }
    message = '';
    overlay = 'stop';
    publish();
  }

  function act(action: 'board' | 'deliver' | 'unload' | 'reload'): void {
    if (!started || overlay === 'opening' || overlay === 'epilogue') return;
    nearby = world.nearestStop();
    if (action === 'board' || action === 'deliver') {
      const house = nearby ? asHouseId(nearby) : null;
      if (!house) {
        message = 'Dock beside a household before choosing this action.';
        publish();
        return;
      }
      apply({ type: action, stop: house });
    } else {
      if (nearby !== 'shelter') {
        message = 'Return to the relief shelter for this action.';
        publish();
        return;
      }
      apply({ type: action });
    }
    if (mission.complete) overlay = 'epilogue';
    publish();
  }

  function toggleMap(): void {
    if (!started || overlay === 'opening' || overlay === 'epilogue') return;
    if (overlay === 'map') {
      overlay = returnOverlay;
      returnOverlay = null;
    } else {
      returnOverlay = overlay === 'stop' ? 'stop' : null;
      overlay = 'map';
    }
    publish();
  }

  function togglePause(): void {
    if (!started || overlay === 'opening' || overlay === 'epilogue') return;
    if (overlay === 'pause') {
      overlay = returnOverlay;
      returnOverlay = null;
    } else {
      returnOverlay = overlay === 'stop' ? 'stop' : null;
      overlay = 'pause';
    }
    publish();
  }

  function closeOverlay(): void {
    if (overlay === 'opening') {
      start();
    } else if (overlay === 'map' || overlay === 'pause') {
      overlay = returnOverlay;
      returnOverlay = null;
      publish();
    } else if (overlay === 'stop' || overlay === 'epilogue') {
      overlay = null;
      publish();
    }
  }

  function resetBoat(): void {
    world.resetToSafeWater();
    nearby = world.nearestStop();
    message = 'The boat is back in safe water.';
    publish();
  }

  function toggleSound(): void {
    soundOn = !soundOn;
    ambience?.setEnabled(soundOn);
    publish();
  }

  function setDriveInput(control: 'forward' | 'reverse' | 'left' | 'right', held: boolean): void {
    if (held && started && overlay === null) touchPressed.add(control);
    else touchPressed.delete(control);
  }

  function tick(dt: number): void {
    const paused = !started || overlay !== null;
    const throttle = paused ? 0
      : Number(pressed.has('w') || pressed.has('arrowup') || touchPressed.has('forward'))
        - Number(pressed.has('s') || pressed.has('arrowdown') || touchPressed.has('reverse'));
    // The +Z-forward boat and the following Three.js camera mirror horizontal screen direction.
    const steer = paused ? 0
      : Number(pressed.has('a') || pressed.has('arrowleft') || touchPressed.has('left'))
        - Number(pressed.has('d') || pressed.has('arrowright') || touchPressed.has('right'));
    world.tick(dt, { throttle, steer, paused });
    nearby = world.nearestStop();

    if (started && overlay === null) {
      if (nearby && nearby !== 'shelter' && !mission.discovered.includes(nearby)) {
        apply({ type: 'discover', stop: nearby });
        message = `${STOPS.find((stop) => stop.id === nearby)?.label ?? 'A new stop'} added to the map.`;
        publish();
      }
      radioElapsed += Math.max(0, Math.min(dt, 0.05));
      if (radioIndex < RADIO_CALLS.length && radioElapsed >= 3.6 - 1e-6) {
        const call = RADIO_CALLS[radioIndex];
        radio = call.message;
        if (!mission.discovered.includes(call.stop)) {
          apply({ type: 'discover', stop: call.stop });
          message = `${STOPS.find((stop) => stop.id === call.stop)?.label ?? 'A new stop'} added to the map.`;
        }
        radioIndex += 1;
        radioElapsed = 0;
        publish();
      }
    }
  }

  function dispose(): void {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
    ambience?.dispose();
    pressed.clear();
    touchPressed.clear();
  }

  return {
    start,
    tick,
    interact,
    act,
    toggleMap,
    togglePause,
    closeOverlay,
    resetBoat,
    toggleSound,
    setDriveInput,
    snapshot,
    dispose,
  };
}
