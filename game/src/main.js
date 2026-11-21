// Tanjung Pelita — boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, dialogue, paused, game over, complete.
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_MONEY, EVENT_OVER } from './world.js';
import {
  ACTION_ATTACK, ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_COMPLETE, SCREEN_DIALOGUE, SCREEN_OVER, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const IDLE = { mx: 0, my: 0, throttle: 0, steer: 0, actions: 0 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private window */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: 0, hasSave: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingActions = 0;

  function announce(message) { status.textContent = message; }

  function startGame() {
    audio.unlock();
    const continued = world.hasSave() && world.load();
    if (!continued) world.reset();
    screen = world.state.dialogue ? SCREEN_DIALOGUE : SCREEN_PLAY;
    announce(continued ? 'Lanjutkan simpanan. ' : 'Baru mulai. ');
    if (world.state.dialogue) announce(`Misi: ${world.state.dialogue.lines[0]}`);
  }

  function endGame() {
    if (world.state.gameOver === 'complete') {
      screen = SCREEN_COMPLETE;
      if (world.state.money > best) { best = world.state.money; saveBest(best); }
      audio.mission();
      announce('Tamat! Tanjung Pelita tenang.');
    } else {
      screen = SCREEN_OVER;
      if (world.state.money > best) { best = world.state.money; saveBest(best); }
      audio.busted();
      announce(world.state.gameOver === 'busted' ? 'Tertangkap!' : 'K.O.!');
    }
  }

  function advanceDialogue() {
    const d = world.state.dialogue;
    if (!d) { screen = SCREEN_PLAY; return; }
    audio.click();
    if (d.index < d.lines.length - 1) {
      d.index += 1;
      return;
    }
    const events = world.closeDialogue();
    if (world.state.gameOver === 'complete' || events & EVENT_OVER) {
      endGame();
    } else if (world.state.dialogue) {
      screen = SCREEN_DIALOGUE; // the next mission's brief
    } else {
      screen = SCREEN_PLAY;
    }
  }

  /** Handle one batch of one-shot presses. Returns the gameplay actions (ENTER/ATTACK)
   * that are still live for the world this frame; a batch a screen transition consumed
   * returns 0, so starting the game never fires an instant punch. */
  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & (ACTION_CONFIRM | ACTION_ATTACK | ACTION_ENTER)) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) { startGame(); return 0; }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        world.save();
        announce('Jeda. Simpanan tersimpan.');
        return 0;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Lanjut main.');
        return 0;
      }
    } else if (screen === SCREEN_DIALOGUE) {
      if (actions & ACTION_CONFIRM) { advanceDialogue(); return 0; }
    } else if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        world.reset();
        screen = SCREEN_TITLE;
        announce('Tanjung Pelita. Tekan Enter untuk mulai.');
        return 0;
      }
    }
    return actions & (ACTION_ENTER | ACTION_ATTACK);
  }

  function handleEvents(events) {
    if (!events) return;
    if (events & EVENT_MONEY) audio.pickup();
    if (events & EVENT_MISSION) {
      audio.mission();
      world.save();
      if (world.state.money > best) { best = world.state.money; saveBest(best); }
    }
    if (events & EVENT_OVER) endGame();
    else if (world.state.dialogue && screen === SCREEN_PLAY) screen = SCREEN_DIALOGUE;
  }

  function buildInput(actions) {
    const w = input.walk();
    const d = input.drive();
    return { mx: w.mx, my: w.my, throttle: d.throttle, steer: d.steer, actions };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, IDLE, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, buildInput(pendingActions), false);
    pendingActions = 0;
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    pendingActions |= handleActions(input.takeActions());
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    // Paused, dialogue, over and complete screens never step: drop the built-up
    // time so resuming does not fast-forward through the missed frames.
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, { best, hasSave: world.hasSave() });
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Jeda.');
    }
  });

  announce('Tanjung Pelita. Tekan Enter atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
