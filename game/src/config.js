// Tanjung Pelita — every tuning number and colour in one place.
// The world is a fixed 2400x1800 logical city; the camera shows a 1280x720 window of it,
// scaled to the browser window, so no rule depends on the screen size.

export const WORLD = { width: 2400, height: 1800 };

/** The camera's logical viewport, in world pixels. */
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads: horizontal and vertical bands the city grid is built on. */
export const ROADS_H = [300, 700, 1100, 1500];
export const ROADS_V = [400, 900, 1400, 1900];
export const ROAD_W = 84;

/** Sea and beach along the south edge. */
export const SEA_Y = 1650;
export const BEACH_Y = 1560;

/** The harbour occupies the east edge, north of the beach. */
export const HARBOR = { x: 2050, y: 900, w: 350, h: 650 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 300,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  bulletSpeed: 720,
  invulnerable: 1.2,
  maxHealth: 100,
};

export const VEHICLES = {
  angkot: { name: 'Angkot', w: 30, h: 52, accel: 420, maxSpeed: 330, reverse: 140, turn: 2.6, color: '#f2c230', roof: '#2e9e4f', price: 0 },
  becak: { name: 'Becak', w: 26, h: 40, accel: 300, maxSpeed: 170, reverse: 80, turn: 3.2, color: '#e2583e', roof: '#f6e05e', price: 0 },
  motor: { name: 'Motor', w: 18, h: 40, accel: 620, maxSpeed: 430, reverse: 120, turn: 3.4, color: '#3b82f6', roof: '#1e3a5f', price: 0 },
  mobil: { name: 'Mobil', w: 30, h: 50, accel: 500, maxSpeed: 380, reverse: 150, turn: 2.8, color: '#8b93a3', roof: '#39415a', price: 0 },
  polisi: { name: 'Polisi', w: 30, h: 52, accel: 560, maxSpeed: 410, reverse: 150, turn: 3.0, color: '#f2f4f6', roof: '#2563eb', price: 0 },
};

export const PED = { radius: 11, speed: 55, fleeSpeed: 150 };
export const POLICE = { radius: 13, footSpeed: 245, carRam: 14, arrestRange: 30 };

export const WANTED = {
  max: 5,
  decaySeconds: 22,
  steal: 1,
  hitPed: 1,
  punchPed: 1,
  shoot: 1,
  killGuard: 0,
};

/** Money, in rupiah. */
export const MONEY = {
  start: 50000,
  mission1: 150000,
  mission2: 250000,
  mission3: 100000,
  mission4: 500000,
  warungHeal: 25000,
  healAmount: 60,
};

export const MISSIONS = [
  {
    id: 1,
    title: 'Misi 1 — Antar Paket',
    speaker: 'Pak Darman',
    brief: [
      'Bimo, utangmu sudah menumpuk.',
      'Antar paket ini ke Pasar. Cepat!',
      'Naik angkot kuning itu — tekan E.',
    ],
    done: ['Paket sampai. Bagus, Bimo.', 'Ini upahmu. Jangan telat lagi.'],
  },
  {
    id: 2,
    title: 'Misi 2 — Kejar-kejaran',
    speaker: 'Pak Darman',
    brief: [
      'Sial! Joko merebut paketnya!',
      'Kejar motornya sampai ke Pelabuhan.',
      'Tabrak motornya untuk merebut paket!',
    ],
    done: ['Paket kembali. Joko kapok.', 'Kau mulai bisa diandalkan, Bimo.'],
  },
  {
    id: 3,
    title: 'Misi 3 — Kabur dari Polisi',
    speaker: 'Bimo',
    brief: [
      'Polisi mengejar! Bintang tiga!',
      'Kabur ke rumah aman di Kampung.',
      'Masuk ke lingkaran kuning sampai aman.',
    ],
    done: ['Aman. Polisi kehilangan jejak.', 'Tarik napas dulu, Bimo.'],
  },
  {
    id: 4,
    title: 'Misi 4 — Bos Pelabuhan',
    speaker: 'Pak Darman',
    brief: [
      'Saatnya bereskan Bos Pelabuhan.',
      'Ambil pistol di depan pelabuhan dulu.',
      'Kalahkan 3 penjaga, lalu hadapi Bosnya!',
    ],
    done: ['Bos Pelabuhan tumbang!', 'Tanjung Pelita akhirnya tenang.'],
  },
];

export const PALETTE = {
  grass: '#5d8a4a',
  grassAlt: '#557f43',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0ab',
  sand: '#e3c98f',
  sea: '#1e7f8e',
  seaDeep: '#166b7a',
  building: '#c98f5f',
  buildingRoof: '#8a5a34',
  house: '#d9a066',
  market: '#b5533c',
  mosque: '#e8e3d3',
  mosqueDome: '#2e9e6b',
  harbour: '#6b7280',
  container: '#c2543a',
  tree: '#2f6b2f',
  player: '#22c55e',
  playerDark: '#15803d',
  police: '#2563eb',
  policeLight: '#ef4444',
  text: '#f4f1e6',
  muted: '#c9c4b4',
  panel: '#1d2433',
  panelEdge: '#3a4358',
  gold: '#f2c230',
  danger: '#ef4444',
  warung: '#e2583e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'tanjung-pelita.save.v1';
export const BEST_KEY = 'tanjung-pelita.best';

/** Format rupiah the Indonesian way: 150000 -> Rp 150.000 */
export function formatRp(n) {
  return 'Rp ' + String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
