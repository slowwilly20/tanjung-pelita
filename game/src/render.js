// Tanjung Pelita — the renderer: draws the tropical port city top-down, the player,
// traffic, police and missions, then the HUD (health, money, wanted stars, minimap),
// and the title / pause / dialogue / game-over screens. Canvas only; no game logic.
import {
  BEACH_Y, FONT, MISSIONS, PALETTE, ROADS_H, ROADS_V, ROAD_W, SEA_Y,
  VEHICLES, VIEW, WORLD, formatRp,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_DIALOGUE = 4;
export const SCREEN_COMPLETE = 5;

const PED_COLORS = ['#e8b4b8', '#f2d16b', '#7fb3d5', '#c39bd3', '#f0a35e', '#8fbc8f', '#e5989b'];
const MINIMAP = { w: 190, h: 142, pad: 12 };

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cw = 0, ch = 0, scale = 1, ox = 0, oy = 0;

  function resize() {
    // Device pixels are capped at 2: beyond that the canvas only costs memory.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(cw / VIEW.width, ch / VIEW.height);
    ox = (cw - VIEW.width * scale) / 2;
    oy = (ch - VIEW.height * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawGround(s) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassAlt;
    for (let y = 0; y < WORLD.height; y += 160) ctx.fillRect(0, y, WORLD.width, 80);
    // Sea and beach along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH_Y, WORLD.width, SEA_Y - BEACH_Y);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, SEA_Y, WORLD.width, WORLD.height - SEA_Y);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 40; x < WORLD.width; x += 180) {
      ctx.fillRect(x, SEA_Y + 30 + ((x / 180) % 3) * 22, 90, 5);
    }
    // Harbour apron.
    ctx.fillStyle = PALETTE.harbour;
    ctx.fillRect(s.zones.harbour.x, s.zones.harbour.y, s.zones.harbour.w, s.zones.harbour.h);
    // Market plaza.
    ctx.fillStyle = '#b9a06a';
    ctx.fillRect(s.zones.pasar.x, s.zones.pasar.y, s.zones.pasar.w, s.zones.pasar.h);
    ctx.strokeStyle = '#8a744a';
    ctx.lineWidth = 3;
    for (let x = s.zones.pasar.x + 50; x < s.zones.pasar.x + s.zones.pasar.w; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, s.zones.pasar.y); ctx.lineTo(x, s.zones.pasar.y + s.zones.pasar.h); ctx.stroke();
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const y of ROADS_H) ctx.fillRect(0, y - ROAD_W / 2, WORLD.width, ROAD_W);
    for (const x of ROADS_V) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const y of ROADS_H) {
      ctx.fillRect(0, y - ROAD_W / 2 - 10, WORLD.width, 10);
      ctx.fillRect(0, y + ROAD_W / 2, WORLD.width, 10);
    }
    for (const x of ROADS_V) {
      ctx.fillRect(x - ROAD_W / 2 - 10, 0, 10, WORLD.height);
      ctx.fillRect(x + ROAD_W / 2, 0, 10, WORLD.height);
    }
    // Dashed centre lines.
    ctx.fillStyle = PALETTE.roadLine;
    for (const y of ROADS_H) {
      for (let x = 20; x < WORLD.width; x += 70) ctx.fillRect(x, y - 3, 38, 6);
    }
    for (const x of ROADS_V) {
      for (let y = 20; y < WORLD.height; y += 70) ctx.fillRect(x - 3, y, 6, 38);
    }
    // Safehouse marker ground.
    ctx.fillStyle = 'rgba(242, 194, 48, 0.25)';
    ctx.beginPath();
    ctx.arc(s.zones.safehouse.x + s.zones.safehouse.w / 2, s.zones.safehouse.y + s.zones.safehouse.h / 2, 90, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBuildings(s) {
    for (const b of s.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.fillRect(b.x, b.y, 10, b.h);
      ctx.fillStyle = '#3a2c1e';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h - 18, 24, 18);
    }
    // Masjid: white walls, green dome and a minaret.
    const m = s.zones.masjid;
    ctx.fillStyle = PALETTE.mosque;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = PALETTE.mosqueDome;
    ctx.beginPath();
    ctx.arc(m.x + m.w / 2, m.y + m.h / 2, 62, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(m.x + m.w / 2 - 4, m.y + m.h / 2 - 96, 8, 40);
    ctx.fillStyle = '#d9c25a';
    ctx.beginPath();
    ctx.arc(m.x + m.w / 2, m.y + m.h / 2 - 100, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.mosque;
    ctx.fillRect(m.x + m.w - 22, m.y - 70, 20, 70 + m.h);
    ctx.fillStyle = PALETTE.mosqueDome;
    ctx.beginPath();
    ctx.arc(m.x + m.w - 12, m.y - 70, 12, Math.PI, 0);
    ctx.fill();
    // Lighthouse at the harbour.
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath(); ctx.arc(2290, 990, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c2543a';
    ctx.fillRect(2278, 968, 24, 14);
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.arc(2290, 990, 10, 0, Math.PI * 2); ctx.fill();
    // Containers.
    for (const c of s.containers) {
      ctx.fillStyle = PALETTE.container;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      for (let x = c.x + 12; x < c.x + c.w; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, c.y); ctx.lineTo(x, c.y + c.h); ctx.stroke();
      }
    }
    // Market stalls with striped awnings.
    for (const st of s.stalls) {
      ctx.fillStyle = '#7a4a2b';
      ctx.fillRect(st.x, st.y, st.w, st.h);
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = i % 2 ? '#f2f4f6' : '#e2583e';
        ctx.fillRect(st.x + i * (st.w / 4), st.y - 8, st.w / 4, 12);
      }
    }
    // Warungs (food stalls).
    for (const w of s.warungs) {
      ctx.fillStyle = PALETTE.warung;
      rr(ctx, w.x - 26, w.y - 20, 52, 40, 6); ctx.fill();
      ctx.fillStyle = '#f6e05e';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('WARUNG', w.x, w.y + 1);
    }
    // Trees.
    for (const t of s.trees) {
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(t.x, t.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath(); ctx.arc(t.x - 4, t.y - 4, 8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawVehicle(v, time) {
    const def = VEHICLES[v.type];
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    const w = def.w, h = def.h;
    // Wheels.
    ctx.fillStyle = '#14161c';
    const wy = w / 2 - 2, wx = h / 2 - 8;
    ctx.fillRect(-wx - 6, -wy - 3, 12, 6);
    ctx.fillRect(-wx - 6, wy - 3, 12, 6);
    ctx.fillRect(wx - 6, -wy - 3, 12, 6);
    ctx.fillRect(wx - 6, wy - 3, 12, 6);
    // Body.
    ctx.fillStyle = def.color;
    rr(ctx, -h / 2, -w / 2, h, w, 8); ctx.fill();
    // Roof.
    ctx.fillStyle = def.roof;
    rr(ctx, -h / 2 + 12, -w / 2 + 5, h - 24, w - 10, 6); ctx.fill();
    // Windshield.
    ctx.fillStyle = 'rgba(180,220,240,0.85)';
    ctx.fillRect(h / 2 - 14, -w / 2 + 6, 8, w - 12);
    if (v.type === 'angkot') {
      ctx.fillStyle = '#f2f4f6';
      ctx.fillRect(-6, -w / 2 + 2, 20, 7);
      ctx.fillStyle = '#2e9e4f';
      ctx.font = 'bold 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('ANGKOT', 4, -w / 2 + 8);
    } else if (v.type === 'becak') {
      ctx.fillStyle = '#f6e05e';
      ctx.fillRect(h / 2 - 4, -w / 2 - 8, 10, 8);
    } else if (v.type === 'polisi') {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-h / 2 + 6, -w / 2 + 3, h - 12, 6);
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-4, -w / 2 - 2, 8, 5);
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-4, w / 2 - 3, 8, 5);
    } else if (v.type === 'motor') {
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, opts) {
    opts = opts || {};
    const r = opts.radius || 13;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing nose.
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * (r + 7), Math.sin(angle) * (r + 7)); ctx.stroke();
    // Cap.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.62, Math.PI, 0); ctx.fill();
    if (opts.flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(s, time) {
    const m = s.marker;
    if (!m) return;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    const r = 16 * pulse;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = 'rgba(242, 194, 48, 0.18)';
    ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(0, -r - 8); ctx.lineTo(r, 0); ctx.lineTo(0, r + 8); ctx.lineTo(-r, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // Edge arrow when the marker is off-screen.
    const cam = s.camera;
    const sx = (m.x - cam.x) * scale + ox;
    const sy = (m.y - cam.y) * scale + oy;
    const margin = 46;
    if (sx < margin || sx > cw - margin || sy < margin || sy > ch - margin) {
      const cx = cw / 2, cy = ch / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(cx + Math.cos(a) * (Math.min(cw, ch) / 2 - 60), margin, cw - margin);
      const ey = clamp(cy + Math.sin(a) * (Math.min(cw, ch) / 2 - 60), margin, ch - margin);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, ex, ey + 28);
    }
  }

  function drawWorld(s, time) {
    const cam = s.camera;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);
    drawGround(s);
    drawBuildings(s);
    // Pickups.
    for (const p of s.pickups) {
      if (p.kind === 'money') {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a5b00';
        ctx.font = 'bold 11px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Rp', p.x, p.y + 1);
      } else if (p.kind === 'health') {
        ctx.fillStyle = '#f2f4f6';
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(p.x - 7, p.y - 2.5, 14, 5);
        ctx.fillRect(p.x - 2.5, p.y - 7, 5, 14);
      } else if (p.kind === 'pistol') {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(p.x - 12, p.y - 4, 24, 8);
        ctx.fillRect(p.x + 8, p.y - 4, 8, 14);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath(); ctx.arc(p.x, p.y - 12, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Vehicles (parked and traffic), then the player's vehicle on top.
    for (const v of s.vehicles) {
      if (s.player.vehicle === v) continue;
      drawVehicle(v, time);
    }
    // Pedestrians.
    s.peds.forEach((p, i) => drawPerson(p.x, p.y, p.angle, PED_COLORS[i % PED_COLORS.length], { radius: 11 }));
    // Guards and the boss.
    for (const g of s.guards) {
      if (g.hp <= 0) continue;
      drawPerson(g.x, g.y, g.angle, g.isBoss ? '#7f1d1d' : '#b91c1c', { radius: g.isBoss ? 18 : 14, flash: g.hitTimer > 0 });
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(g.x - 16, g.y - (g.isBoss ? 30 : 26), 32, 5);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(g.x - 16, g.y - (g.isBoss ? 30 : 26), 32 * Math.max(0, g.hp / (g.isBoss ? 140 : 60)), 5);
      if (g.isBoss) {
        ctx.fillStyle = '#f4f1e6';
        ctx.font = 'bold 12px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText('BOS PELABUHAN', g.x, g.y - 38);
      }
    }
    // Police on foot.
    for (const c of s.police) {
      if (c.car) continue;
      drawPerson(c.x, c.y, c.angle, '#1e3a8a', { radius: 13 });
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 9px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('POLISI', c.x, c.y - 18);
    }
    // Bullets.
    ctx.fillStyle = '#fde047';
    for (const b of s.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // The player.
    const pl = s.player;
    if (pl.vehicle) drawVehicle(pl.vehicle, time);
    else {
      drawPerson(pl.x, pl.y, pl.angle, PALETTE.player, { radius: 14, flash: pl.invuln > 0.6 });
      if (pl.hasGun) {
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pl.x, pl.y);
        ctx.lineTo(pl.x + Math.cos(pl.angle) * 24, pl.y + Math.sin(pl.angle) * 24);
        ctx.stroke();
      }
      if (pl.punchTimer > 0.25) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, 34, pl.angle - 0.7, pl.angle + 0.7);
        ctx.stroke();
      }
    }
    drawMarker(s, time);
    ctx.restore();
  }

  function drawMinimap(s) {
    const mw = MINIMAP.w, mh = MINIMAP.h;
    const x0 = cw - mw - MINIMAP.pad, y0 = MINIMAP.pad;
    const kx = mw / WORLD.width, ky = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,22,0.82)';
    rr(ctx, x0 - 6, y0 - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2;
    rr(ctx, x0 - 6, y0 - 6, mw + 12, mh + 12, 10); ctx.stroke();
    ctx.beginPath(); ctx.rect(x0, y0, mw, mh); ctx.clip();
    ctx.fillStyle = '#4a7a3d';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, y0 + SEA_Y * ky, mw, mh - SEA_Y * ky);
    ctx.strokeStyle = '#d7dbe2';
    ctx.lineWidth = 2;
    for (const y of ROADS_H) {
      ctx.beginPath(); ctx.moveTo(x0, y0 + y * ky); ctx.lineTo(x0 + mw, y0 + y * ky); ctx.stroke();
    }
    for (const x of ROADS_V) {
      ctx.beginPath(); ctx.moveTo(x0 + x * kx, y0); ctx.lineTo(x0 + x * kx, y0 + mh); ctx.stroke();
    }
    ctx.fillStyle = '#8a5a34';
    for (const b of s.buildings) ctx.fillRect(x0 + b.x * kx, y0 + b.y * ky, Math.max(2, b.w * kx), Math.max(2, b.h * ky));
    // Mission marker.
    if (s.marker) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x0 + s.marker.x * kx, y0 + s.marker.y * ky, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Target (Joko).
    if (s.target) {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(x0 + s.target.x * kx, y0 + s.target.y * ky, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#ef4444';
    for (const c of s.police) {
      ctx.beginPath(); ctx.arc(x0 + c.x * kx, y0 + c.y * ky, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x0 + s.player.x * kx, y0 + s.player.y * ky, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(x0 + s.player.x * kx, y0 + s.player.y * ky, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('TANJUNG PELITA', x0, y0 + mh + 20);
  }

  function drawHUD(s, time) {
    // Top-left panel: health, money, wanted.
    const px = 16, py = 14, pw = 250;
    ctx.fillStyle = 'rgba(10,14,22,0.78)';
    rr(ctx, px - 8, py - 8, pw + 16, 108, 12); ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2;
    rr(ctx, px - 8, py - 8, pw + 16, 108, 12); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Health bar.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText('DARAH', px, py + 12);
    ctx.fillStyle = '#20242e';
    rr(ctx, px + 62, py, 180, 16, 8); ctx.fill();
    const hpFrac = Math.max(0, s.player.health / 100);
    ctx.fillStyle = hpFrac > 0.5 ? '#22c55e' : hpFrac > 0.25 ? '#f59e0b' : '#ef4444';
    if (hpFrac > 0) { rr(ctx, px + 62, py, 180 * hpFrac, 16, 8); ctx.fill(); }
    // Money.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(formatRp(s.money), px, py + 44);
    // Wanted stars.
    ctx.font = '22px ' + FONT;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < s.wanted ? '★' : '☆';
    ctx.fillStyle = s.wanted > 0 ? '#fbbf24' : 'rgba(244,241,230,0.35)';
    ctx.fillText(stars, px, py + 74);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    const veh = s.player.vehicle ? ` — ${VEHICLES[s.player.vehicle.type].name}` : ' — jalan kaki';
    ctx.fillText(`Bimo${veh}${s.player.hasGun ? ' — pistol' : ''}`, px, py + 94);
    // Objective line under the minimap.
    const m = MISSIONS[Math.min(s.missionIndex, MISSIONS.length - 1)];
    const label = s.marker ? s.marker.label : (s.missionPhase === 'done' ? 'Misi selesai!' : 'Bebas berkeliaran');
    ctx.fillStyle = 'rgba(10,14,22,0.78)';
    const objText = `${m.title} — ${label}`;
    ctx.font = 'bold 15px ' + FONT;
    const tw = ctx.measureText(objText).width;
    const bx = (cw - tw) / 2 - 14;
    rr(ctx, bx, 14, tw + 28, 34, 10); ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    ctx.fillText(objText, cw / 2, 37);
    ctx.textAlign = 'left';
    // Controls hint.
    ctx.fillStyle = 'rgba(244,241,230,0.6)';
    ctx.font = '12px ' + FONT;
    ctx.fillText('WASD jalan / nyetir   •   E masuk-keluar kendaraan / warung   •   Spasi pukul / tembak   •   P jeda   •   M suara', 16, ch - 14);
    drawMinimap(s);
  }

  function drawDialogue(s) {
    const d = s.dialogue;
    if (!d) return;
    const bw = Math.min(760, cw - 80);
    const bx = (cw - bw) / 2;
    const by = ch - 168;
    ctx.fillStyle = 'rgba(10,14,22,0.92)';
    rr(ctx, bx, by, bw, 132, 14); ctx.fill();
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2;
    rr(ctx, bx, by, bw, 132, 14); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 16px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(d.speaker, bx + 22, by + 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    const line = d.lines[d.index] || '';
    // Simple word wrap.
    const words = line.split(' ');
    let row = '', ry = by + 60;
    for (const word of words) {
      if (ctx.measureText(row + word).width > bw - 44 && row) {
        ctx.fillText(row, bx + 22, ry);
        row = ''; ry += 24;
      }
      row += word + ' ';
    }
    ctx.fillText(row, bx + 22, ry);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(`Enter ▸  (${d.index + 1}/${d.lines.length})`, bx + bw - 18, by + 112);
    ctx.textAlign = 'left';
  }

  function drawTitle(s, info) {
    // A living city behind the title, dimmed.
    drawWorld(s, s.time);
    ctx.fillStyle = 'rgba(8, 12, 20, 0.62)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('TANJUNG PELITA', cw / 2, ch * 0.3);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    ctx.fillText('Kota pelabuhan tropis. Satu sopir angkot. Satu utang besar.', cw / 2, ch * 0.3 + 44);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('Open world 2D — jalan kaki, curi angkot, kabur dari polisi, hadapi Bos Pelabuhan.', cw / 2, ch * 0.3 + 76);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    const lines = [
      'WASD / panah — jalan & nyetir      E — masuk kendaraan / makan di warung',
      'Spasi — pukul / tembak      P — jeda      M — suara',
    ];
    lines.forEach((line, i) => ctx.fillText(line, cw / 2, ch * 0.52 + i * 28));
    if (info.best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 17px ' + FONT;
      ctx.fillText(`Uang terbanyak: ${formatRp(info.best)}`, cw / 2, ch * 0.52 + 72);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px ' + FONT;
    const blink = Math.floor(s.time * 1.6) % 2 === 0;
    if (blink) ctx.fillText(info.hasSave ? 'Tekan Enter — Mulai / Lanjutkan simpanan' : 'Tekan Enter / Klik — Mulai', cw / 2, ch * 0.72);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText('Game orisinal — bukan GTA, bukan Rockstar. Dibuat untuk bounty make.fun gta6-01.', cw / 2, ch - 24);
    ctx.textAlign = 'left';
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || PALETTE.text;
    ctx.font = 'bold 52px ' + FONT;
    ctx.fillText(title, cw / 2, ch * 0.38);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '19px ' + FONT;
    lines.forEach((line, i) => ctx.fillText(line, cw / 2, ch * 0.38 + 44 + i * 30));
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px ' + FONT;
    if (Math.floor(Date.now() / 600) % 2 === 0) ctx.fillText('Tekan Enter — main lagi', cw / 2, ch * 0.68);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, info) {
    const s = state;
    info = info || { best: 0, hasSave: false };
    resize();
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, cw, ch);
    if (screen === SCREEN_TITLE) {
      drawTitle(s, info);
      return;
    }
    drawWorld(s, s.time);
    if (screen === SCREEN_PLAY || screen === SCREEN_DIALOGUE) drawHUD(s, s.time);
    if (screen === SCREEN_DIALOGUE) drawDialogue(s);
    else if (screen === SCREEN_PAUSED) {
      drawHUD(s, s.time);
      drawOverlay('JEDA', ['Istirahat dulu, Bimo.', 'P / Enter — lanjut main'], PALETTE.gold);
    } else if (screen === SCREEN_OVER) {
      const busted = s.gameOver === 'busted';
      drawOverlay(busted ? 'TERTANGKAP!' : 'K.O.!', [
        busted ? 'Polisi menangkap Bimo di jalan.' : 'Bimo tumbang di jalanan Tanjung Pelita.',
        `Misi selesai: ${s.missionsDone}   •   Uang: ${formatRp(s.money)}   •   Kendaraan dicuri: ${s.carsStolen}`,
      ], PALETTE.danger);
    } else if (screen === SCREEN_COMPLETE) {
      drawOverlay('TAMAT — TANJUNG PELITA TENANG', [
        'Bos Pelabuhan tumbang. Bimo lunas utangnya.',
        `Misi selesai: ${s.missionsDone}/4   •   Uang akhir: ${formatRp(s.money)}   •   Kendaraan dicuri: ${s.carsStolen}`,
        'Terima kasih sudah main!',
      ], PALETTE.gold);
    }
  }

  return { draw };
}
