/* ============================================================
   Forbes Crossing
   A CMU-campus version of Crossy Road. Plain JS + canvas 2D, no deps, no build.

   File map:
     ① Utilities       ② Canvas & projection  ③ Draw primitives (3D boxes)
     ④ World gen       ⑤ Player               ⑥ Per-frame update
     ⑦ Rendering       ⑧ Input                ⑨ Sound / HUD / flow

   Coordinates: the world is a grid. col is positive right, row is positive forward
   (away from the camera). Screen coords come from one skewed projection, P() in ③ —
   that single function is the whole 2.5D look; everywhere else just draws flat polygons.
   ============================================================ */

(() => {
'use strict';

/* ① Utilities ----------------------------------------------- */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick  = arr => arr[randi(0, arr.length - 1)];

// Multiply a hex color by a factor to get the darker sides of a box.
// Cached because it runs a few hundred times per frame — re-parsing strings is waste.
const shadeCache = new Map();
function shade(hex, k) {
  const key = hex + k;
  if (shadeCache.has(key)) return shadeCache.get(key);
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  const out = `rgb(${r},${g},${b})`;
  shadeCache.set(key, out);
  return out;
}


/* ② Canvas & projection -------------------------------------- */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1, S = 1;
let COL_W, ROW_D, SKEW, UNIT, BASE_H, CX, HORIZON, EDGE;

function resize() {
  // devicePixelRatio: skip this and the whole picture is blurry on a Retina screen.
  // Capped at 2 — on a 3x screen you'd pay nine times the pixels for barely more sharpness.
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Horizontal and vertical are scaled separately — the most important trade-off here:
  // column width comes from screen width, so the 9-column play area always fills ~80% of it;
  // row depth comes from screen height, so on any screen you see only ~9 rows ahead.
  // With one shared scale, a wide screen would show twenty-odd rows blurred into noise.
  COL_W  = clamp(W / 13.5, 32, 78);
  ROW_D  = clamp(H / 11.5, 32, 80);
  SKEW   = -0.12 * ROW_D;   // a row forward also shifts left, so top and right face both show
  UNIT   = 0.62 * COL_W;    // one unit of world height
  BASE_H = 0.19 * COL_W;    // how far grass/sidewalk sits above the road (i.e. the curb)
  S = COL_W / 48;

  // Minus half a cell: cell centers sit at col+0.5, and without it the road shifts half a cell right.
  CX = W * 0.5 - COL_W * 0.5;
  HORIZON = H * 0.72;                        // the player's row sits 72% down the screen
  EDGE = Math.ceil((W * 0.5 + 200) / COL_W) + 2;  // how many cells wide the ground must cover
}

// The core projection: world (col,row) → screen (x,y).
// Farther rows go up and to the left, so one box shows its top and right face at once.
function P(col, row) {
  const rr = row - cam.row;
  return { x: CX + col * COL_W + rr * SKEW, y: HORIZON - rr * ROW_D };
}


/* ③ Draw primitives ------------------------------------------ */

function poly(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/*
  Draw a box. The one and only "3D" function here — cars, trees, benches, the player are all this.
  col,row  world coords of the box's near-left corner
  w,d      width (cells), depth (cells)
  h        height (pixels)
  base     height off the ground (pixels) — used when standing on raised grass
  color    top-face color; the sides are darkened automatically
*/
function box(col, row, w, d, h, color, base = 0) {
  const A = P(col,     row);
  const B = P(col + w, row);
  const C = P(col + w, row + d);
  const D = P(col,     row + d);
  const b = base, t = base + h;

  const at = p => ({ x: p.x, y: p.y - t });   // top face
  const ab = p => ({ x: p.x, y: p.y - b });   // bottom face

  const A1 = ab(A), B1 = ab(B), C1 = ab(C);
  const A2 = at(A), B2 = at(B), C2 = at(C), D2 = at(D);

  poly([B1, C1, C2, B2], shade(color, 0.58));  // right face
  poly([A1, B1, B2, A2], shade(color, 0.79));  // front face
  poly([A2, B2, C2, D2], color);               // top face
}

// A flat parallelogram on the ground: road surfaces, lane markings, shadows.
function tile(col, row, w, d, color, base = 0) {
  const A = P(col, row), B = P(col + w, row), C = P(col + w, row + d), D = P(col, row + d);
  poly([
    { x: A.x, y: A.y - base }, { x: B.x, y: B.y - base },
    { x: C.x, y: C.y - base }, { x: D.x, y: D.y - base },
  ], color);
}


/* Palette: black, white, grey + one CMU red, as on the main site ---- */
/*
  The four ground types have to be told apart at a glance, and what does that is lightness,
  not hue — the palette is only black, white and grey plus one CMU red, same as the main site.
  In the first version grass and sidewalk were both light grey: the two lanes blurred together
  and you couldn't tell safe footing from lethal. Now they sit four lightness steps apart.
*/
const C = {
  lawn:    '#cdd1c9',   // the Cut: mid grey
  lawnAlt: '#c6cbc2',
  walk:    '#e6e5e2',   // plaza paving: the lightest
  walkAlt: '#deddda',
  road:    '#34343a',   // street: dark
  busway:  '#232327',   // busway: darker
  trench:  '#0e0e10',   // construction trench: nearly black
  plate:   '#8d8f93',
  mark:    '#f4f4f2',
  accent:  '#c8102e',   // CMU red: hoodie, 61C, police light, coffee sleeve
  rig:     '#d9a021',   // machinery yellow: excavator and dump truck only
  rigDark: '#b3831a',
  cone:    '#e0712a',   // traffic-cone orange
  navy:    '#2f4374',   // the other half of the police light — the only blue in the game
  dark:    '#141416',
  hair:    '#3a332e',   // back of the head
  skin:    '#f6e3cf',   // face. Two lightness steps off the hair, so turning reads
};

// Text on the vehicles. The team name and the mascot — two is enough.
// The first version had six, and every car in a lane got the same word, so a
// screenful was a dozen words: a billboard. Now each car rolls for it separately.
const LABELS = ['TARTANS', 'SCOTTY'];
const LABEL_CHANCE = 0.16;

// Given a background color, return a text color that stays legible on it.
function inkOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? '#1b1b1d' : '#f4f4f2';
}

/*
  A 3×5 bitmap font.
  The vehicle text started as fillText in Inter; smooth vector letters on a pile of blocks broke
  the spell badly — the whole world is chunky color blocks, and only those words came from "another
  era". So the letters are built from blocks too: each character 3 cells wide and 5 tall, one cell
  being one solid square. That works because a car's front face has horizontal edges in this projection.
*/
/*
  Glyph width varies: 3 cells is enough for most letters, but not for M / N / W —
  a diagonal stroke won't fit in 3 cells. The first version's N was '#.#/###/###/###/#.#',
  which read as a blob and made TARTANS look like TARTAMS. Those three get 4 cells.
*/
const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#..#', '####', '####', '#..#', '#..#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#..#', '#..#', '#..#', '####', '#..#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '..#', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  ' ': ['..', '..', '..', '..', '..'],
};

const glyph = ch => GLYPHS[ch] || GLYPHS[' '];
const textCells = t => {
  let w = 0;
  for (let i = 0; i < t.length; i++) w += glyph(t[i])[0].length + 1;
  return w - 1;                        // no gap after the last character
};

// Draw a string as squares. cx/cy are screen coords (center of the whole block), px = pixels per cell.
// Coordinates are rounded; without that, antialiasing smears the little squares into grey edges.
function pixelText(text, cx, cy, px, color) {
  let x0 = Math.round(cx - textCells(text) * px / 2);
  const y0 = Math.round(cy - 5 * px / 2);
  // All the squares go into one path and get filled once. With a fillRect each,
  // "CMU POLICE" alone is about ninety draw calls per car — a few on screen and it drops frames.
  ctx.beginPath();
  for (let i = 0; i < text.length; i++) {
    const g = glyph(text[i]);
    const gw = g[0].length;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < gw; c++) {
        if (g[r][c] === '#') ctx.rect(x0 + c * px, y0 + r * px, px, px);
      }
    }
    x0 += (gw + 1) * px;
  }
  ctx.fillStyle = color;
  ctx.fill();
}

