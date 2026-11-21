// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always gives
// the same frame. The autopilot drives a loop around the city, or walks toward the
// nearest guard and shoots, using the world's own step function and input shape.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 9;
const CHASE_SECONDS = 10;
const MISSION_SECONDS = 8;
const IDLE = { mx: 0, my: 0, throttle: 0, steer: 0, actions: 0 };

/** A loop around the city the driving autopilot follows, waypoint by waypoint. */
const LOOP = [
  { x: 2100, y: 700 }, { x: 2100, y: 1400 },
  { x: 400, y: 1400 }, { x: 400, y: 700 },
];

function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function driveAutopilot(state) {
  const v = state.player.vehicle;
  if (!v) return IDLE;
  const wp = LOOP[state._wp || 0];
  const dx = wp.x - v.x, dy = wp.y - v.y;
  if (Math.hypot(dx, dy) < 80) {
    state._wp = ((state._wp || 0) + 1) % LOOP.length;
    return { mx: 0, my: 0, throttle: 1, steer: 0, actions: 0 };
  }
  const want = Math.atan2(dy, dx);
  const steer = clamp(angDiff(v.angle, want) * 2.2, -1, 1);
  return { mx: 0, my: 0, throttle: 1, steer, actions: 0 };
}

function fightAutopilot(state) {
  const p = state.player;
  const alive = state.guards.filter((g) => g.hp > 0);
  if (alive.length === 0) return IDLE;
  let best = alive[0], bestD = Infinity;
  for (const g of alive) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestD) { bestD = d; best = g; }
  }
  const want = Math.atan2(best.y - p.y, best.x - p.x);
  const mx = Math.cos(want), my = Math.sin(want);
  const actions = p.hasGun && bestD < 420 ? 8 : 0; // ATTACK when the pistol can reach
  return { mx, my, throttle: 0, steer: 0, actions };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any name that is not a known scene is the title.
 */
export function stageShot(name, world) {
  const s = world.state;
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, IDLE, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  // For the mission shot, jump to mission 4 before closing the brief.
  if (name === 'mission') s.missionIndex = 3;
  // Close the opening brief so the world is playable.
  world.closeDialogue();

  if (name === 'play') {
    const angkot = s.vehicles.find((v) => v.type === 'angkot' && v.parked);
    if (angkot) {
      s.player.x = angkot.x - 44; s.player.y = angkot.y;
      world.enterVehicle(angkot);
    }
    s._wp = 0;
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      world.step(STEP, driveAutopilot(s), false);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'chase') {
    const car = s.vehicles.find((v) => v.type === 'mobil' && v.parked);
    if (car) {
      s.player.x = car.x - 44; s.player.y = car.y;
      world.enterVehicle(car);
    }
    s.wanted = 3;
    s._wp = 1;
    for (let index = 0; index < CHASE_SECONDS / STEP; index += 1) {
      world.step(STEP, driveAutopilot(s), false);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // mission: the harbour boss fight (mission 4 was begun above).
  s.player.x = 2060; s.player.y = 1330;
  s.player.hasGun = true;
  s.camera.x = Math.max(0, s.player.x - 640);
  s.camera.y = Math.max(0, s.player.y - 360);
  for (let index = 0; index < MISSION_SECONDS / STEP; index += 1) {
    world.step(STEP, fightAutopilot(s), false);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
