import { createAmbience } from './audio/ambience';
import { advanceClock, FIXED_STEP } from './game/clock';
import { createController } from './game/controller';
import { createInterface } from './ui/render';
import './ui/styles.css';
import { loadWorldAssets } from './world/assets';
import { createWorld } from './world/world';

const app = document.querySelector<HTMLElement>('#app');
const scene = document.querySelector<HTMLElement>('#scene');

function showFallback(message: string, retry?: () => void): void {
  if (!app) return;
  app.replaceChildren();
  const main = document.createElement('main');
  main.className = 'webgl-fallback';
  main.setAttribute('role', 'alert');
  const heading = document.createElement('h1');
  heading.textContent = 'The rescue boat cannot launch';
  const copy = document.createElement('p');
  copy.textContent = message;
  main.append(heading, copy);
  if (retry) {
    const button = document.createElement('button');
    button.textContent = 'Retry loading scene';
    button.addEventListener('click', retry, { once: true });
    main.append(button);
  }
  app.append(main);
}

function showLoading(loaded: number, total: number): void {
  if (!app) return;
  app.replaceChildren();
  const panel = document.createElement('section');
  panel.className = 'asset-loading';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-busy', 'true');
  const heading = document.createElement('p');
  heading.textContent = 'Preparing the flooded neighborhood';
  const detail = document.createElement('p');
  detail.textContent = total > 0 ? `Loading scene assets: ${loaded} of ${total}` : 'Preparing scene assets…';
  panel.append(heading, detail);
  app.append(panel);
}

if (!app || !scene) {
  throw new Error('The game requires #scene and #app mount points.');
}

const probe = document.createElement('canvas');
const hasWebGL = Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
if (!hasWebGL) {
  showFallback('This 3D mission needs WebGL. Try an updated browser with hardware acceleration enabled.');
} else {
  let world: ReturnType<typeof createWorld> | null = null;
  let game: ReturnType<typeof createController> | null = null;
  let view: ReturnType<typeof createInterface> | null = null;
  let frame = 0;
  let lastFrame = performance.now();
  let simulationRemainder = 0;
  let active = true;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stop = (): void => {
    active = false;
    cancelAnimationFrame(frame);
    game?.dispose();
    view?.dispose();
    world?.dispose();
    game = null;
    view = null;
    world = null;
  };
  const start = async (): Promise<void> => {
    active = true;
    showLoading(0, 0);
    try {
      const assets = await loadWorldAssets((loaded, total) => showLoading(loaded, total));
      if (!active) return;
      world = createWorld(scene, reducedMotion, assets);
      const devEnvironment = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
      if (devEnvironment?.DEV === true && world) {
        const debugWorld = world;
        (window as unknown as { __rescueDiagnostics?: () => unknown }).__rescueDiagnostics =
          () => debugWorld.diagnostics?.() ?? null;
      }
      const ambience = createAmbience();
      game = createController(world, (snapshot) => view?.update(snapshot), ambience);
      view = createInterface(app, game);
      view.update(game.snapshot());
      lastFrame = performance.now();

      const animate = (now: number): void => {
        if (!active || !game || !world || !view) return;
        const elapsed = Math.max((now - lastFrame) / 1000, 0);
        lastFrame = now;
        const advance = advanceClock(elapsed, simulationRemainder);
        simulationRemainder = advance.remainder;
        for (let step = 0; step < advance.steps; step += 1) game.tick(FIXED_STEP);
        world.render();
        view.update(game.snapshot());
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    } catch {
      stop();
      showFallback('Scene assets could not be loaded from this game. Check your connection to the game server and retry.', () => { void start(); });
    }
  };

  window.addEventListener('pagehide', stop, { once: true });
  void start();
}