// Vehicles. w/d are in cells, h is in UNITs.
const VEHICLES = [
  { w: 1.75, d: 0.86, h: 0.80, body: '#202022', roof: '#343436' },
  { w: 1.75, d: 0.86, h: 0.80, body: '#f0f0ee', roof: '#d4d4d1' },
  { w: 1.95, d: 0.90, h: 0.95, body: '#8b8d91', roof: '#6f7175' },
  { w: 2.60, d: 0.92, h: 1.15, body: '#f4f4f2', roof: '#dcdcd9', truck: true },
];
// The 61C — the only thing that comes barreling down the dedicated lane.
const BUS = { w: 3.6, d: 0.95, h: 1.25, body: C.accent, roof: '#9c0d24', bus: true, label: '61C' };
// Campus police car. White body + roof lightbar; the two halves alternate, and that's the only blue in the game.
const POLICE = { w: 2.0, d: 0.9, h: 0.95, body: '#f6f6f4', roof: '#e0e0dc', police: true, label: 'CMU POLICE' };


/* ④ World generation ----------------------------------------- */

const MINC = -4, MAXC = 4;       // the range the player can walk: 9 cells
const LANE_L = -15, LANE_R = 15; // the interval vehicles loop over — a bit wider than the screen is enough

const lanes = new Map();         // row → lane
let genRow = 0;                  // how far generation has gotten
let dangerStreak = 0;            // consecutive dangerous lanes — keeps five streets from spawning in a row

function laneAt(row) {
  while (genRow <= row) { lanes.set(genRow, makeLane(genRow)); genRow++; }
  return lanes.get(row);
}

function difficulty(row) { return clamp(row / 160, 0, 1); }

function makeLane(row) {
  // The first three rows are always safe sidewalk, so you can work out who you are first.
  if (row < 3) {
    const lane = safeLane(row, 'walk', row === 0 ? 0 : 0.18);
    // Straight ahead is always open at the start. Otherwise the first hop hits a wall and people assume the game is broken.
    lane.blocked.delete(0);
    lane.obstacles = lane.obstacles.filter(o => o.col !== 0);
    // Row 0's left side is reserved for Walking to the Sky — clear the props there so nothing overlaps it.
    if (row === 0) lane.obstacles = lane.obstacles.filter(o => o.col > MINC - 1);
    return lane;
  }

  const d = difficulty(row);
  let type;

  if (dangerStreak >= 3) {
    type = Math.random() < 0.6 ? 'lawn' : 'walk';   // force a breather
  } else {
    const r = Math.random();
    const pRoad   = 0.36 + 0.10 * d;
    const pTrench = pRoad + 0.13 + 0.03 * d;
    const pBus    = pTrench + 0.05 + 0.06 * d;
    const pLawn   = pBus + 0.26 - 0.10 * d;
    if      (r < pRoad)   type = 'road';
    else if (r < pTrench) type = 'trench';
    else if (r < pBus)    type = 'busway';
    else if (r < pLawn)   type = 'lawn';
    else                  type = 'walk';
  }

  // Never two busways back to back — with two adjacent there's no time to react.
  if (type === 'busway' && lanes.get(row - 1)?.type === 'busway') type = 'road';
  // Streets only for the first 8 rows. The trench and 61C rules need time to be learned first.
  if (row < 8 && (type === 'trench' || type === 'busway')) type = 'road';

  dangerStreak = (type === 'road' || type === 'trench' || type === 'busway')
    ? dangerStreak + 1 : 0;

  if (type === 'road')   return roadLane(row, d);
  if (type === 'trench') return trenchLane(row, d);
  if (type === 'busway') return buswayLane(row, d);
  return safeLane(row, type, 0.20 + 0.10 * d);
}

/* Safe lane: grass (the Cut) or sidewalk. The props are both decoration and roadblocks. */
function safeLane(row, kind, density) {
  const lane = {
    type: kind, row, base: BASE_H,
    color: kind === 'lawn' ? (row % 2 ? C.lawn : C.lawnAlt)
                           : (row % 2 ? C.walk : C.walkAlt),
    obstacles: [], blocked: new Set(), coffee: null, entities: [],
  };

  // Two cells of trees / planters just outside the play area on each side. Only two:
  // six cells were tried, and the screen filled with clutter that hid where you could actually walk;
  // one continuous wall was tried too, and stacked over a few rows it read as a ridge, louder than the trees.
  for (let i = 1; i <= 2; i++) {
    lane.obstacles.push(makeProp(MINC - i, kind));
    lane.obstacles.push(makeProp(MAXC + i, kind));
  }

  // Props inside the play area are scattered randomly, but one gap is always left — a fully blocked row is a dead end.
  const free = [];
  for (let c = MINC; c <= MAXC; c++) {
    if (Math.random() < density) {
      lane.obstacles.push(makeProp(c, kind));
      lane.blocked.add(c);
    } else free.push(c);
  }
  if (free.length === 0) {                       // fallback: if everything got blocked, carve one cell open
    const c = randi(MINC, MAXC);
    lane.blocked.delete(c);
    lane.obstacles = lane.obstacles.filter(o => o.col !== c);
    free.push(c);
  }

  // Coffee. Sits on a free cell; a pure collectible, picking it up never decides win or loss.
  // The rate went from 0.16 to 0.28: seven cups is the win condition, and too sparse means never winning.
  // Safe lanes are about 40% of all rows, so a cup shows up roughly every seven or eight rows.
  if (row > 4 && Math.random() < 0.28) lane.coffee = pick(free);

  return lane;
}

function makeProp(col, kind) {
  if (kind === 'lawn') {
    const big = Math.random() < 0.55;
    return { col, kind: 'tree', h: big ? rand(1.0, 1.6) : rand(0.6, 0.95), w: big ? 0.76 : 0.58 };
  }
  return { col, kind: pick(['bin', 'bench', 'lamp', 'rack']), h: 0, w: 0 };
}

/* Street: cars fill the whole lane at a fixed spacing and shift as one, so looping never opens a gap. */
function roadLane(row, d) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = rand(2.0, 3.8) * (1 + 0.55 * d);
  // One lane runs one kind of car, and the spacing is computed for that kind.
  const kind = pick(VEHICLES);
  const gap = rand(3.4, 7.0) - 1.6 * d;
  // Spacing allows for the widest body possible, so a wider police car mixed in never squeezes the gap shut.
  const period = Math.max(kind.w, POLICE.w) + Math.max(1.8, gap);
  // The loop length is a whole multiple of period, or the spacing would jump when cars wrap around.
  const count = Math.ceil((LANE_R - LANE_L) / period);
  const span = count * period;
  const offset = rand(0, period);

  const entities = [];
  for (let i = 0; i < count; i++) {
    // The police car is rolled per vehicle. It used to be rolled per lane, so when it
    // appeared it was a whole row of cruisers — that reads as a response, not a patrol.
    const k = Math.random() < 0.05 ? POLICE : kind;
    // Labels are rolled per vehicle too, and only on cars wide enough — on a narrow one the letters cram together.
    // The police car and the 61C carry their own markings and skip the roll.
    const label = k.label
      || (k.w >= 1.9 && Math.random() < LABEL_CHANCE ? pick(LABELS) : null);
    entities.push({ x: LANE_L + offset + i * period, kind: k, label });
  }
  return { type: 'road', row, base: 0, color: C.road, dir, speed, span, entities, obstacles: [], blocked: new Set(), coffee: null };
}

