// Tanjung Pelita — the open world: city, traffic, pedestrians, police, wanted level,
// missions and combat. No drawing and no browser in here: step() advances one fixed step
// and returns what happened as bit flags. All names, places and art are original.
import {
  BEACH_Y, HARBOR, MISSIONS, MONEY, PED, PLAYER, POLICE, ROADS_H, ROADS_V, ROAD_W,
  SAVE_KEY, SEA_Y, VEHICLES, WANTED, WORLD,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_MONEY = 2;
export const EVENT_MISSION = 4;
export const EVENT_OVER = 8;
export const EVENT_BRIEF = 16;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createWorld(random) {
  // ---- City generation (seeded, so the same seed builds the same city) ----
  const solids = []; // {x, y, w, h} — buildings, containers, stalls, mosque, lighthouse
  const buildings = []; // {x, y, w, h, color, roof} — drawn by the renderer
  const trees = [];
  const zones = {
    pasar: { x: 950, y: 750, w: 400, h: 300, label: 'Pasar' },
    masjid: { x: 1480, y: 360, w: 360, h: 260, label: 'Masjid' },
    safehouse: { x: 480, y: 1180, w: 320, h: 260, label: 'Rumah Aman' },
    harbour: { x: HARBOR.x, y: HARBOR.y, w: HARBOR.w, h: HARBOR.h, label: 'Pelabuhan' },
    beach: { x: 0, y: BEACH_Y, w: WORLD.width, h: SEA_Y - BEACH_Y, label: 'Pantai' },
    sea: { x: 0, y: SEA_Y, w: WORLD.width, h: WORLD.height - SEA_Y, label: 'Laut' },
  };
  const warungs = [
    { x: 470, y: 350, name: 'Warung Bu Siti' },
    { x: 1440, y: 775, name: 'Warung Kopi Joko' },
    { x: 970, y: 1170, name: 'Warung Nasi Ampera' },
  ];
  const stalls = [];
  for (let i = 0; i < 8; i += 1) {
    stalls.push({ x: 980 + (i % 4) * 95, y: 790 + Math.floor(i / 4) * 110, w: 64, h: 44 });
  }

  // Masjid (big, with dome) and lighthouse are fixed landmarks.
  solids.push({ x: zones.masjid.x, y: zones.masjid.y, w: zones.masjid.w, h: zones.masjid.h });
  solids.push({ x: 2260, y: 960, w: 60, h: 60 }); // lighthouse base
  for (const s of stalls) solids.push({ x: s.x, y: s.y, w: s.w, h: s.h });
  for (const w of warungs) solids.push({ x: w.x - 26, y: w.y - 20, w: 52, h: 40 });
  // Harbour containers.
  const containers = [];
  for (let i = 0; i < 6; i += 1) {
    const c = { x: 2100 + (i % 3) * 110, y: 1000 + Math.floor(i / 3) * 130, w: 90, h: 46 };
    containers.push(c);
    solids.push(c);
  }

  // Buildings fill the grid blocks, skipping roads, the plaza, the mosque, the safehouse
  // and the harbour. Each block gets one or two buildings.
  const blockXs = [[0, 400], [484, 900], [984, 1400], [1484, 1900], [1984, 2400]];
  const blockYs = [[0, 300], [384, 700], [784, 1100], [1184, 1500]];
  const palette = ['#c98f5f', '#b5774d', '#d9a066', '#a9713f', '#c08050'];
  for (const [bx0, bx1] of blockXs) {
    for (const [by0, by1] of blockYs) {
      // Skip the plaza, mosque and safehouse blocks.
      if (bx0 === 984 && by0 === 784) continue;
      if (bx0 === 1484 && by0 === 384) continue;
      if (bx0 === 484 && by0 === 1184) continue;
      if (bx0 === 1984) continue; // harbour side
      if (by1 > BEACH_Y) continue;
      const count = 1 + Math.floor(random() * 2);
      for (let i = 0; i < count; i += 1) {
        const w = 90 + random() * 110;
        const h = 70 + random() * 90;
        const x = bx0 + 20 + random() * Math.max(1, (bx1 - bx0) - w - 40);
        const y = by0 + 20 + random() * Math.max(1, (by1 - by0) - h - 40);
        const b = { x, y, w, h, color: palette[Math.floor(random() * palette.length)] };
        buildings.push(b);
        solids.push({ x, y, w, h });
      }
    }
  }
  // Trees along the beach and the square.
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: 60 + random() * (WORLD.width - 120), y: BEACH_Y + 12 + random() * 60 });
  }
  for (let i = 0; i < 10; i += 1) {
    trees.push({ x: 700 + random() * 500, y: 1300 + random() * 140 });
  }

  // ---- Entities ----
  const playerStart = { x: 700, y: 700 }; // on the main road, beside the yellow angkot
  const player = {
    x: playerStart.x, y: playerStart.y, angle: 0, speed: 0,
    onFoot: true, vehicle: null, health: PLAYER.maxHealth,
    hasGun: false, invuln: 0, punchTimer: 0, shootTimer: 0,
  };
  const vehicles = [];
  const peds = [];
  const police = [];
  const bullets = [];
  const pickups = [];
  const guards = [];
  let vehicleId = 0;

  function addVehicle(type, x, y, angle, npc, parked) {
    const def = VEHICLES[type];
    const v = {
      id: vehicleId++, type, x, y, angle, speed: 0,
      w: def.w, h: def.h, npc: !!npc, parked: !!parked,
      driver: null, hp: 100, stolen: false,
      // traffic routing (npc cars only)
      axis: 'h', line: ROADS_H[0], dir: 1, lane: 0, pos: x,
    };
    vehicles.push(v);
    return v;
  }

  function addPed(x, y) {
    const p = { x, y, angle: random() * TAU, speed: PED.speed, tx: x, ty: y, wait: 0, flee: false };
    peds.push(p);
    return p;
  }

  function randomRoadPoint() {
    if (random() < 0.5) return { x: 100 + random() * (WORLD.width - 200), y: ROADS_H[Math.floor(random() * ROADS_H.length)] };
    return { x: ROADS_V[Math.floor(random() * ROADS_V.length)], y: 100 + random() * (WORLD.height - 300) };
  }

  const state = {
    time: 0, money: MONEY.start, wanted: 0, wantedTimer: 0,
    missionIndex: 0, missionPhase: 'brief', missionStep: 0,
    marker: null, dialogue: null, gameOver: null,
    carsStolen: 0, missionsDone: 0, shotsFired: 0,
    player, vehicles, peds, police, bullets, pickups, guards,
    buildings, trees, zones, warungs, stalls, containers, solids,
    camera: { x: 0, y: 0 },
    target: null, // mission 2 rival
    boss: null,
  };

  function setDialogue(speaker, lines) {
    state.dialogue = { speaker, lines, index: 0 };
  }

  function setMarker(x, y, label) {
    state.marker = { x, y, label };
  }

  function clearMarker() { state.marker = null; }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const type = ['mobil', 'mobil', 'motor', 'angkot'][Math.floor(random() * 4)];
      const p = randomRoadPoint();
      const v = addVehicle(type, p.x, p.y, 0, true, false);
      const horizontal = Math.abs(p.y - ROADS_H[0]) < 200 || random() < 0.5;
      if (horizontal) {
        v.axis = 'h';
        v.line = ROADS_H.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
        v.pos = p.x; v.dir = random() < 0.5 ? 1 : -1; v.lane = (random() < 0.5 ? -1 : 1) * 20;
        v.angle = v.dir === 1 ? 0 : Math.PI;
      } else {
        v.axis = 'v';
        v.line = ROADS_V.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
        v.pos = p.y; v.dir = random() < 0.5 ? 1 : -1; v.lane = (random() < 0.5 ? -1 : 1) * 20;
        v.angle = v.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      v.speed = 90 + random() * 70;
    }
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const p = randomRoadPoint();
      addPed(p.x + (random() - 0.5) * 60, p.y + (random() - 0.5) * 60);
    }
  }

  function spawnParked() {
    // Parked on the roads, so every one of them can be driven away.
    const spots = [
      ['angkot', 760, 720, 0], ['becak', 950, 320, Math.PI / 2], ['motor', 420, 720, 0],
      ['mobil', 1450, 320, 0], ['angkot', 1900, 1140, Math.PI / 2], ['motor', 950, 1520, 0],
      ['mobil', 500, 1520, 0], ['becak', 1950, 320, Math.PI / 2], ['mobil', 1420, 1520, 0],
    ];
    for (const [type, x, y, angle] of spots) {
      const v = addVehicle(type, x, y, angle, false, true);
      v.angle = angle;
    }
  }

  function spawnMoneyPickups() {
    const spots = [[620, 760], [1350, 350], [1850, 760], [450, 1150], [1000, 1450], [2150, 1250]];
    for (const [x, y] of spots) pickups.push({ kind: 'money', x, y, amount: 10000 + Math.floor(random() * 15000) });
  }

  function circleHitsSolid(x, y, r) {
    for (const s of solids) {
      const cx = clamp(x, s.x, s.x + s.w);
      const cy = clamp(y, s.y, s.y + s.h);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    if (y > SEA_Y - 4) return true; // the sea is not walkable
    return false;
  }

  function moveCircle(e, dx, dy, r) {
    const nx = e.x + dx;
    if (!circleHitsSolid(nx, e.y, r)) e.x = nx;
    const ny = e.y + dy;
    if (!circleHitsSolid(e.x, ny, r)) e.y = ny;
    e.x = clamp(e.x, 20, WORLD.width - 20);
    e.y = clamp(e.y, 20, WORLD.height - 20);
  }

  function nearestVehicle(maxDist) {
    let best = null, bestD = maxDist;
    for (const v of vehicles) {
      if (v.npc) continue;
      const d = dist(player.x, player.y, v.x, v.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function nearestWarung(maxDist) {
    let best = null, bestD = maxDist;
    for (const w of warungs) {
      const d = dist(player.x, player.y, w.x, w.y);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }

  function enterVehicle(v) {
    if (!v || v.npc) return false;
    if (v.driver) { v.driver = null; }
    if (v.parked) {
      v.parked = false;
      state.carsStolen += 1;
      addWanted(WANTED.steal);
    }
    player.vehicle = v;
    player.onFoot = false;
    player.x = v.x; player.y = v.y;
    return true;
  }

  function exitVehicle() {
    const v = player.vehicle;
    if (!v) return;
    player.vehicle = null;
    player.onFoot = true;
    player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 34;
    player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 34;
    player.angle = v.angle;
    v.speed = 0;
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, WANTED.max);
    state.wantedTimer = 0;
  }

  function damagePlayer(amount) {
    if (player.invuln > 0) return 0;
    player.health = Math.max(0, player.health - amount);
    player.invuln = PLAYER.invulnerable;
    return amount;
  }

  function spawnPolice() {
    const wantFoot = state.wanted >= 1 ? Math.min(state.wanted, 3) : 0;
    const wantCars = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
    const foot = police.filter((p) => !p.car).length;
    const cars = police.filter((p) => p.car).length;
    for (let i = foot; i < wantFoot; i += 1) {
      const a = random() * TAU;
      police.push({ car: false, x: clamp(player.x + Math.cos(a) * 500, 40, WORLD.width - 40), y: clamp(player.y + Math.sin(a) * 500, 40, WORLD.height - 40), angle: 0, speed: POLICE.footSpeed });
    }
    for (let i = cars; i < wantCars; i += 1) {
      const a = random() * TAU;
      const v = addVehicle('polisi', clamp(player.x + Math.cos(a) * 600, 60, WORLD.width - 60), clamp(player.y + Math.sin(a) * 600, 60, WORLD.height - 60), 0, false, false);
      police.push({ car: true, vehicle: v, x: v.x, y: v.y, angle: 0 });
    }
  }

  function missionBrief() {
    const m = MISSIONS[state.missionIndex];
    setDialogue(m.speaker, m.brief);
    state.missionPhase = 'brief';
    return EVENT_BRIEF;
  }

  function beginMission() {
    const i = state.missionIndex;
    state.missionPhase = 'active';
    state.missionStep = 0;
    if (i === 0) {
      const angkot = vehicles.find((v) => v.type === 'angkot' && v.parked);
      setMarker(angkot ? angkot.x : 760, angkot ? angkot.y : 500, 'Naik angkot kuning');
    } else if (i === 1) {
      const t = addVehicle('motor', player.x + 250, player.y - 60, Math.PI / 2, false, false);
      t.driver = { name: 'Joko' };
      state.target = t;
      setMarker(t.x, t.y, 'Kejar Joko!');
    } else if (i === 2) {
      addWanted(3);
      spawnPolice();
      setMarker(zones.safehouse.x + zones.safehouse.w / 2, zones.safehouse.y + zones.safehouse.h / 2, 'Rumah aman');
    } else if (i === 3) {
      pickups.push({ kind: 'pistol', x: 2080, y: 1250, amount: 0 });
      pickups.push({ kind: 'health', x: 2080, y: 1330, amount: 0 });
      // Guards stand on the harbour's open southern apron, clear of the containers.
      const spots = [[2150, 1300], [2250, 1400], [2150, 1480]];
      for (const [x, y] of spots) guards.push({ x, y, hp: 60, speed: 150, damage: 8, isBoss: false, angle: 0, hitTimer: 0 });
      const boss = { x: 2280, y: 1350, hp: 140, speed: 120, damage: 14, isBoss: true, angle: 0, hitTimer: 0 };
      guards.push(boss);
      state.boss = boss;
      setMarker(2080, 1250, 'Ambil pistol dulu!');
    }
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    const reward = [MONEY.mission1, MONEY.mission2, MONEY.mission3, MONEY.mission4][state.missionIndex];
    state.money += reward;
    state.missionsDone += 1;
    state.missionPhase = 'done';
    clearMarker();
    setDialogue(m.speaker, [...m.done, `Upah masuk: Rp ${reward.toLocaleString('id-ID')}.`]);
    return EVENT_MISSION;
  }

  function advanceMission() {
    state.missionIndex += 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.gameOver = 'complete';
      return EVENT_OVER;
    }
    return missionBrief();
  }

  function closeDialogue() {
    state.dialogue = null;
    if (state.missionPhase === 'brief') beginMission();
    else if (state.missionPhase === 'done') return advanceMission();
    return 0;
  }

  function reset() {
    vehicles.length = 0; peds.length = 0; police.length = 0;
    bullets.length = 0; pickups.length = 0; guards.length = 0;
    vehicleId = 0;
    player.x = playerStart.x; player.y = playerStart.y; player.angle = 0;
    player.speed = 0; player.onFoot = true; player.vehicle = null;
    player.health = PLAYER.maxHealth; player.hasGun = false;
    player.invuln = 0; player.punchTimer = 0; player.shootTimer = 0;
    state.time = 0; state.money = MONEY.start; state.wanted = 0; state.wantedTimer = 0;
    state.missionIndex = 0; state.missionPhase = 'brief'; state.missionStep = 0;
    state.marker = null; state.dialogue = null; state.gameOver = null;
    state.carsStolen = 0; state.missionsDone = 0; state.shotsFired = 0;
    state.target = null; state.boss = null;
    state.camera.x = 0; state.camera.y = 0;
    spawnTraffic(10);
    spawnPeds(14);
    spawnParked();
    spawnMoneyPickups();
    missionBrief();
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money, missionIndex: state.missionIndex,
        health: player.health, hasGun: player.hasGun, x: player.x, y: player.y,
      }));
      return true;
    } catch { return false; }
  }

  function hasSave() {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      reset();
      state.money = s.money ?? MONEY.start;
      state.missionIndex = Math.min(s.missionIndex ?? 0, MISSIONS.length - 1);
      player.health = s.health ?? PLAYER.maxHealth;
      player.hasGun = !!s.hasGun;
      player.x = clamp(s.x ?? playerStart.x, 40, WORLD.width - 40);
      player.y = clamp(s.y ?? playerStart.y, 40, WORLD.height - 40);
      missionBrief();
      return true;
    } catch { return false; }
  }

  // ---- Per-step updates ----
  function stepPlayer(dt, input) {
    if (player.invuln > 0) player.invuln -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.shootTimer > 0) player.shootTimer -= dt;

    if (!player.onFoot && player.vehicle) {
      const v = player.vehicle;
      const def = VEHICLES[v.type];
      const throttle = input.throttle || 0; // W = 1 maju, S = -1 mundur
      const steer = input.steer || 0; // D = 1 kanan, A = -1 kiri
      v.speed += throttle * def.accel * dt;
      v.speed *= Math.max(0, 1 - 1.4 * dt);
      if (v.speed > def.maxSpeed) v.speed = def.maxSpeed;
      if (v.speed < -def.reverse) v.speed = -def.reverse;
      if (Math.abs(v.speed) > 5) v.angle += steer * def.turn * dt * (v.speed >= 0 ? 1 : -1) * clamp(Math.abs(v.speed) / 120, 0.3, 1);
      const nx = v.x + Math.cos(v.angle) * v.speed * dt;
      const ny = v.y + Math.sin(v.angle) * v.speed * dt;
      const r = Math.max(v.w, v.h) / 2 * 0.82;
      if (!circleHitsSolid(nx, v.y, r)) v.x = nx;
      else v.speed *= 0.4;
      if (!circleHitsSolid(v.x, ny, r)) v.y = ny;
      else v.speed *= 0.4;
      v.x = clamp(v.x, 30, WORLD.width - 30);
      v.y = clamp(v.y, 30, WORLD.height - 30);
      player.x = v.x; player.y = v.y; player.angle = v.angle;
      return;
    }

    // On foot: 8-way movement.
    const len = Math.hypot(input.mx, input.my) || 1;
    const sp = PLAYER.walkSpeed;
    const dx = (input.mx / len) * sp * dt * (input.mx || input.my ? 1 : 0);
    const dy = (input.my / len) * sp * dt * (input.mx || input.my ? 1 : 0);
    if (dx || dy) player.angle = Math.atan2(dy, dx);
    moveCircle(player, dx, dy, PLAYER.radius);
  }

  function stepTraffic(dt) {
    for (const v of vehicles) {
      if (!v.npc) continue;
      const def = VEHICLES[v.type];
      const speed = 90 + (def.maxSpeed - 90) * 0.3;
      v.pos += v.dir * speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const cross = v.axis === 'h' ? ROADS_V : ROADS_H;
      for (const line of cross) {
        if (Math.abs(v.pos - line) < speed * dt * 1.2 && random() < 0.22) {
          const oldAxis = v.axis;
          v.axis = oldAxis === 'h' ? 'v' : 'h';
          v.line = line;
          v.pos = oldAxis === 'h' ? v.y : v.x;
          v.dir = random() < 0.5 ? 1 : -1;
          v.lane = (random() < 0.5 ? -1 : 1) * 20;
          break;
        }
      }
      if (v.axis === 'h') {
        v.x = v.pos; v.y = v.line + v.lane;
        v.angle = v.dir === 1 ? 0 : Math.PI;
        if (v.pos < 30 || v.pos > WORLD.width - 30) { v.pos = v.dir === 1 ? 40 : WORLD.width - 40; }
      } else {
        v.x = v.line + v.lane; v.y = v.pos;
        v.angle = v.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        if (v.pos < 30 || v.pos > WORLD.height - 60) { v.pos = v.dir === 1 ? 40 : WORLD.height - 70; }
      }
    }
  }

  function stepPeds(dt) {
    for (const p of peds) {
      const dp = dist(p.x, p.y, player.x, player.y);
      const scared = state.wanted > 0 || player.punchTimer > 0.2;
      if (scared && dp < 160) {
        p.flee = true;
        const a = angleTo(player.x, player.y, p.x, p.y);
        moveCircle(p, Math.cos(a) * PED.fleeSpeed * dt, Math.sin(a) * PED.fleeSpeed * dt, PED.radius);
        p.angle = a;
      } else {
        p.flee = false;
        if (p.wait > 0) { p.wait -= dt; continue; }
        const d = dist(p.x, p.y, p.tx, p.ty);
        if (d < 12) {
          const t = randomRoadPoint();
          p.tx = t.x; p.ty = t.y;
          p.wait = random() * 2;
        } else {
          const a = angleTo(p.x, p.y, p.tx, p.ty);
          p.angle = a;
          moveCircle(p, Math.cos(a) * p.speed * dt, Math.sin(a) * p.speed * dt, PED.radius);
        }
      }
    }
  }

  function stepPolice(dt) {
    spawnPolice();
    for (let i = police.length - 1; i >= 0; i -= 1) {
      const c = police[i];
      if (state.wanted === 0) { // heat is gone: the police leave
        if (c.car && c.vehicle) { const vi = vehicles.indexOf(c.vehicle); if (vi >= 0) vehicles.splice(vi, 1); }
        police.splice(i, 1);
        continue;
      }
      if (c.car && c.vehicle) {
        const v = c.vehicle;
        const def = VEHICLES.polisi;
        const want = angleTo(v.x, v.y, player.x, player.y);
        const turn = clamp(angDiff(v.angle, want), -1, 1);
        v.angle += turn * def.turn * dt;
        v.speed = def.maxSpeed * 0.92;
        const nx = v.x + Math.cos(v.angle) * v.speed * dt;
        const ny = v.y + Math.sin(v.angle) * v.speed * dt;
        const r = Math.max(v.w, v.h) / 2 * 0.82;
        if (!circleHitsSolid(nx, v.y, r)) v.x = nx;
        if (!circleHitsSolid(v.x, ny, r)) v.y = ny;
        c.x = v.x; c.y = v.y; c.angle = v.angle;
        // Ram the player's car, or the player on foot.
        if (dist(v.x, v.y, player.x, player.y) < 44) {
          if (player.onFoot) {
            if (state.wanted >= 3) { state.gameOver = 'busted'; }
            else damagePlayer(POLICE.carRam);
          } else {
            damagePlayer(POLICE.carRam);
            addWanted(0);
            v.speed *= -0.3;
          }
        }
      } else {
        const a = angleTo(c.x, c.y, player.x, player.y);
        c.angle = a;
        const d = dist(c.x, c.y, player.x, player.y);
        if (d > 10) moveCircle(c, Math.cos(a) * POLICE.footSpeed * dt, Math.sin(a) * POLICE.footSpeed * dt, POLICE.radius);
        if (d < POLICE.arrestRange && player.onFoot) {
          if (state.wanted >= 3) state.gameOver = 'busted';
          else damagePlayer(10);
        }
      }
    }
  }

  function stepBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height || circleHitsSolid(b.x, b.y, 2);
      if (!dead) {
        for (const g of guards) {
          if (g.hp > 0 && dist(b.x, b.y, g.x, g.y) < 20) { g.hp -= 34; g.hitTimer = 0.2; dead = true; break; }
        }
      }
      if (!dead) {
        for (const c of police) {
          if (!c.car && dist(b.x, b.y, c.x, c.y) < 18) {
            const idx = police.indexOf(c); police.splice(idx, 1);
            addWanted(WANTED.shoot);
            dead = true; break;
          }
        }
      }
      if (!dead) {
        for (const p of peds) {
          if (dist(b.x, b.y, p.x, p.y) < 16) {
            const idx = peds.indexOf(p); peds.splice(idx, 1);
            addWanted(WANTED.shoot);
            dead = true; break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
  }

  function stepGuards(dt) {
    for (const g of guards) {
      if (g.hp <= 0) continue;
      if (g.hitTimer > 0) g.hitTimer -= dt;
      const d = dist(g.x, g.y, player.x, player.y);
      const a = angleTo(g.x, g.y, player.x, player.y);
      g.angle = a;
      if (d > 26) moveCircle(g, Math.cos(a) * g.speed * dt, Math.sin(a) * g.speed * dt, 14);
      else if (player.invuln <= 0) damagePlayer(g.damage);
    }
    const alive = guards.filter((g) => g.hp > 0).length;
    if (state.missionIndex === 3 && state.missionPhase === 'active' && guards.length > 0 && alive === 0) {
      return completeMission();
    }
    return 0;
  }

  function stepTarget(dt) {
    const t = state.target;
    if (!t || state.missionIndex !== 1 || state.missionPhase !== 'active') return 0;
    // Joko rides toward the harbour along the roads.
    const goal = { x: 2150, y: 1250 };
    const a = angleTo(t.x, t.y, goal.x, goal.y);
    t.angle += clamp(angDiff(t.angle, a), -2.4 * dt, 2.4 * dt);
    const sp = 300;
    t.x += Math.cos(t.angle) * sp * dt;
    t.y += Math.sin(t.angle) * sp * dt;
    t.x = clamp(t.x, 30, WORLD.width - 30);
    t.y = clamp(t.y, 30, WORLD.height - 60);
    setMarker(t.x, t.y, 'Kejar Joko!');
    if (dist(t.x, t.y, player.x, player.y) < 56) return completeMission();
    return 0;
  }

  function stepPickups() {
    let events = 0;
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const p = pickups[i];
      if (dist(p.x, p.y, player.x, player.y) < 34) {
        if (p.kind === 'money') { state.money += p.amount; events |= EVENT_MONEY; }
        else if (p.kind === 'health') { player.health = Math.min(PLAYER.maxHealth, player.health + 40); events |= EVENT_MONEY; }
        else if (p.kind === 'pistol') { player.hasGun = true; events |= EVENT_MONEY; }
        pickups.splice(i, 1);
      }
    }
    return events;
  }

  function punch() {
    if (player.punchTimer > 0 || !player.onFoot) return 0;
    player.punchTimer = PLAYER.punchCooldown;
    let hit = false;
    const reach = PLAYER.punchRange;
    const px = player.x + Math.cos(player.angle) * reach * 0.6;
    const py = player.y + Math.sin(player.angle) * reach * 0.6;
    for (const g of guards) {
      if (g.hp > 0 && dist(px, py, g.x, g.y) < reach) {
        g.hp -= PLAYER.punchDamage; g.hitTimer = 0.25; hit = true;
      }
    }
    if (!hit) {
      for (const c of [...police]) {
        if (!c.car && dist(px, py, c.x, c.y) < reach) {
          police.splice(police.indexOf(c), 1);
          addWanted(WANTED.punchPed);
          hit = true;
        }
      }
    }
    if (!hit) {
      for (const p of [...peds]) {
        if (dist(px, py, p.x, p.y) < reach) {
          peds.splice(peds.indexOf(p), 1);
          addWanted(WANTED.punchPed);
          hit = true;
        }
      }
    }
    return 0;
  }

  function shoot() {
    if (player.shootTimer > 0 || !player.hasGun) return 0;
    player.shootTimer = PLAYER.shootCooldown;
    state.shotsFired += 1;
    // Soft auto-aim: the bullet goes to the nearest hostile in range, else straight
    // ahead. The player still has to be near the fight; it only forgives the aim.
    let angle = player.angle;
    let bestD = 450, best = null;
    for (const g of guards) {
      if (g.hp <= 0) continue;
      const d = dist(player.x, player.y, g.x, g.y);
      if (d < bestD) { bestD = d; best = g; }
    }
    if (!best) {
      for (const c of police) {
        if (c.car) continue;
        const d = dist(player.x, player.y, c.x, c.y);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    if (best) angle = angleTo(player.x, player.y, best.x, best.y);
    bullets.push({
      x: player.x + Math.cos(angle) * 22,
      y: player.y + Math.sin(angle) * 22,
      angle, speed: PLAYER.bulletSpeed, life: 1.1,
    });
    // No wanted for firing: the heat comes only from what a bullet actually hits
    // (a pedestrian or a police officer), so the harbour boss fight stays clean.
    return 0;
  }

  function interact() {
    if (!player.onFoot) return 0;
    const w = nearestWarung(78);
    if (w) {
      if (player.health >= PLAYER.maxHealth) return 0;
      if (state.money < MONEY.warungHeal) return 0;
      state.money -= MONEY.warungHeal;
      player.health = Math.min(PLAYER.maxHealth, player.health + MONEY.healAmount);
      return EVENT_MONEY;
    }
    const v = nearestVehicle(72);
    if (v) { enterVehicle(v); return 0; }
    return 0;
  }

  function checkMissionProgress() {
    if (state.missionPhase !== 'active') return 0;
    if (state.missionIndex === 0) {
      if (state.missionStep === 0) {
        if (player.vehicle && player.vehicle.type === 'angkot') {
          state.missionStep = 1;
          setMarker(zones.pasar.x + zones.pasar.w / 2, zones.pasar.y + zones.pasar.h / 2, 'Antar ke Pasar');
        } else {
          const a = vehicles.find((v) => v.type === 'angkot' && v.parked);
          if (a) setMarker(a.x, a.y, 'Naik angkot kuning');
        }
      }
      if (state.missionStep === 1) {
        const pz = zones.pasar;
        const inPlaza = player.x > pz.x - 30 && player.x < pz.x + pz.w + 30
          && player.y > pz.y - 30 && player.y < pz.y + pz.h + 30;
        if (inPlaza) return completeMission();
      }
    } else if (state.missionIndex === 2) {
      const cx = zones.safehouse.x + zones.safehouse.w / 2, cy = zones.safehouse.y + zones.safehouse.h / 2;
      if (dist(player.x, player.y, cx, cy) < 120) {
        state.wanted = 0;
        return completeMission();
      }
    }
    return 0;
  }

  // harmless skips the player, police and missions: the title screen runs the
  // city (traffic, pedestrians) as a living backdrop and nothing else.
  function step(dt, input, harmless) {
    let events = 0;
    state.time += dt;

    if (!harmless) {
      // One-shot actions.
      if (input.actions) {
        if (input.actions & 4) { // ENTER (E)
          if (player.onFoot) events |= interact();
          else exitVehicle();
        }
        if (input.actions & 8) { // ATTACK (Space)
          if (player.onFoot) {
            if (player.hasGun) shoot();
            else punch();
          } else if (player.hasGun) shoot();
        }
      }
      stepPlayer(dt, input);
      events |= stepPickups();
      events |= stepTarget(dt);
      events |= stepGuards(dt);
      events |= checkMissionProgress();
      stepBullets(dt);
      stepPolice(dt);
      // Wanted decays when the player keeps clean.
      if (state.wanted > 0) {
        state.wantedTimer += dt;
        if (state.wantedTimer >= WANTED.decaySeconds) {
          state.wanted -= 1;
          state.wantedTimer = 0;
        }
      }
      // Mission 4 marker: once the pistol is taken, point at the boss.
      if (state.missionIndex === 3 && state.missionPhase === 'active' && player.hasGun && state.marker && state.marker.label === 'Ambil pistol dulu!') {
        setMarker(2280, 1350, 'Kalahkan Bos Pelabuhan!');
      }
      if (player.health <= 0) state.gameOver = 'ko';
      if (state.gameOver) events |= EVENT_OVER;
    }

    stepTraffic(dt);
    stepPeds(dt);

    // Camera follows the player.
    state.camera.x = clamp(player.x - 1280 / 2, 0, WORLD.width - 1280);
    state.camera.y = clamp(player.y - 720 / 2, 0, WORLD.height - 720);
    return events;
  }

  reset();
  return {
    state, reset, step, closeDialogue, save, load, hasSave,
    enterVehicle, exitVehicle, interact, beginMission, missionBrief,
  };
}
