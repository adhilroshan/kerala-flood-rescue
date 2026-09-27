import { STOPS } from '../mission/data';
import type { GameController, GameSnapshot } from '../game/controller';
import type { HouseId } from '../mission/types';
import { SCENE_LAYOUT, WORLD_LIMIT } from '../world/anchors';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function makeButton(label: string, action: string, onClick: () => void, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.action = action;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function makeDriveButton(
  label: string,
  control: 'forward' | 'reverse' | 'left' | 'right',
  controller: GameController,
): HTMLButtonElement {
  const button = makeButton(label, control, () => {}, 'drive-button');
  button.setAttribute('aria-label', `${label} boat (hold)`);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    controller.setDriveInput(control, true);
    button.dataset.held = 'true';
  });
  const release = (): void => {
    controller.setDriveInput(control, false);
    delete button.dataset.held;
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('pointerleave', release);
  return button;
}

function stopLabel(stop: GameSnapshot['nearby']): string {
  return STOPS.find((item) => item.id === stop)?.label ?? 'landing';
}

function requestDescription(snapshot: GameSnapshot, stopId: HouseId): string {
  const waiting = snapshot.mission.waiting[stopId];
  const needsCrate = snapshot.mission.pendingSupplies.includes(stopId);
  const people = waiting ? `${waiting} ${waiting === 1 ? 'neighbor' : 'neighbors'} waiting` : 'evacuated';
  const supplies = needsCrate ? 'crate requested' : 'no crate needed';
  return `${people}; ${supplies}`;
}