/* Construction trench: the CMU version of "crossing the river". Steel plates are the logs; miss one and you fall in. */
function trenchLane(row, d) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = rand(1.1, 2.1) * (1 + 0.35 * d);
  const len = randi(2, 4);
  const gap = rand(1.5, 2.6) + 0.4 * d;
  const period = len + gap;
  const count = Math.ceil((LANE_R - LANE_L) / period);
  const span = count * period;
  const offset = rand(0, period);

  const entities = [];
  for (let i = 0; i < count; i++) {
    const e = { x: LANE_L + offset + i * period, len };
    // The machinery parks on the plates. In the first version it sat on the shoulder
    // outside the play area, where a narrow window cropped it away entirely — drawn for nothing.
    // On a plate it's always in view, and it doubles as an obstacle: the plate is standable, but only the free half.
    if (len >= 3 && Math.random() < 0.42) {
      e.rig = {
        kind: Math.random() < 0.5 ? 'excavator' : 'dumper',
        off: Math.random() < 0.5 ? 0 : len - 2,   // parked at one end, leaving at least one standable cell
        face: Math.random() < 0.5 ? -1 : 1,
      };
    }
    // Cones go along the plate's two long edges, off the standable center line — pure decoration.
    e.cones = [];
    for (let k = 0; k < len; k++) {
      if (Math.random() < 0.32) {
        e.cones.push({ o: k + rand(0.3, 0.7), s: Math.random() < 0.5 ? 0.15 : 0.85 });
      }
    }
    entities.push(e);
  }

  return { type: 'trench', row, base: 0, color: C.trench, dir, speed, span, entities, obstacles: [], blocked: new Set(), coffee: null };
}

/* Busway: the warning light flashes first, then the 61C tears through at full speed. */
function buswayLane(row, d) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    type: 'busway', row, base: 0, color: C.busway, dir,
    speed: rand(13, 17) + 4 * d,
    warn: rand(0.4, 2.4),          // warning time remaining
    x: dir > 0 ? LANE_L : LANE_R,  // the bus waits off-lane while the light flashes
    running: false,
    entities: [], obstacles: [], blocked: new Set(), coffee: null,
  };
}


/* ⑤ Player -------------------------------------------------- */

const HOP_TIME = 0.13;

const player = {
  col: 0, row: 0,
  fromCol: 0, fromRow: 0, toCol: 0, toRow: 0,
  t: 1,              // hop progress 0→1; 1 means already landed
  facing: 0,         // 0 forward, 1 right, 2 back, 3 left
  ride: null,        // the steel plate currently being stood on
  maxRow: 0,
  idle: 0,
  squish: 0,
};

const cam = { row: 0 };

const GOAL = 7;              // this many cups of coffee = you made it to class, you win
let winT = 0;

let mode = 'title';          // title | playing | dying | winning | over
let dyingT = 0, cause = '';
// Death animation: the kind decides what plays and for how long; deathDir is the direction you're flung / carried off in
let deathKind = 'hit', deathDir = 1;
const DEATH_TIME = { hit: 0.95, fall: 0.85, carried: 0.95, squirrel: 1.9 };
let queued = null;           // the next direction pressed mid-hop; runs the moment you land
let coffee = 0;
let best = 0;

function resetGame() {
  lanes.clear();
  genRow = 0; dangerStreak = 0;
  player.col = 0; player.row = 0;
  player.fromCol = 0; player.fromRow = 0; player.toCol = 0; player.toRow = 0;
  player.t = 1; player.facing = 0; player.ride = null;
  player.maxRow = 0; player.idle = 0; player.squish = 0;
  cam.row = 0;
  coffee = 0; queued = null; dyingT = 0; winT = 0;
  for (let r = -8; r < 24; r++) laneAt(Math.max(r, 0));
  setScore(0);
  ui.coffee.textContent = '0';
}

// Try to hop in a direction. Backtracking too far, walls and out-of-bounds are all rejected here.
function hop(dx, dy) {
  if (mode !== 'playing') return;
  if (player.t < 1) { queued = [dx, dy]; return; }   // mid-hop: remember it for later

  const dest = player.row + dy;
  if (dest < player.maxRow - 4) return;              // no backing up forever
  if (dest < 0) return;

  const lane = laneAt(dest);
  // On a plate the fractional offset has to be kept, or a sideways hop snaps you back to a whole cell.
  const baseCol = (lane.type === 'trench' && dy === 0) ? player.col : Math.round(player.col);
  const target = baseCol + dx;

  if (target < MINC || target > MAXC) return;
  if (lane.blocked.has(Math.round(target))) return;
  // The two cells a machine occupies on a plate are impassable. Empty trench is still allowed — that's jumping in on purpose.
  if (lane.type === 'trench' && rigBlocks(plateUnder(lane, target), target)) return;

  player.fromCol = player.col; player.fromRow = player.row;
  player.toCol = target;      player.toRow = dest;
  player.t = 0;
  player.ride = null;
  player.facing = dy > 0 ? 0 : dy < 0 ? 2 : (dx > 0 ? 1 : 3);
  sfx('hop');
}

function land() {
  player.col = player.toCol;
  player.row = player.toRow;
  player.squish = 1;

  const lane = laneAt(player.row);

  if (lane.type === 'trench') {
    const p = plateUnder(lane, player.col);
    if (!p) return die('You went into the trench they never finish.', 'fall');
    player.ride = p;
    // On landing, record the position relative to the plate, then ride along with it.
    player.rideOffset = player.col - p.x;
  } else {
    player.ride = null;
  }

  // Score first, then check for the win: the row you win on still counts toward the score.
  if (player.row > player.maxRow) {
    player.maxRow = player.row;
    player.idle = 0;
    setScore(player.maxRow);
  }

  if (lane.coffee !== null && Math.round(player.col) === lane.coffee) {
    lane.coffee = null;
    coffee++;
    ui.coffee.textContent = coffee;
    sfx('coin');
    if (coffee >= GOAL) { win(); return; }
  }

  if (queued) { const q = queued; queued = null; hop(q[0], q[1]); }
}

function plateUnder(lane, col) {
  for (const e of lane.entities) {
    if (col >= e.x - 0.5 && col <= e.x + e.len - 0.5) return e;
  }
  return null;
}

// You can't stand on the two cells a machine occupies. The test uses the player's center (col + 0.5).
function rigBlocks(plate, col) {
  if (!plate || !plate.rig) return false;
  const c = col + 0.5;
  return c > plate.x + plate.rig.off && c < plate.x + plate.rig.off + 2;
}

function die(reason, kind = 'hit', dir = 1) {
  if (mode !== 'playing') return;
  mode = 'dying';
  dyingT = 0;
  cause = reason;
  deathKind = kind;
  // which side the squirrel darts in from is random
  deathDir = kind === 'squirrel' ? (Math.random() < 0.5 ? -1 : 1) : dir;
  sfx('die');
}

function win() {
  if (mode !== 'playing') return;
  mode = 'winning';
  winT = 0;
  sfx('win');
}


/* ⑥ Per-frame update ----------------------------------------- */

function update(dt) {
  // Traffic and plates keep moving — including on the title screen, so it isn't a still image.
  const lo = Math.floor(cam.row) - 10, hi = Math.floor(cam.row) + 24;
  for (let r = Math.max(0, lo); r <= hi; r++) {
    const lane = laneAt(r);
    if (lane.type === 'road' || lane.type === 'trench') {
      for (const e of lane.entities) {
        e.x += lane.dir * lane.speed * dt;
        if (lane.dir > 0 && e.x > LANE_R) e.x -= lane.span;
        if (lane.dir < 0 && e.x < LANE_L) e.x += lane.span;
      }
    } else if (lane.type === 'busway') {
      updateBusway(lane, dt);
    }
  }

  if (mode === 'playing') {
    updatePlayer(dt);
    checkHazards(dt);
  } else if (mode === 'dying') {
    dyingT += dt;
    if (dyingT > DEATH_TIME[deathKind]) gameOver();
  } else if (mode === 'winning') {
    winT += dt;
    if (winT > 1.15) showWin();
  }

  // Camera follow. Exponential smoothing: the farther from the target the faster it catches up, and it doesn't jitter at rest.
  const targetRow = player.t < 1
    ? player.fromRow + (player.toRow - player.fromRow) * player.t
    : player.row;
  cam.row += (targetRow - cam.row) * Math.min(1, dt * 11);
}

function updateBusway(lane, dt) {
  if (lane.running) {
    lane.x += lane.dir * lane.speed * dt;
    if ((lane.dir > 0 && lane.x > LANE_R) || (lane.dir < 0 && lane.x < LANE_L - BUS.w)) {
      lane.running = false;
      lane.dir = Math.random() < 0.5 ? 1 : -1;
      lane.x = lane.dir > 0 ? LANE_L - BUS.w : LANE_R;
      lane.warn = rand(1.6, 3.4);
    }
  } else {
    lane.warn -= dt;
    if (lane.warn <= 0) lane.running = true;
  }
}

function updatePlayer(dt) {
  if (player.t < 1) {
    player.t = Math.min(1, player.t + dt / HOP_TIME);
    player.col = player.fromCol + (player.toCol - player.fromCol) * player.t;
    if (player.t >= 1) land();
  } else if (player.ride) {
    // Carried along by the plate. Past the edge means you've been hauled off site.
    const lane = laneAt(player.row);
    player.col = player.ride.x + player.rideOffset;
    if (player.col < MINC - 0.7 || player.col > MAXC + 0.7) {
      return die('The steel plate carried you off site.', 'carried', lane.dir);
    }
    if (!plateUnder(lane, player.col)) return die('You went into the trench they never finish.', 'fall');
    void lane;
  }

  player.squish = Math.max(0, player.squish - dt * 6);

  // The penalty for standing still. The squirrel is the CMU version of Crossy Road's eagle.
  player.idle += dt;
  if (player.idle > 14) die('A campus squirrel decided you were food.', 'squirrel');
}

function checkHazards(dt) {
  void dt;
  const row = player.t < 1 && player.t > 0.5 ? player.toRow : player.row;
  const lane = laneAt(row);
  const px = player.t < 1 ? player.col : player.col;
  const halfP = 0.34;

  if (lane.type === 'road') {
    for (const e of lane.entities) {
      const c = e.x + e.kind.w / 2 - 0.5;
      if (Math.abs(px - c) < e.kind.w / 2 + halfP - 0.14) {
        return die(e.kind.truck ? 'A facilities truck got you.' : 'You got hit crossing Forbes.',
                   'hit', lane.dir);
      }
    }
  } else if (lane.type === 'busway' && lane.running) {
    const c = lane.x + BUS.w / 2 - 0.5;
    if (Math.abs(px - c) < BUS.w / 2 + halfP - 0.14) return die('The 61C does not stop for you.', 'hit', lane.dir);
  }
}


/* ⑦ Rendering ----------------------------------------------- */

function render() {
  // Background: white at the top into a faint grey at the bottom — a little atmosphere in the distance, and it blends into the site's white.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#f2f2f0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // How many rows to draw is derived from the projection: exactly enough to fill the screen, no extra, no gaps.
  const ahead  = Math.ceil(HORIZON / ROW_D) + 3;
  const behind = Math.ceil((H - HORIZON) / ROW_D) + 2;
  const first = Math.floor(cam.row) + ahead;
  const last = Math.max(0, Math.floor(cam.row) - behind);
  const playerDrawRow = Math.round(player.t < 1
    ? player.fromRow + (player.toRow - player.fromRow) * player.t
    : player.row);

  // Draw far to near. Near rows paint over far ones — that's the entire depth sort.
  for (let r = first; r >= last; r--) {
    const lane = laneAt(r);
    drawLane(lane);
    if (r === playerDrawRow) drawPlayer();
  }
}

function drawLane(lane) {
  const r = lane.row;

  if (lane.type === 'lawn' || lane.type === 'walk') {
    // Raised ground: one flat box whose front face naturally becomes the curb.
    box(-EDGE, r, EDGE * 2, 1, lane.base, lane.color);
    if (lane.type === 'walk') {
      for (let c = -EDGE; c < EDGE; c += 1) {
        tile(c + 0.97, r, 0.03, 1, 'rgba(0,0,0,0.055)', lane.base);
      }
    }
  } else {
    tile(-EDGE, r, EDGE * 2, 1, lane.color, 0);
    if (lane.type === 'road') {
      // Lane center line. Drawn down the middle of the row so the traffic direction reads at a glance.
      for (let c = -EDGE; c < EDGE; c += 2) tile(c, r + 0.46, 0.9, 0.08, C.mark);
    } else if (lane.type === 'busway') {
      for (let c = -EDGE; c < EDGE; c += 1.5) tile(c, r + 0.2, 0.7, 0.06, 'rgba(255,255,255,0.34)');
      for (let c = -EDGE; c < EDGE; c += 1.5) tile(c, r + 0.74, 0.7, 0.06, 'rgba(255,255,255,0.34)');
      if (!lane.running) drawWarning(lane);
    } else if (lane.type === 'trench') {
      tile(-EDGE, r + 0.14, EDGE * 2, 0.72, '#0b0b0c');          // one more step darker at the bottom of the trench
      // Only the near side gets a light cut edge, read as the opening in the concrete.
      // Black-and-white hazard stripes across the whole lane were tried, but they collided with the road's
      // dashes — from far off both lanes looked the same, so the striping moved to solid barriers outside.
      tile(-EDGE, r + 0.9, EDGE * 2, 0.06, '#6e7074');
      // Rebar and pipework at the bottom of the trench. On a narrow screen the machinery
      // gets cropped, so these two strokes are the only proof of "this is an open trench" on every screen.
      for (let c = -EDGE; c < EDGE; c += 0.8) tile(c, r + 0.2, 0.07, 0.6, '#26282c');
      tile(-EDGE, r + 0.5, EDGE * 2, 0.11, '#3d3f44');
      drawBarrier(MINC - 1.7, r);
      drawBarrier(MAXC + 1.3, r);
    }
  }

  if (lane.coffee !== null && lane.coffee !== undefined) drawCoffee(lane.coffee, r, lane.base);

  for (const o of lane.obstacles) drawProp(o, r, lane.base);

  // Walking to the Sky stands to the left of the starting row. You see it in the first glance,
  // and it scrolls out of frame once you're far enough away — it's a landmark, not a backdrop.
  if (r === 0) drawSculpture(r);

  if (lane.type === 'road') {
    // Offscreen cars don't get drawn. A lane holds 12; drawing half of them is enough and saves half the polygons.
    for (const e of lane.entities) {
      if (e.x > EDGE + 1 || e.x + e.kind.w < -EDGE - 1) continue;
      drawVehicle(e.x, r, e.kind, lane.dir, e.label);
    }
  } else if (lane.type === 'trench') {
    for (const e of lane.entities) {
      if (e.x > EDGE + 1 || e.x + e.len < -EDGE - 1) continue;
      drawPlate(e, r);
    }
  } else if (lane.type === 'busway' && lane.running) {
    drawVehicle(lane.x, r, BUS, lane.dir, BUS.label);
  }
}