export function createInterface(
  root: HTMLElement,
  controller: GameController,
): { update(snapshot: GameSnapshot): void; dispose(): void } {
  root.innerHTML = `
    <a class="skip-link" href="#game-controls">Skip to rescue controls</a>
    <main class="game-chrome" aria-label="Kerala Flood Rescue game interface">
      <header class="masthead">
        <div class="brand-mark" aria-hidden="true">KFR</div>
        <div class="brand-copy">
          <p class="eyebrow">Kerala · 2018 flood response</p>
          <h1 class="brand-title">Rescue operations</h1>
        </div>
        <p class="fiction-note">A fictional neighborhood story</p>
      </header>
      <section id="game-controls" class="mission-hud" aria-label="Mission progress"></section>
      <div id="game-interaction" class="interaction-prompt"></div>
      <section id="game-status" class="radio-panel" role="status" aria-live="polite" aria-atomic="true"></section>
      <div id="touch-controls" class="touch-controls" aria-label="Touch boat controls" hidden></div>
      <p class="control-legend" aria-label="Boat controls">WASD / arrows · steer &nbsp; E · dock &nbsp; M · map &nbsp; Esc · pause</p>
      <div id="game-overlay" class="overlay-layer"></div>
    </main>`;

  const controls = root.querySelector<HTMLElement>('#game-controls')!;
  const interaction = root.querySelector<HTMLElement>('#game-interaction')!;
  const status = root.querySelector<HTMLElement>('#game-status')!;
  const touchControls = root.querySelector<HTMLElement>('#touch-controls')!;
  const overlay = root.querySelector<HTMLElement>('#game-overlay')!;
  const steering = document.createElement('div');
  steering.className = 'drive-pair';
  steering.append(makeDriveButton('←', 'left', controller), makeDriveButton('→', 'right', controller));
  const throttle = document.createElement('div');
  throttle.className = 'drive-pair';
  throttle.append(makeDriveButton('↑', 'forward', controller), makeDriveButton('↓', 'reverse', controller));
  touchControls.append(steering, throttle);
  overlay.hidden = true;
  let previousOverlay: GameSnapshot['overlay'] = null;
  let previousMission: GameSnapshot['mission'] | null = null;
  let previousNearby: GameSnapshot['nearby'] = null;
  let previousSoundOn: boolean | null = null;
  let previousInteractionKey = '';
  let returnFocus: HTMLElement | null = null;

  function renderHud(snapshot: GameSnapshot): void {
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
    controls.replaceChildren();
    const objective = document.createElement('div');
    objective.className = 'objective-line';
    const objectiveTitle = document.createElement('p');
    objectiveTitle.className = 'eyebrow';
    objectiveTitle.textContent = 'On this trip';
    const objectiveCopy = document.createElement('p');
    objectiveCopy.className = 'objective-copy';
    objectiveCopy.textContent = snapshot.mission.complete
      ? 'The neighborhood has reached the shelter.'
      : `${4 - snapshot.mission.rescued} neighbors to shelter · ${snapshot.mission.pendingSupplies.length} supply requests`;
    objective.append(objectiveTitle, objectiveCopy);

    const counters = document.createElement('div');
    counters.className = 'mission-counters';
    const stats: Array<[string, string, string]> = [
      ['Neighbors safe', `${snapshot.mission.rescued} / 4`, 'people'],
      ['Supplies delivered', `${snapshot.mission.delivered} / 2`, 'crates'],
      ['Aboard', `${snapshot.mission.passengers} / 2`, 'people'],
      ['Boat cargo', `${snapshot.mission.boatCrates} / 2`, 'crates'],
    ];
    for (const [label, value, detail] of stats) {
      const item = document.createElement('div');
      item.className = 'counter-item';
      const caption = document.createElement('span');
      caption.className = 'counter-label';
      caption.textContent = label;
      const number = document.createElement('strong');
      number.className = 'counter-value';
      number.textContent = value;
      number.setAttribute('aria-label', `${label}: ${value} ${detail}`);
      item.append(caption, number);
      counters.append(item);
    }

    const actions = document.createElement('div');
    actions.className = 'utility-actions';
    actions.append(
      makeButton('Map', 'map', () => controller.toggleMap(), 'utility-button'),
      makeButton('Pause', 'pause', () => controller.togglePause(), 'utility-button'),
    );
    controls.append(objective, counters, actions);
    if (focusedAction) {
      controls.querySelector<HTMLElement>(`[data-action="${focusedAction}"]`)?.focus();
    }
  }

  function renderInteraction(snapshot: GameSnapshot): void {
    interaction.replaceChildren();
    if (!snapshot.nearby || snapshot.overlay !== null) return;
    if (!snapshot.dockReady) {
      const hint = document.createElement('p');
      hint.className = 'dock-hint';
      hint.textContent = `Slow to dock · ${stopLabel(snapshot.nearby)}`;
      interaction.append(hint);
      return;
    }
    interaction.append(makeButton(
      `Dock at ${stopLabel(snapshot.nearby)}`,
      'interact',
      () => controller.interact(),
      'dock-button',
    ));
  }

  function addDialogNote(dialog: HTMLElement, text: string): void {
    if (!text) return;
    const note = document.createElement('p');
    note.className = 'dialog-note';
    note.textContent = text;
    dialog.append(note);
  }

  function renderStopDialog(dialog: HTMLElement, snapshot: GameSnapshot): void {
    if (!snapshot.nearby) return;
    const stop = STOPS.find((item) => item.id === snapshot.nearby);
    if (!stop) return;
    const story = document.createElement('p');
    story.className = 'story-copy';
    story.textContent = stop.story;
    dialog.append(story);

    if (stop.id === 'shelter') {
      const shelterCopy = document.createElement('p');
      shelterCopy.className = 'resource-copy';
      shelterCopy.textContent = `${snapshot.mission.passengers} neighbors aboard · ${snapshot.mission.shelterCrates} crates at the shelter`;
      dialog.append(shelterCopy);
      if (snapshot.mission.passengers > 0) {
        dialog.append(makeButton('Bring passengers ashore', 'unload', () => controller.act('unload'), 'primary-action'));
      }
      const available = Math.min(2 - snapshot.mission.boatCrates, snapshot.mission.shelterCrates);
      if (available > 0) {
        dialog.append(makeButton(`Load ${available} supply ${available === 1 ? 'crate' : 'crates'}`, 'reload', () => controller.act('reload'), 'primary-action'));
      }
      if (snapshot.mission.passengers === 0 && available === 0) {
        addDialogNote(dialog, 'The shelter is ready. Follow the radio calls to the next household.');
      }
      return;
    }

    const people = snapshot.mission.waiting[stop.id];
    const hasSeats = snapshot.mission.passengers + people <= 2;
    const needsCrate = snapshot.mission.pendingSupplies.includes(stop.id);
    if (people > 0 && hasSeats) {
      dialog.append(makeButton(
        `Bring ${people} ${people === 1 ? 'neighbor' : 'neighbors'} aboard`,
        'board',
        () => controller.act('board'),
        'primary-action',
      ));
    }
    if (needsCrate && snapshot.mission.boatCrates > 0) {
      dialog.append(makeButton('Deliver a supply crate', 'deliver', () => controller.act('deliver'), 'secondary-action'));
    }

    if (people > 0 && !hasSeats) {
      addDialogNote(dialog, 'There is not enough room for this household. Return to the shelter and bring the passengers ashore first.');
    } else if (needsCrate && snapshot.mission.boatCrates === 0) {
      addDialogNote(dialog, 'No crates are aboard. Return to the shelter to load supplies.');
    } else if (people === 0 && !needsCrate) {
      addDialogNote(dialog, 'This stop has been taken care of.');
    }
  }

  function renderMap(dialog: HTMLElement, snapshot: GameSnapshot): void {
    const summary = document.createElement('p');
    summary.className = 'story-copy';
    summary.textContent = 'Discovered stops and requests. The boat marker follows your current position.';
    dialog.append(summary);

    const plot = document.createElement('div');
    plot.className = 'map-plot';
    plot.setAttribute('aria-hidden', 'true');
    const river = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    river.setAttribute('viewBox', '0 0 100 100');
    river.setAttribute('preserveAspectRatio', 'none');
    river.classList.add('map-river');
    river.innerHTML = '<path d="M52 0 C35 19 63 31 48 49 S36 76 47 100"/><path d="M0 57 C25 50 67 69 100 44"/>';
    plot.append(river);

    for (const stop of STOPS.filter((item) => snapshot.mission.discovered.includes(item.id))) {
      const marker = document.createElement('span');
      marker.className = `map-marker${stop.id === 'shelter' ? ' is-shelter' : ''}`;
      const [dockX, , dockZ] = SCENE_LAYOUT[stop.id].dock;
      marker.style.left = `${((dockX + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100}%`;
      marker.style.top = `${100 - ((dockZ + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100}%`;
      marker.textContent = stop.id === 'shelter' ? 'S' : '•';
      plot.append(marker);
    }
    const boat = document.createElement('span');
    boat.className = 'map-boat';
    boat.style.left = `${((snapshot.boat.x + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100}%`;
    boat.style.top = `${100 - ((snapshot.boat.z + WORLD_LIMIT) / (WORLD_LIMIT * 2)) * 100}%`;
    boat.textContent = 'B';
    plot.append(boat);
    dialog.append(plot);

    const key = document.createElement('ul');
    key.className = 'map-key';
    for (const stop of STOPS.filter((item) => snapshot.mission.discovered.includes(item.id))) {
      const item = document.createElement('li');
      if (stop.id === 'shelter') {
        item.textContent = `S — ${stop.label}; ${snapshot.mission.shelterCrates} crates available`;
      } else {
        item.textContent = `${stop.label} — ${requestDescription(snapshot, stop.id)}`;
      }
      key.append(item);
    }
    const boatKey = document.createElement('li');
    boatKey.textContent = 'B — your boat';
    key.append(boatKey);
    dialog.append(key);
  }

  function renderOverlay(snapshot: GameSnapshot): void {
    const changedOverlay = previousOverlay !== snapshot.overlay;
    const focusedAction = (document.activeElement as HTMLElement | null)?.dataset.action;
    const shouldRememberFocus = previousOverlay === null && snapshot.overlay !== null;
    if (shouldRememberFocus) returnFocus = document.activeElement as HTMLElement | null;
    overlay.replaceChildren();
    overlay.hidden = snapshot.overlay === null;
    overlay.classList.toggle('is-landing', snapshot.overlay === 'stop');

    if (snapshot.overlay === null) {
      if (previousOverlay !== null) {
        const target = returnFocus?.isConnected
          ? returnFocus
          : controls.querySelector<HTMLElement>('button[data-action="map"]');
        target?.focus();
      }
      previousOverlay = null;
      return;
    }

    const dialog = document.createElement('section');
    dialog.className = `mission-dialog dialog-${snapshot.overlay}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    const heading = document.createElement('h2');
    heading.id = 'dialog-title';
    heading.tabIndex = -1;
    heading.textContent = snapshot.overlay === 'stop'
      ? stopLabel(snapshot.nearby)
      : snapshot.overlay === 'epilogue' ? 'The neighborhood, together'
      : snapshot.overlay === 'opening' ? 'A way through the water'
      : snapshot.overlay === 'map' ? 'Rescue map' : 'Pause & help';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow dialog-eyebrow';
    eyebrow.textContent = snapshot.overlay === 'opening' || snapshot.overlay === 'epilogue'
      ? 'Kerala · August 2018' : snapshot.overlay === 'stop' ? 'At the landing' : 'Field notes';
    dialog.append(eyebrow, heading);

    if (snapshot.overlay === 'opening') {
      const intro = document.createElement('p');
      intro.className = 'story-copy';
      intro.textContent = 'A fictional neighborhood inspired by the 2018 Kerala floods. Take the rescue boat through flooded lanes, bring four neighbors to the shelter, and deliver supplies to families who are staying nearby.';
      const brief = document.createElement('p');
      brief.className = 'dialog-note';
      brief.textContent = 'W/S move · A/D to steer · E dock · M map · Esc pause. No rush clock: listen for calls and make each trip count.';
      dialog.append(intro, brief, makeButton('Begin rescue', 'start', () => controller.start(), 'primary-action'));
    } else if (snapshot.overlay === 'stop') {
      renderStopDialog(dialog, snapshot);
      addDialogNote(dialog, snapshot.message);
    } else if (snapshot.overlay === 'map') {
      renderMap(dialog, snapshot);
    } else if (snapshot.overlay === 'pause') {
      const help = document.createElement('p');
      help.className = 'story-copy';
      help.textContent = 'WASD or arrows steer the boat. E opens a landing. M opens this map. Return to a safe patch of water if you get stuck.';
      dialog.append(help);
      dialog.append(makeButton('Return boat to safe water', 'reset', () => controller.resetBoat(), 'secondary-action'));
      dialog.append(makeButton(snapshot.soundOn ? 'Mute rain ambience' : 'Play rain ambience', 'sound', () => controller.toggleSound(), 'secondary-action'));
      addDialogNote(dialog, snapshot.message);
    } else if (snapshot.overlay === 'epilogue') {
      const ending = document.createElement('p');
      ending.className = 'story-copy';
      ending.textContent = 'Four neighbors reached the shelter. Two crates reached the families staying nearby. In the real floods, people across Kerala came together in extraordinary acts of rescue and care. This small fictional story is offered in their memory.';
      const totals = document.createElement('p');
      totals.className = 'completion-stamp';
      totals.textContent = `Neighbors safe ${snapshot.mission.rescued}/4 · supplies delivered ${snapshot.mission.delivered}/2`;
      dialog.append(ending, totals, makeButton('Return to the neighborhood', 'finish', () => controller.closeOverlay(), 'primary-action'));
    }

    const closeLabel = snapshot.overlay === 'map' ? 'Close map'
      : snapshot.overlay === 'pause' ? 'Resume mission'
      : snapshot.overlay === 'stop' ? 'Return to boat' : '';
    if (closeLabel) dialog.append(makeButton(closeLabel, 'close', () => controller.closeOverlay(), 'close-button'));

    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) {
        event.preventDefault();
        heading.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    overlay.append(dialog);

    if (changedOverlay) {
      heading.focus();
    } else if (focusedAction) {
      const replacementFocus = dialog.querySelector<HTMLElement>(`[data-action="${focusedAction}"]`);
      if (replacementFocus) replacementFocus.focus();
      else heading.focus();
    }
    previousOverlay = snapshot.overlay;
  }

  function update(snapshot: GameSnapshot): void {
    touchControls.hidden = snapshot.overlay !== null;
    const shouldUpdateHud = previousMission !== snapshot.mission || previousNearby !== snapshot.nearby;
    if (previousOverlay !== snapshot.overlay || previousMission !== snapshot.mission || previousSoundOn !== snapshot.soundOn) {
      renderOverlay(snapshot);
    }
    if (shouldUpdateHud) renderHud(snapshot);
    const interactionKey = `${snapshot.nearby ?? 'none'}:${snapshot.dockReady}:${snapshot.overlay ?? 'playing'}`;
    if (interactionKey !== previousInteractionKey) {
      renderInteraction(snapshot);
      previousInteractionKey = interactionKey;
    }
    const liveMessage = [snapshot.radio, snapshot.message].filter(Boolean).join(' · ');
    status.textContent = liveMessage;
    status.hidden = liveMessage.length === 0;

    previousMission = snapshot.mission;
    previousNearby = snapshot.nearby;
    previousSoundOn = snapshot.soundOn;
  }

  function dispose(): void {
    controls.replaceChildren();
    interaction.replaceChildren();
    status.replaceChildren();
    overlay.replaceChildren();
    root.replaceChildren();
    previousInteractionKey = '';
  }

  return { update, dispose };
}