function drawWarning(lane) {
  // The faster the light flashes, the closer the bus is. This is the player's only warning.
  const t = performance.now() / 1000;
  const rate = lane.warn < 1 ? 9 : 3.5;
  const on = Math.sin(t * rate) > 0;
  if (!on) return;
  for (const c of [MINC - 1.4, MAXC + 1.1]) {
    box(c, lane.row + 0.3, 0.4, 0.4, UNIT * 0.85, C.accent);
  }
}

function drawVehicle(x, row, kind, dir, label) {
  const y = row + (1 - kind.d) / 2;
  const bodyH = UNIT * kind.h * 0.85;
  tile(x - 0.06, y + 0.06, kind.w, kind.d, 'rgba(0,0,0,0.10)');   // shadow
  box(x, y, kind.w, kind.d, bodyH, kind.body);
  // Roof / cargo box, pulled back toward the rear so the vehicle reads as having a front and a back.
  const roofW = kind.bus ? kind.w * 0.86 : kind.w * 0.52;
  const roofX = dir > 0 ? x + kind.w - roofW - kind.w * 0.08 : x + kind.w * 0.08;
  const roofH = UNIT * kind.h * 0.5;
  box(roofX, y + 0.08, roofW, kind.d - 0.16, roofH, kind.roof, bodyH);
  // Headlight: a small patch of white that also tells you which way the car is going.
  const lx = dir > 0 ? x + kind.w - 0.12 : x;
  tile(lx, y + 0.18, 0.12, kind.d - 0.36, '#ffffff', bodyH * 0.55);

  if (kind.police) {
    // Lightbar: the red and blue halves alternate. The lit half is drawn at full height and the
    // dark one squashed flat, so it flashes without either color changing.
    const on = Math.floor(performance.now() / 260) % 2 === 0;
    const bar = roofX + roofW * 0.16;
    box(bar, y + kind.d * 0.32, roofW * 0.3, kind.d * 0.3,
        UNIT * (on ? 0.16 : 0.07), C.accent, bodyH + roofH);
    box(bar + roofW * 0.36, y + kind.d * 0.32, roofW * 0.3, kind.d * 0.3,
        UNIT * (on ? 0.07 : 0.16), C.navy, bodyH + roofH);
  }

  // The vehicle text, drawn as a bitmap on the front face — in this projection that face has
  // horizontal top and bottom edges, so the squares align to screen pixels with no transform at all.
  if (label) {
    const A = P(x, y), B = P(x + kind.w, y);
    const faceW = B.x - A.x;
    // Cell size is set from the text height first, then checked against the width; take the smaller.
    let px = Math.round(bodyH * 0.42 / 5);
    px = Math.min(px, Math.floor(faceW * 0.84 / textCells(label)));
    // Below 2 pixels a bitmap letter is just a smudge of noise — better not to draw it at all.
    if (px >= 2) {
      pixelText(label, (A.x + B.x) / 2, A.y - bodyH * 0.46, px, inkOn(kind.body));
    }
  }
}

function drawPlate(e, row) {
  box(e.x, row + 0.08, e.len, 0.84, UNIT * 0.22, C.plate);
  // seams between plates, so the length reads
  for (let i = 1; i < e.len; i++) {
    tile(e.x + i - 0.02, row + 0.08, 0.04, 0.84, shade(C.plate, 0.72), UNIT * 0.22);
  }
  if (e.rig) drawRig(e.rig, e.x + e.rig.off, row, UNIT * 0.22);
  if (e.cones) for (const c of e.cones) drawCone(e.x + c.o, row + c.s, UNIT * 0.22);
}

/*
  Walking to the Sky — the leaning pole to the left of the start.
  The slanted shaft is again a string of small boxes along a polyline (the same trick as the
  excavator's arm): each segment steps up and a little to the right, adding up to a leaning pole.
  The figures on the pole and on the ground are boxes in several colors — the one place color runs free.
*/
const SKY_FIG = ['#c8102e', '#3a332e', '#f2f2f0', '#d9a021', '#8e9094', '#5c6f8a'];

function drawSculpture(row) {
  const bx = -5.2;                  // to the left, outside the play area
  const by = row + 0.55;
  const N = 13;
  const RISE = UNIT * 0.34;         // rise per segment
  const RUN = 0.10;                 // rightward step per segment — the ratio of these two is the lean angle

  tile(bx - 0.9, by - 0.75, 1.8, 1.5, 'rgba(0,0,0,0.10)');
  box(bx - 0.75, by - 0.6, 1.5, 1.2, UNIT * 0.12, '#d6d6d2');       // plinth

  // a few figures on the ground, looking up
  const ground = [[-0.45, -0.32], [-0.24, 0.28], [0.34, -0.12]];
  ground.forEach(([ox, oy], i) => {
    box(bx + ox - 0.07, by + oy - 0.06, 0.14, 0.12, UNIT * 0.3,
        SKY_FIG[(i + 2) % SKY_FIG.length], UNIT * 0.12);
  });

  // The pole. Segments stacked upward, each shifted a bit right — that's a leaning pole.
  for (let i = 0; i < N; i++) {
    box(bx - 0.12 + i * RUN, by - 0.12 + i * RUN * 0.45, 0.24, 0.24,
        RISE + 1, '#bcbeb9', UNIT * 0.12 + i * RISE);
  }
  // the figures climbing the pole, one every other segment
  for (let i = 1; i < N; i += 2) {
    box(bx + i * RUN + 0.04, by + i * RUN * 0.45 - 0.09, 0.19, 0.18, UNIT * 0.38,
        SKY_FIG[((i - 1) / 2) % SKY_FIG.length], UNIT * 0.12 + i * RISE + RISE * 0.3);
  }
}

// Traffic cone. Four boxes narrowing upward — this renderer has no slanted faces, so a taper has to be stepped layer by layer.
function drawCone(cx, cy, base) {
  box(cx - 0.075, cy - 0.075, 0.15, 0.15, UNIT * 0.04, C.dark, base);
  box(cx - 0.055, cy - 0.055, 0.11, 0.11, UNIT * 0.09, C.cone, base + UNIT * 0.04);
  box(cx - 0.042, cy - 0.042, 0.084, 0.084, UNIT * 0.05, '#f2f2f0', base + UNIT * 0.13);
  box(cx - 0.028, cy - 0.028, 0.056, 0.056, UNIT * 0.09, C.cone, base + UNIT * 0.18);
}

// Site barrier. Four alternating black and white boxes make one section; the striping still
// reads as "construction" in pure black and white, no accent color needed — red is for the hoodie, the 61C and the coffee.
function drawBarrier(x0, row) {
  for (let i = 0; i < 4; i++) {
    box(x0 + i * 0.25, row + 0.34, 0.25, 0.16, UNIT * 0.32,
        i % 2 ? '#1b1b1d' : '#eeeeec');
  }
  box(x0 - 0.04, row + 0.3, 0.08, 0.24, UNIT * 0.36, '#5c5e62');   // legs
  box(x0 + 1.0, row + 0.3, 0.08, 0.24, UNIT * 0.36, '#5c5e62');
}

// Draw a box from its center point. The machinery's parts are all placed relative to the body's
// center, and working from the left corner means subtracting half a width every time — easy to get wrong.
function bc(cx, cy, w, d, h, color, base = 0) {
  box(cx - w / 2, cy - d / 2, w, d, h, color, base);
}

/*
  Machinery parked at the edge of the trench. Purely decorative: no collision, never in the way,
  always positioned outside the walkable 9 cells.
  side = +1 parks on the right (arm reaching left into the trench), -1 the other way.
*/
/*
  Machinery parked on a steel plate. It occupies 2 cells × 1 row and is drawn entirely inside that —
  overhang by even a little and it covers part of the standable plate next door, so it looks like an
  obstacle but can actually be walked through: the worst kind of visual lie.
  x0 is the left edge of the leftmost of the two cells; base is the top surface of the plate.
*/
function drawRig(rig, x0, row, base) {
  const cx = x0 + 1;
  const cy = row + 0.5;
  const f = rig.face;   // which way the front points: +1 right, -1 left

  // The body is machinery yellow. It used to be all grey, which blended into the plates and the
  // road so you couldn't tell it was a machine — one color from outside the greyscale was the cheapest fix.
  if (rig.kind === 'excavator') {
    bc(cx, cy, 1.5, 0.7, UNIT * 0.20, '#2c2e33', base);                            // tracks
    bc(cx - f * 0.28, cy, 0.92, 0.6, UNIT * 0.6, C.rig, base + UNIT * 0.20);       // slew platform
    bc(cx - f * 0.06, cy - 0.04, 0.4, 0.42, UNIT * 0.3, '#2f3338', base + UNIT * 0.5); // cab glass
    bc(cx - f * 0.62, cy, 0.3, 0.46, UNIT * 0.34, C.rigDark, base + UNIT * 0.20);  // rear counterweight

    // The boom: three boxes along an "up then back down" polyline, faking one slanted arm.
    // There is no rotation anywhere in this renderer, so a real diagonal bar is impossible — a polyline is the only way.
    const arm = [[0.34, 0.58, 0.52], [0.66, 0.86, 0.36], [0.90, 0.36, 0.54]];
    for (const [off, up, h] of arm) {
      bc(cx + f * off, cy, 0.26, 0.24, UNIT * h, C.rig, base + UNIT * up);
    }
    bc(cx + f * 0.95, cy, 0.4, 0.34, UNIT * 0.26, '#3a3c40', base);                // bucket
  } else {
    bc(cx, cy + 0.26, 1.9, 0.18, UNIT * 0.18, '#1d1f22', base);                    // wheels
    bc(cx, cy, 1.95, 0.6, UNIT * 0.2, '#43454a', base + UNIT * 0.14);              // chassis
    bc(cx + f * 0.66, cy, 0.62, 0.52, UNIT * 0.58, C.rig, base + UNIT * 0.34);     // cab
    bc(cx + f * 0.66, cy - f * 0.02, 0.44, 0.4, UNIT * 0.16, '#2f3338', base + UNIT * 0.78); // glass
    bc(cx - f * 0.38, cy, 1.1, 0.58, UNIT * 0.7, C.rigDark, base + UNIT * 0.34);   // dump bed
    bc(cx - f * 0.38, cy, 0.9, 0.44, UNIT * 0.16, '#8e8f88', base + UNIT * 1.04);  // dirt in the bed
  }
}

/*
  A cup of coffee. The one on the ground and the ones stacked on your head are the same function —
  a paper cup is narrow at the bottom and wide at the top, so it's three widening boxes plus a lid.
  scale lets the stack on the head be drawn a little smaller.
*/
function cup(cx, cy, y, k = 1) {
  bc(cx, cy, 0.17 * k, 0.16 * k, UNIT * 0.11 * k, '#f7f7f5', y);                       // base of the cup
  bc(cx, cy, 0.21 * k, 0.19 * k, UNIT * 0.09 * k, C.accent, y + UNIT * 0.11 * k);      // heat sleeve
  bc(cx, cy, 0.23 * k, 0.21 * k, UNIT * 0.07 * k, '#fbfbf9', y + UNIT * 0.20 * k);     // rim
  bc(cx, cy, 0.26 * k, 0.24 * k, UNIT * 0.05 * k, '#4a4c50', y + UNIT * 0.27 * k);     // lid
}

function drawProp(o, row, base) {
  const c = o.col;
  // A faint shadow under every prop. Without it, every box looks like it's floating.
  tile(c + 0.2, row + 0.26, 0.6, 0.54, 'rgba(0,0,0,0.06)', base);

  if (o.kind === 'tree') {
    const h = UNIT * o.h;
    box(c - 0.09 + 0.5, row + 0.42, 0.18, 0.18, UNIT * 0.34, '#8d8f89', base);   // trunk
    box(c - o.w / 2 + 0.5, row + 0.5 - o.w / 2, o.w, o.w, h, '#9ba096', base + UNIT * 0.22);
  } else if (o.kind === 'bin') {
    box(c + 0.28, row + 0.3, 0.44, 0.44, UNIT * 0.62, '#4e5053', base);
  } else if (o.kind === 'bench') {
    box(c + 0.08, row + 0.36, 0.84, 0.3, UNIT * 0.34, '#9d9f9a', base);
  } else if (o.kind === 'lamp') {
    box(c + 0.42, row + 0.42, 0.16, 0.16, UNIT * 1.15, '#87898c', base);
    box(c + 0.3, row + 0.36, 0.4, 0.28, UNIT * 0.16, '#d2d2cf', base + UNIT * 1.15);
  } else if (o.kind === 'rack') {
    box(c + 0.14, row + 0.4, 0.72, 0.12, UNIT * 0.5, '#7c7e82', base);
  }
}

function drawCoffee(col, row, base) {
  const bob = Math.sin(performance.now() / 300 + col) * UNIT * 0.07;
  tile(col + 0.34, row + 0.36, 0.32, 0.28, 'rgba(0,0,0,0.10)', base);
  cup(col + 0.5, row + 0.5, base + UNIT * 0.14 + bob);
}

// Facing vectors. 0 away from the camera / 1 right / 2 toward the camera / 3 left
const FACE = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/*
  Draw the person. Three boxes — body, hood, head — plus a dark outline layer.
  Facing changes three things: body width and depth swap, the hood shifts to the back, and the eyes sit on the side being faced.
  Facing away, the head is drawn before the hood so the hood covers the face — from behind you shouldn't see a face anyway.
*/
function drawBody(col, row, y, h, f, scale = 1) {
  const [fx, fy] = FACE[f];
  const sideways = fx !== 0;
  const bw = (sideways ? 0.46 : 0.54) * scale;
  const bd = (sideways ? 0.54 : 0.46) * scale;

  // A slightly larger dark box underneath; the rim that shows around it is the outline.
  // The world has near-white plaza and near-black road, so any single-colored figure would vanish against one of them.
  box(col - bw / 2 - 0.03, row + 0.5 - bd / 2 - 0.03, bw + 0.06, bd + 0.06, h + 2, C.dark, y - 1);
  box(col - bw / 2, row + 0.5 - bd / 2, bw, bd, h, C.accent, y);        // red hoodie

  const hw = (sideways ? 0.30 : 0.34) * scale;
  const hd = (sideways ? 0.34 : 0.30) * scale;

  // The hood is two pieces: a collar around the neck + the bunched-up part hanging behind.
  // It used to be one big red box covering the whole head, and facing away the figure became a
  // headless red pillar — now the head is always exposed and the hood only says "this is a hoodie".
  box(col - (hw + 0.16) / 2, row + 0.5 - (hd + 0.16) / 2, hw + 0.16, hd + 0.16,
      UNIT * 0.15 * scale, C.accent, y + h);                                  // collar
  box(col - (hw * 0.9) / 2 - fx * 0.14, row + 0.5 - (hd * 0.9) / 2 - fy * 0.14,
      hw * 0.9, hd * 0.9, UNIT * 0.3 * scale, C.accent, y + h);               // the hood behind

  // The head is two pieces: the back of the head (dark hair) + the face (light).
  // This is the single most important detail on the character:
  // this projection only ever shows the top, front and right faces — the left face never appears,
  // so any marking "stuck on the side" disappears when you walk left.
  // Once the face became a whole box two lightness steps off the hair and pushed slightly toward
  // the facing direction, it reads on the top face as a light patch clearly offset to one side — legible in all four directions.
  const headY = y + h + UNIT * 0.12 * scale;
  const headH = UNIT * 0.27 * scale;
  box(col - hw / 2, row + 0.5 - hd / 2, hw, hd, headH, C.hair, headY);

  if (f !== 0) {
    const fw = (fx === 0 ? hw * 0.86 : hw * 0.5);
    const fd = (fx === 0 ? hd * 0.5 : hd * 0.86);
    const fcx = col + fx * (hw / 2 - fw / 2 + 0.06);
    const fcy = row + 0.5 + fy * (hd / 2 - fd / 2 + 0.06);
    box(fcx - fw / 2, fcy - fd / 2, fw, fd, headH * 0.9, C.skin, headY);       // face

    // Both eyes sit on the top face of the face box, toward the outer edge. Visible from above and from the front.
    const eTop = headY + headH * 0.9 - UNIT * 0.015 * scale;
    const e = 0.05 * scale, gap = 0.085 * scale;
    for (const sgn of [-1, 1]) {
      const ex = fx === 0 ? fcx + sgn * gap : fcx + fx * (fw / 2 - e * 0.7);
      const ey = fx === 0 ? fcy + fy * (fd / 2 - e * 0.7) : fcy + sgn * gap;
      box(ex - e / 2, ey - e / 2, e, e, UNIT * 0.045 * scale, C.dark, eTop);
    }
  }
}

/*
  The squirrel. A size larger than the person — a campus squirrel should carry itself like that.
  You recognize it by the big upright tail: three boxes curving up and back.
  f is the direction it faces (+1 right / -1 left); squash does the flattening of "taking a bite".
*/
const SQ = { fur: '#6e6459', fur2: '#857a6d', tail: '#9a8f80', belly: '#dcd2c4' };

function drawSquirrel(cx, row, base, f, squash = 1) {
  const cy = row + 0.5;
  const k = squash;

  tile(cx - 0.85, cy - 0.42, 1.7, 0.84, 'rgba(0,0,0,0.14)', base);

  // Tail: three boxes going up then curving forward, the thickest one on top
  bc(cx - f * 0.72, cy, 0.30, 0.40, UNIT * 0.55 * k, SQ.tail, base);
  bc(cx - f * 0.84, cy, 0.34, 0.42, UNIT * 0.50 * k, SQ.tail, base + UNIT * 0.52 * k);
  bc(cx - f * 0.66, cy, 0.32, 0.40, UNIT * 0.34 * k, SQ.tail, base + UNIT * 0.98 * k);

  bc(cx - f * 0.22, cy, 0.52, 0.5, UNIT * 0.66 * k, SQ.fur, base);        // haunches
  bc(cx + f * 0.12, cy, 0.78, 0.46, UNIT * 0.56 * k, SQ.fur2, base);      // body
  bc(cx + f * 0.30, cy + 0.02, 0.34, 0.34, UNIT * 0.3 * k, SQ.belly, base); // belly

  const hb = base + UNIT * 0.42 * k;
  bc(cx + f * 0.56, cy, 0.44, 0.42, UNIT * 0.44 * k, SQ.fur2, hb);        // head
  bc(cx + f * 0.82, cy, 0.22, 0.28, UNIT * 0.22 * k, SQ.belly, hb + UNIT * 0.06 * k); // snout
  bc(cx + f * 0.46, cy - 0.13, 0.13, 0.11, UNIT * 0.20 * k, SQ.fur, hb + UNIT * 0.42 * k); // ears
  bc(cx + f * 0.46, cy + 0.13, 0.13, 0.11, UNIT * 0.20 * k, SQ.fur, hb + UNIT * 0.42 * k);
  bc(cx + f * 0.70, cy - 0.10, 0.07, 0.07, UNIT * 0.05, C.dark, hb + UNIT * 0.34 * k);   // eyes
  bc(cx + f * 0.70, cy + 0.10, 0.07, 0.07, UNIT * 0.05, C.dark, hb + UNIT * 0.34 * k);

  bc(cx + f * 0.34, cy + 0.2, 0.14, 0.12, UNIT * 0.16, SQ.fur, base);     // front paws
  bc(cx + f * 0.34, cy - 0.2, 0.14, 0.12, UNIT * 0.16, SQ.fur, base);
}

function drawPlayer() {
  const t = player.t;
  // Logically col is a cell index and the cell center is col+0.5 — props, coffee and collision
  // all work off the center, so the person has to be drawn on the center too.
  const col = player.col + 0.5;
  const row = t < 1 ? player.fromRow + (player.toRow - player.fromRow) * t : player.row;

  const lane = laneAt(Math.round(row));
  const onRide = player.ride && t >= 1;
  let base = lane.base;
  if (lane.type === 'trench') base = onRide ? UNIT * 0.22 : 0;

  // The hop arc + the landing squash. That's the whole animation, but without it the game feels stiff.
  const arc = t < 1 ? Math.sin(t * Math.PI) * UNIT * 0.75 : 0;
  const squish = 1 - player.squish * 0.28;
  const h = UNIT * 0.86 * squish;

  if (mode === 'dying') { drawDeath(col, row, base, h); return; }

  tile(col - 0.3, row + 0.2, 0.6, 0.56, 'rgba(0,0,0,0.16)', base);

  // On a win, hop in place a couple of times facing the camera — you made it to class, you can breathe
  const cheer = mode === 'winning' ? Math.abs(Math.sin(winT * 11)) * UNIT * 0.5 : 0;
  const y = base + arc + cheer;
  drawBody(col, row, y, h, mode === 'winning' ? 2 : player.facing);

  // Collected coffee stacks on your head. GOAL cups wins the game, so that's as tall as it ever gets.
  const stack = Math.min(coffee, GOAL);
  for (let i = 0; i < stack; i++) {
    const wobble = t < 1 ? Math.sin(t * Math.PI) * 0.012 * (i + 1) : 0;
    cup(col + wobble, row + 0.47, y + h + UNIT * (0.30 + i * 0.30), 0.92);
  }

  // The shadow that appears overhead when you idle too long — the hint that the squirrel is coming.
  if (player.idle > 9.5) {
    const k = (player.idle - 9.5) / 4.5;
    const rr = 0.55 * (1 - k * 0.55);
    tile(col - rr, row + 0.5 - rr, rr * 2, rr * 2, `rgba(0,0,0,${0.1 + k * 0.35})`, base + 0.5);
  }
}

/*
  Each of the four deaths gets its own animation, all built from translation and scaling only —
  there's no rotation in this renderer, so "tumbling" is faked by swapping the box's width and height back and forth.
*/
function drawDeath(col, row, base, h) {
  const p = clamp(dyingT / DEATH_TIME[deathKind], 0, 1);
  const f = player.facing;

  if (deathKind === 'hit') {
    // Hit by a car: flung along the car's direction, two tumbles in the air, then flattened to paper on landing
    const fly = deathDir * p * 3.4;
    const up = Math.sin(Math.min(p / 0.75, 1) * Math.PI) * UNIT * 2.4;
    const tumble = Math.abs(Math.sin(p * Math.PI * 2.6));
    const flat = p > 0.75 ? (p - 0.75) / 0.25 : 0;
    const bw = 0.54 + tumble * 0.22;
    const bh = Math.max(UNIT * 0.07, h * (1 - tumble * 0.55) * (1 - flat * 0.92));
    tile(col + fly - 0.3, row + 0.2, 0.6, 0.56, `rgba(0,0,0,${0.16 * (1 - up / (UNIT * 3))})`, base);
    box(col + fly - bw / 2, row + 0.25, bw, 0.46, bh, C.accent, base + up);
    return;
  }

  if (deathKind === 'fall' || deathKind === 'carried') {
    // Falling into the trench: sinking and shrinking at once. The nearer row's ground gets drawn
    // over it, so the person is "eaten by the trench" rather than blinking out — the occlusion comes for free.
    const drift = deathKind === 'carried' ? deathDir * p * 1.1 : 0;
    const drop = p * p * UNIT * 2.6;
    const k = 1 - p * 0.45;
    drawBody(col + drift, row, base - drop, h * k, f, k);
    return;
  }

  // Eaten by the squirrel: a giant squirrel darts in from the side, swallows you whole, darts off.
  // Three beats: run in → bite → run off. It bobs while running — the bounce says "it's running" better than the movement does.
  const IN = 0.34, BITE = 0.62;
  const from = deathDir;                     // which side it comes from
  const away = col + from * 10;
  let sx, hop = 0, squash = 1;

  if (p < IN) {
    const t2 = p / IN;
    sx = away + (col - away) * (1 - (1 - t2) * (1 - t2));   // charges in, decelerating
    hop = Math.abs(Math.sin(t2 * 9)) * UNIT * 0.45;
  } else if (p < BITE) {
    const t2 = (p - IN) / (BITE - IN);
    sx = col;
    squash = 1 - Math.sin(t2 * Math.PI) * 0.28;             // ducks down for the bite
  } else {
    const t2 = (p - BITE) / (1 - BITE);
    sx = col + (away - col) * t2 * t2;                      // darts off, accelerating
    hop = Math.abs(Math.sin(t2 * 9)) * UNIT * 0.45;
  }

  // The person cowers in place until the bite lands, and after that they're gone
  if (p < IN + (BITE - IN) * 0.45) {
    const cower = 1 - clamp((p - IN * 0.5) / IN, 0, 1) * 0.25;
    tile(col - 0.3, row + 0.2, 0.6, 0.56, 'rgba(0,0,0,0.16)', base);
    drawBody(col, row, base, h * cower, from > 0 ? 1 : 3, cower);
  }

  // It has to turn around on the way out, or it would scurry off backwards
  drawSquirrel(sx, row, base + hop, p < BITE ? -from : from, squash);
}


/* ⑧ Input --------------------------------------------------- */

const KEYS = {
  ArrowUp: [0, 1], KeyW: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (mode === 'title' || mode === 'over') start();
    return;
  }
  const k = KEYS[e.code];
  if (!k) return;
  e.preventDefault();          // without this the arrow keys scroll the page
  if (mode === 'title') { start(); return; }
  hop(k[0], k[1]);
});

// Touch: a swipe gives a direction, a tap is one step forward.
let touch = null;
const stage = document.querySelector('.stage');

stage.addEventListener('pointerdown', e => {
  touch = { x: e.clientX, y: e.clientY, t: performance.now() };
}, { passive: true });

stage.addEventListener('pointerup', e => {
  if (!touch) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  touch = null;
  if (mode !== 'playing') return;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { hop(0, 1); return; }
  if (Math.abs(dx) > Math.abs(dy)) hop(Math.sign(dx), 0);
  else hop(0, dy < 0 ? 1 : -1);
}, { passive: true });

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));


/* ⑨ Sound / HUD / flow --------------------------------------- */

let audio = null, muted = false;
try { muted = localStorage.getItem('fc-muted') === '1'; } catch (_) { /* throws in private mode */ }

function sfx(kind) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    const now = audio.currentTime;
    if (kind === 'hop')  { o.type = 'square';   o.frequency.setValueAtTime(520, now); o.frequency.exponentialRampToValueAtTime(760, now + 0.06); g.gain.setValueAtTime(0.05, now); }
    if (kind === 'coin') { o.type = 'triangle'; o.frequency.setValueAtTime(880, now); o.frequency.setValueAtTime(1320, now + 0.07); g.gain.setValueAtTime(0.07, now); }
    if (kind === 'die')  { o.type = 'sawtooth'; o.frequency.setValueAtTime(320, now); o.frequency.exponentialRampToValueAtTime(70, now + 0.4); g.gain.setValueAtTime(0.08, now); }
    if (kind === 'win')  { o.type = 'triangle'; [523, 659, 784, 1047].forEach((f, i) => o.frequency.setValueAtTime(f, now + i * 0.11)); g.gain.setValueAtTime(0.08, now); }
    g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'die' ? 0.45 : kind === 'win' ? 0.6 : 0.12));
    o.connect(g); g.connect(audio.destination);
    o.start(now); o.stop(now + 0.5);
  } catch (_) { /* audio failing must never take the game down with it */ }
}

const ui = {
  hud: document.getElementById('hud'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  coffee: document.getElementById('coffee'),
  start: document.getElementById('start'),
  over: document.getElementById('over'),
  cause: document.getElementById('cause'),
  finalScore: document.getElementById('finalScore'),
  finalBest: document.getElementById('finalBest'),
  finalCoffee: document.getElementById('finalCoffee'),
  sound: document.getElementById('sound'),
};

function setScore(v) { ui.score.textContent = v; }

try { best = parseInt(localStorage.getItem('fc-best') || '0', 10) || 0; } catch (_) { best = 0; }
ui.best.textContent = best;

function start() {
  resetGame();
  mode = 'playing';
  ui.start.hidden = true;
  ui.over.hidden = true;
  ui.hud.hidden = false;
  ui.sound.hidden = false;
}

// Loss and win share one panel, swapping only the copy and a data-win — same structure, no reason to write it twice.
function endPanel(eyebrow, isWin) {
  mode = 'over';
  if (player.maxRow > best) {
    best = player.maxRow;
    try { localStorage.setItem('fc-best', String(best)); } catch (_) { /* private mode; live with it */ }
  }
  ui.best.textContent = best;
  ui.cause.textContent = eyebrow;
  ui.finalScore.textContent = player.maxRow;
  ui.finalBest.textContent = best;
  ui.finalCoffee.textContent = coffee;
  ui.over.dataset.win = isWin ? 'true' : 'false';
  ui.over.hidden = false;
}

function gameOver() { endPanel(cause, false); }
function showWin() { endPanel('You made it to class.', true); }

document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('againBtn').addEventListener('click', start);

ui.sound.dataset.muted = String(muted);
ui.sound.addEventListener('click', () => {
  muted = !muted;
  ui.sound.dataset.muted = String(muted);
  try { localStorage.setItem('fc-muted', muted ? '1' : '0'); } catch (_) { /* same as above */ }
});

// Main loop. dt is capped at 1/20 second: when you switch tabs away and back,
// without that clamp the cars teleport dozens of cells in one frame and kill you outright.
let lastT = performance.now();
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

resize();
resetGame();
mode = 'title';
requestAnimationFrame(frame);

})();
