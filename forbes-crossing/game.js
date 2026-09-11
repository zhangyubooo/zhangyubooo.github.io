/* ============================================================
   Forbes Crossing
   一个 CMU 校园版的 Crossy Road。纯 JS + canvas 2D，无依赖、无构建。

   文件结构：
     ① 工具函数        ② 画布与投影      ③ 绘图原语（画 3D 盒子）
     ④ 世界生成        ⑤ 玩家            ⑥ 每帧更新
     ⑦ 渲染            ⑧ 输入            ⑨ 声音 / HUD / 流程

   坐标系统：世界坐标是格子。col 向右为正，row 向前（远离镜头）为正。
   屏幕坐标由 ③ 里的 P() 做一次斜投影得到 —— 整个 2.5D 的观感就来自
   这一个函数，别的地方都只是在画平面多边形。
   ============================================================ */

(() => {
'use strict';

/* ① 工具 ---------------------------------------------------- */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick  = arr => arr[randi(0, arr.length - 1)];

// 把 hex 颜色乘一个系数，用来生成盒子侧面的暗色。
// 加缓存是因为每帧要调几百次，重复解析字符串很浪费。
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


/* ② 画布与投影 ---------------------------------------------- */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1, S = 1;
let COL_W, ROW_D, SKEW, UNIT, BASE_H, CX, HORIZON, EDGE;

function resize() {
  // devicePixelRatio：不做这一步，Retina 屏上整个画面是糊的。
  // 上限压到 2，3x 屏上像素翻九倍不值那点清晰度。
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // 横向和纵向分开算，这是这个游戏最重要的一个取舍：
  // 格宽由屏幕宽度定 —— 9 格的活动范围永远占满约 8 成宽度；
  // 行深由屏幕高度定 —— 不管什么屏，往前永远只看得到约 9 行。
  // 如果两者用同一个缩放系数，宽屏上会看到二十多行，画面糊成一片噪点。
  COL_W  = clamp(W / 13.5, 32, 78);
  ROW_D  = clamp(H / 11.5, 32, 80);
  SKEW   = -0.12 * ROW_D;   // 往前一格顺带左移，于是能同时看到顶面和右侧面
  UNIT   = 0.62 * COL_W;    // 一个世界高度单位
  BASE_H = 0.19 * COL_W;    // 草地/人行道比马路高出来的那一截（就是路缘石）
  S = COL_W / 48;

  // 减半格：格中心在 col+0.5，不补这半格整条路会整体偏右半格。
  CX = W * 0.5 - COL_W * 0.5;
  HORIZON = H * 0.72;                        // 玩家所在行落在屏幕 72% 高处
  EDGE = Math.ceil((W * 0.5 + 200) / COL_W) + 2;  // 地面要画到左右多少格才铺满
}

// 核心投影：世界 (col,row) → 屏幕 (x,y)。
// 远处的行往上、往左走，于是同一个盒子能同时看到顶面和右侧面。
function P(col, row) {
  const rr = row - cam.row;
  return { x: CX + col * COL_W + rr * SKEW, y: HORIZON - rr * ROW_D };
}


/* ③ 绘图原语 ------------------------------------------------ */

function poly(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/*
  画一个立方体。这是全局唯一的"3D"函数，车、树、长椅、玩家全是它。
  col,row  盒子近-左角的世界坐标
  w,d      宽（格）、深（格）
  h        高（像素）
  base     离地高度（像素）—— 站在抬高的草地上时用
  color    顶面颜色，侧面自动调暗
*/
function box(col, row, w, d, h, color, base = 0) {
  const A = P(col,     row);
  const B = P(col + w, row);
  const C = P(col + w, row + d);
  const D = P(col,     row + d);
  const b = base, t = base + h;

  const at = p => ({ x: p.x, y: p.y - t });   // 顶面
  const ab = p => ({ x: p.x, y: p.y - b });   // 底面

  const A1 = ab(A), B1 = ab(B), C1 = ab(C);
  const A2 = at(A), B2 = at(B), C2 = at(C), D2 = at(D);

  poly([B1, C1, C2, B2], shade(color, 0.58));  // 右侧面
  poly([A1, B1, B2, A2], shade(color, 0.79));  // 正面
  poly([A2, B2, C2, D2], color);               // 顶面
}

// 贴地的平行四边形，用来画路面、斑马线、影子。
function tile(col, row, w, d, color, base = 0) {
  const A = P(col, row), B = P(col + w, row), C = P(col + w, row + d), D = P(col, row + d);
  poly([
    { x: A.x, y: A.y - base }, { x: B.x, y: B.y - base },
    { x: C.x, y: C.y - base }, { x: D.x, y: D.y - base },
  ], color);
}


/* 调色板：跟主站一样，黑白灰 + 一个 CMU 红 ------------------- */
/*
  四种地面必须一眼分得开，靠的是明度差而不是色相 ——
  整套配色只有黑白灰加一个 CMU 红，和主站是同一套。
  第一版把草地和人行道都做成了浅灰，结果两条道糊在一起，
  玩家分不清脚下是能站的还是会死的。现在拉开成四档明度。
*/
const C = {
  lawn:    '#cdd1c9',   // the Cut：中灰
  lawnAlt: '#c6cbc2',
  walk:    '#e6e5e2',   // 广场铺装：最亮
  walkAlt: '#deddda',
  road:    '#34343a',   // 马路：深
  busway:  '#232327',   // 公交道：更深
  trench:  '#0e0e10',   // 施工沟：几乎全黑
  plate:   '#8d8f93',
  mark:    '#f4f4f2',
  accent:  '#c8102e',   // 只给三样东西：帽衫、61C、咖啡隔热套
  dark:    '#141416',
  skin:    '#f2ede7',
};

// 车。w/d 单位是格，h 单位是 UNIT。
const VEHICLES = [
  { w: 1.75, d: 0.86, h: 0.80, body: '#202022', roof: '#343436' },
  { w: 1.75, d: 0.86, h: 0.80, body: '#f0f0ee', roof: '#d4d4d1' },
  { w: 1.95, d: 0.90, h: 0.95, body: '#8b8d91', roof: '#6f7175' },
  { w: 2.60, d: 0.92, h: 1.15, body: '#f4f4f2', roof: '#dcdcd9', truck: true },
];
// 61C —— 唯一用强调色的车，也是唯一会在专用道上冲过来的东西。
const BUS = { w: 3.6, d: 0.95, h: 1.25, body: C.accent, roof: '#9c0d24', bus: true };


/* ④ 世界生成 ------------------------------------------------ */

const MINC = -4, MAXC = 4;       // 玩家能走的范围：9 格
const LANE_L = -15, LANE_R = 15; // 车辆循环的区间，比屏幕宽一点就够

const lanes = new Map();         // row → lane
let genRow = 0;                  // 已经生成到哪一行
let dangerStreak = 0;            // 连续几行是危险车道，用来防止连出五条马路

function laneAt(row) {
  while (genRow <= row) { lanes.set(genRow, makeLane(genRow)); genRow++; }
  return lanes.get(row);
}

function difficulty(row) { return clamp(row / 160, 0, 1); }

function makeLane(row) {
  // 开局三行一定是安全的人行道，让人先看懂自己是谁。
  if (row < 3) {
    const lane = safeLane(row, 'walk', row === 0 ? 0 : 0.18);
    // 开局正前方一定是通的。否则第一下就撞墙，玩家会以为游戏坏了。
    lane.blocked.delete(0);
    lane.obstacles = lane.obstacles.filter(o => o.col !== 0);
    return lane;
  }

  const d = difficulty(row);
  let type;

  if (dangerStreak >= 3) {
    type = Math.random() < 0.6 ? 'lawn' : 'walk';   // 强制喘口气
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

  // 公交专用道不连着出，两条挨在一起没法反应。
  if (type === 'busway' && lanes.get(row - 1)?.type === 'busway') type = 'road';
  // 前 8 行只出马路。施工沟和 61C 的规则得先给人一点时间学。
  if (row < 8 && (type === 'trench' || type === 'busway')) type = 'road';

  dangerStreak = (type === 'road' || type === 'trench' || type === 'busway')
    ? dangerStreak + 1 : 0;

  if (type === 'road')   return roadLane(row, d);
  if (type === 'trench') return trenchLane(row, d);
  if (type === 'busway') return buswayLane(row, d);
  return safeLane(row, type, 0.20 + 0.10 * d);
}

/* 安全车道：草地（the Cut）或人行道。障碍物既是装饰也是路障。 */
function safeLane(row, kind, density) {
  const lane = {
    type: kind, row, base: BASE_H,
    color: kind === 'lawn' ? (row % 2 ? C.lawn : C.lawnAlt)
                           : (row % 2 ? C.walk : C.walkAlt),
    obstacles: [], blocked: new Set(), coffee: null, entities: [],
  };

  // 边界外侧各种两格树 / 立两个花坛。只要两格：
  // 试过铺六格，整屏都是碎块，反而看不出哪里能走；
  // 也试过做成一整条连续的墙，结果几行叠起来像一道山脊，比树还抢眼。
  for (let i = 1; i <= 2; i++) {
    lane.obstacles.push(makeProp(MINC - i, kind));
    lane.obstacles.push(makeProp(MAXC + i, kind));
  }

  // 界内的障碍物随机撒，但留一条空路 —— 整行堵死就是死局。
  const free = [];
  for (let c = MINC; c <= MAXC; c++) {
    if (Math.random() < density) {
      lane.obstacles.push(makeProp(c, kind));
      lane.blocked.add(c);
    } else free.push(c);
  }
  if (free.length === 0) {                       // 兜底：万一全堵上，挖一格出来
    const c = randi(MINC, MAXC);
    lane.blocked.delete(c);
    lane.obstacles = lane.obstacles.filter(o => o.col !== c);
    free.push(c);
  }

  // 咖啡。放在空格上，纯收集物，捡不捡都不影响输赢。
  if (row > 4 && Math.random() < 0.16) lane.coffee = pick(free);

  return lane;
}

function makeProp(col, kind) {
  if (kind === 'lawn') {
    const big = Math.random() < 0.55;
    return { col, kind: 'tree', h: big ? rand(1.0, 1.6) : rand(0.6, 0.95), w: big ? 0.76 : 0.58 };
  }
  return { col, kind: pick(['bin', 'bench', 'lamp', 'rack']), h: 0, w: 0 };
}

/* 马路：车按固定间距铺满整条车道再整体平移，循环时不会出现空档。 */
function roadLane(row, d) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = rand(2.0, 3.8) * (1 + 0.55 * d);
  const kind = pick(VEHICLES);
  const gap = rand(3.4, 7.0) - 1.6 * d;
  const period = kind.w + Math.max(1.8, gap);
  // 循环长度取 period 的整数倍，否则绕回来的时候间距会突然变。
  const count = Math.ceil((LANE_R - LANE_L) / period);
  const span = count * period;
  const offset = rand(0, period);

  const entities = [];
  for (let i = 0; i < count; i++) {
    entities.push({ x: LANE_L + offset + i * period, kind });
  }
  return { type: 'road', row, base: 0, color: C.road, dir, speed, span, entities, obstacles: [], blocked: new Set(), coffee: null };
}

/* 施工沟：CMU 版的"过河"。钢板就是原木，踩不上去就掉下去。 */
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
    // 工程机械停在钢板上。第一版是停在活动范围之外的路肩上，
    // 结果窄一点的窗口全被裁掉，等于没画。放到板子上就一定在视野里，
    // 而且顺手变成了障碍物：这块板能站，但只能站没被占的那半边。
    if (len >= 3 && Math.random() < 0.42) {
      e.rig = {
        kind: Math.random() < 0.5 ? 'excavator' : 'dumper',
        off: Math.random() < 0.5 ? 0 : len - 2,   // 靠一端停，至少留一格能站
        face: Math.random() < 0.5 ? -1 : 1,
      };
    }
    entities.push(e);
  }

  return { type: 'trench', row, base: 0, color: C.trench, dir, speed, span, entities, obstacles: [], blocked: new Set(), coffee: null };
}

/* 公交专用道：先亮灯警告，再让 61C 全速冲过去。 */
function buswayLane(row, d) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    type: 'busway', row, base: 0, color: C.busway, dir,
    speed: rand(13, 17) + 4 * d,
    warn: rand(0.4, 2.4),          // 剩余警告时间
    x: dir > 0 ? LANE_L : LANE_R,  // 车停在道外等灯
    running: false,
    entities: [], obstacles: [], blocked: new Set(), coffee: null,
  };
}


/* ⑤ 玩家 ---------------------------------------------------- */

const HOP_TIME = 0.13;

const player = {
  col: 0, row: 0,
  fromCol: 0, fromRow: 0, toCol: 0, toRow: 0,
  t: 1,              // 跳跃进度 0→1，等于 1 表示已落地
  facing: 0,         // 0 前 1 右 2 后 3 左
  ride: null,        // 正踩着的钢板
  maxRow: 0,
  idle: 0,
  squish: 0,
};

const cam = { row: 0 };

let mode = 'title';          // title | playing | dying | over
let dyingT = 0, cause = '';
// 死亡动画：种类决定播什么、播多久；deathDir 是被撞飞/被带走的方向
let deathKind = 'hit', deathDir = 1;
const DEATH_TIME = { hit: 0.95, fall: 0.85, carried: 0.95, squirrel: 1.35 };
let queued = null;           // 跳跃中按的下一个方向，落地后立刻执行
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
  coffee = 0; queued = null; dyingT = 0;
  for (let r = -8; r < 24; r++) laneAt(Math.max(r, 0));
  setScore(0);
  ui.coffee.textContent = '0';
}

// 试着往某个方向跳。回不去、撞墙、出界的都在这里被拦掉。
function hop(dx, dy) {
  if (mode !== 'playing') return;
  if (player.t < 1) { queued = [dx, dy]; return; }   // 跳跃中先记下来

  const dest = player.row + dy;
  if (dest < player.maxRow - 4) return;              // 不许无限往回退
  if (dest < 0) return;

  const lane = laneAt(dest);
  // 在钢板上要保留小数偏移，不然横跳一步会被硬拽回整格。
  const baseCol = (lane.type === 'trench' && dy === 0) ? player.col : Math.round(player.col);
  const target = baseCol + dx;

  if (target < MINC || target > MAXC) return;
  if (lane.blocked.has(Math.round(target))) return;
  // 板子上停着机械的那两格过不去。没板子的地方照旧允许跳 —— 那是主动跳进沟里。
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
    // 站上去时对齐到板子上的相对位置，之后跟着板子走。
    player.rideOffset = player.col - p.x;
  } else {
    player.ride = null;
  }

  if (lane.coffee !== null && Math.round(player.col) === lane.coffee) {
    lane.coffee = null;
    coffee++;
    ui.coffee.textContent = coffee;
    sfx('coin');
  }

  if (player.row > player.maxRow) {
    player.maxRow = player.row;
    player.idle = 0;
    setScore(player.maxRow);
  }

  if (queued) { const q = queued; queued = null; hop(q[0], q[1]); }
}

function plateUnder(lane, col) {
  for (const e of lane.entities) {
    if (col >= e.x - 0.5 && col <= e.x + e.len - 0.5) return e;
  }
  return null;
}

// 板子上停着机械的那两格站不了人。判定用人的中心（col + 0.5）。
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
  deathDir = dir;
  sfx('die');
}


/* ⑥ 每帧更新 ------------------------------------------------ */

function update(dt) {
  // 车流和钢板一直在动 —— 标题界面上也动，画面才不是一张死图。
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
  }

  // 镜头跟随。指数平滑：离目标越远追得越快，停下时又不会抖。
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
    // 被钢板带着走。出了边界就是被运走了。
    const lane = laneAt(player.row);
    player.col = player.ride.x + player.rideOffset;
    if (player.col < MINC - 0.7 || player.col > MAXC + 0.7) {
      return die('The steel plate carried you off site.', 'carried', lane.dir);
    }
    if (!plateUnder(lane, player.col)) return die('You went into the trench they never finish.', 'fall');
    void lane;
  }

  player.squish = Math.max(0, player.squish - dt * 6);

  // 站着不动的惩罚。松鼠是 Crossy Road 那只老鹰的 CMU 版本。
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


/* ⑦ 渲染 ---------------------------------------------------- */

function render() {
  // 背景：上白下极浅灰，给远处一点空气感，同时和主站的白底连成一片。
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#f2f2f0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 画多少行由投影反推：正好铺满屏幕，不多画也不留白。
  const ahead  = Math.ceil(HORIZON / ROW_D) + 3;
  const behind = Math.ceil((H - HORIZON) / ROW_D) + 2;
  const first = Math.floor(cam.row) + ahead;
  const last = Math.max(0, Math.floor(cam.row) - behind);
  const playerDrawRow = Math.round(player.t < 1
    ? player.fromRow + (player.toRow - player.fromRow) * player.t
    : player.row);

  // 从远画到近。近的盖住远的，这就是全部的深度排序。
  for (let r = first; r >= last; r--) {
    const lane = laneAt(r);
    drawLane(lane);
    if (r === playerDrawRow) drawPlayer();
  }
}

function drawLane(lane) {
  const r = lane.row;

  if (lane.type === 'lawn' || lane.type === 'walk') {
    // 抬高的地块：一个扁盒子，正面那一截自然形成路缘石。
    box(-EDGE, r, EDGE * 2, 1, lane.base, lane.color);
    if (lane.type === 'walk') {
      for (let c = -EDGE; c < EDGE; c += 1) {
        tile(c + 0.97, r, 0.03, 1, 'rgba(0,0,0,0.055)', lane.base);
      }
    }
  } else {
    tile(-EDGE, r, EDGE * 2, 1, lane.color, 0);
    if (lane.type === 'road') {
      // 车道中线。画在行的中间，一眼能看出车往哪个方向走。
      for (let c = -EDGE; c < EDGE; c += 2) tile(c, r + 0.46, 0.9, 0.08, C.mark);
    } else if (lane.type === 'busway') {
      for (let c = -EDGE; c < EDGE; c += 1.5) tile(c, r + 0.2, 0.7, 0.06, 'rgba(255,255,255,0.34)');
      for (let c = -EDGE; c < EDGE; c += 1.5) tile(c, r + 0.74, 0.7, 0.06, 'rgba(255,255,255,0.34)');
      if (!lane.running) drawWarning(lane);
    } else if (lane.type === 'trench') {
      tile(-EDGE, r + 0.14, EDGE * 2, 0.72, '#0b0b0c');          // 沟底再压暗一层
      // 只在近侧留一道浅色切边，读作混凝土的开口。
      // 试过在整条车道上下都铺黑白斜纹，结果和马路的虚线撞在一起，
      // 远看两种车道一模一样 —— 警示纹改成放在活动范围之外的实体围挡。
      tile(-EDGE, r + 0.9, EDGE * 2, 0.06, '#6e7074');
      // 沟底的钢筋和管线。窄屏上两边的机械会被裁掉，
      // 这两笔是唯一在任何屏幕上都看得到的"这是挖开的沟"的证据。
      for (let c = -EDGE; c < EDGE; c += 0.8) tile(c, r + 0.2, 0.07, 0.6, '#26282c');
      tile(-EDGE, r + 0.5, EDGE * 2, 0.11, '#3d3f44');
      drawBarrier(MINC - 1.7, r);
      drawBarrier(MAXC + 1.3, r);
    }
  }

  if (lane.coffee !== null && lane.coffee !== undefined) drawCoffee(lane.coffee, r, lane.base);

  for (const o of lane.obstacles) drawProp(o, r, lane.base);

  if (lane.type === 'road') {
    // 屏幕外的车不用画。一条道 12 辆车，画一半就够，省一半的多边形。
    for (const e of lane.entities) {
      if (e.x > EDGE + 1 || e.x + e.kind.w < -EDGE - 1) continue;
      drawVehicle(e.x, r, e.kind, lane.dir);
    }
  } else if (lane.type === 'trench') {
    for (const e of lane.entities) {
      if (e.x > EDGE + 1 || e.x + e.len < -EDGE - 1) continue;
      drawPlate(e, r);
    }
  } else if (lane.type === 'busway' && lane.running) {
    drawVehicle(lane.x, r, BUS, lane.dir);
  }
}

function drawWarning(lane) {
  // 灯闪得越快，车来得越近。这是玩家唯一的预警。
  const t = performance.now() / 1000;
  const rate = lane.warn < 1 ? 9 : 3.5;
  const on = Math.sin(t * rate) > 0;
  if (!on) return;
  for (const c of [MINC - 1.4, MAXC + 1.1]) {
    box(c, lane.row + 0.3, 0.4, 0.4, UNIT * 0.85, C.accent);
  }
}

function drawVehicle(x, row, kind, dir) {
  const y = row + (1 - kind.d) / 2;
  const bodyH = UNIT * kind.h * 0.85;
  tile(x - 0.06, y + 0.06, kind.w, kind.d, 'rgba(0,0,0,0.10)');   // 影子
  box(x, y, kind.w, kind.d, bodyH, kind.body);
  // 车顶/车厢，往车尾方向缩一点，看着才有头有尾。
  const roofW = kind.bus ? kind.w * 0.86 : kind.w * 0.52;
  const roofX = dir > 0 ? x + kind.w - roofW - kind.w * 0.08 : x + kind.w * 0.08;
  box(roofX, y + 0.08, roofW, kind.d - 0.16, UNIT * kind.h * 0.5, kind.roof, bodyH);
  // 车头灯：一小块白，顺便告诉你车往哪开。
  const lx = dir > 0 ? x + kind.w - 0.12 : x;
  tile(lx, y + 0.18, 0.12, kind.d - 0.36, '#ffffff', bodyH * 0.55);
}

function drawPlate(e, row) {
  box(e.x, row + 0.08, e.len, 0.84, UNIT * 0.22, C.plate);
  // 板子接缝，让长度看得出来
  for (let i = 1; i < e.len; i++) {
    tile(e.x + i - 0.02, row + 0.08, 0.04, 0.84, shade(C.plate, 0.72), UNIT * 0.22);
  }
  if (e.rig) drawRig(e.rig, e.x + e.rig.off, row, UNIT * 0.22);
}

// 工地围挡。四块黑白相间的小盒子拼成一段，斜纹在纯黑白里也读得出"施工"，
// 不用动强调色 —— 红色留给帽衫、61C 和咖啡。
function drawBarrier(x0, row) {
  for (let i = 0; i < 4; i++) {
    box(x0 + i * 0.25, row + 0.34, 0.25, 0.16, UNIT * 0.32,
        i % 2 ? '#1b1b1d' : '#eeeeec');
  }
  box(x0 - 0.04, row + 0.3, 0.08, 0.24, UNIT * 0.36, '#5c5e62');   // 支腿
  box(x0 + 1.0, row + 0.3, 0.08, 0.24, UNIT * 0.36, '#5c5e62');
}

// 按中心点画盒子。工程机械的零件都是相对机身中心摆的，
// 用左边角算每一块都要自己减一次宽度的一半，很容易错。
function bc(cx, cy, w, d, h, color, base = 0) {
  box(cx - w / 2, cy - d / 2, w, d, h, color, base);
}

/*
  停在沟边的工程机械。全部是装饰：不参与碰撞，也不挡路，
  位置永远在可走的 9 格之外。
  side = +1 停在右边（臂朝左伸进沟里），-1 反之。
*/
/*
  停在钢板上的工程机械。占 2 格 × 1 行，整台都画在这个范围里 ——
  多伸出去一点就会盖到旁边那格能站的板子上，看着像障碍物其实走得过去，
  那是最糟的一种视觉谎言。
  x0 是它占的两格里靠左那格的左边缘，base 是钢板的上表面。
*/
function drawRig(rig, x0, row, base) {
  const cx = x0 + 1;
  const cy = row + 0.5;
  const f = rig.face;   // 车头朝向：+1 右，-1 左

  if (rig.kind === 'excavator') {
    bc(cx, cy, 1.5, 0.7, UNIT * 0.20, '#2c2e33', base);                          // 履带
    bc(cx - f * 0.28, cy, 0.92, 0.6, UNIT * 0.6, '#d2d4cf', base + UNIT * 0.20); // 回转平台 + 驾驶室
    bc(cx - f * 0.62, cy, 0.3, 0.46, UNIT * 0.34, '#4e5054', base + UNIT * 0.20); // 后配重

    // 动臂：三段盒子沿"上去再下来"的折线摆，假装成一根斜的臂。
    // 整套渲染里没有旋转，画不出真正的斜杆 —— 折线是唯一的办法。
    const arm = [[0.34, 0.58, 0.52], [0.66, 0.86, 0.36], [0.90, 0.36, 0.54]];
    for (const [off, up, h] of arm) {
      bc(cx + f * off, cy, 0.26, 0.24, UNIT * h, '#7e807a', base + UNIT * up);
    }
    bc(cx + f * 0.95, cy, 0.4, 0.34, UNIT * 0.26, '#3a3c40', base);              // 铲斗
  } else {
    bc(cx, cy + 0.26, 1.9, 0.18, UNIT * 0.18, '#1d1f22', base);                  // 轮子
    bc(cx, cy, 1.95, 0.6, UNIT * 0.2, '#43454a', base + UNIT * 0.14);            // 底盘
    bc(cx + f * 0.66, cy, 0.62, 0.52, UNIT * 0.58, '#e2e2de', base + UNIT * 0.34); // 驾驶室
    bc(cx - f * 0.38, cy, 1.1, 0.58, UNIT * 0.7, '#33353a', base + UNIT * 0.34);   // 车斗
    bc(cx - f * 0.38, cy, 0.9, 0.44, UNIT * 0.16, '#8e8f88', base + UNIT * 1.04);  // 斗里的土
  }
}

/*
  一杯咖啡。地上那杯和顶在头上的那些是同一个函数 ——
  纸杯是下窄上宽，所以是三段逐渐变宽的盒子加一个盖。
  scale 让头顶那摞可以画小一点。
*/
function cup(cx, cy, y, k = 1) {
  bc(cx, cy, 0.17 * k, 0.16 * k, UNIT * 0.11 * k, '#f7f7f5', y);                       // 杯底
  bc(cx, cy, 0.21 * k, 0.19 * k, UNIT * 0.09 * k, C.accent, y + UNIT * 0.11 * k);      // 隔热套
  bc(cx, cy, 0.23 * k, 0.21 * k, UNIT * 0.07 * k, '#fbfbf9', y + UNIT * 0.20 * k);     // 杯口
  bc(cx, cy, 0.26 * k, 0.24 * k, UNIT * 0.05 * k, '#4a4c50', y + UNIT * 0.27 * k);     // 杯盖
}

function drawProp(o, row, base) {
  const c = o.col;
  // 每个物件底下压一块淡影子。没有它，所有盒子都像浮在半空。
  tile(c + 0.2, row + 0.26, 0.6, 0.54, 'rgba(0,0,0,0.06)', base);

  if (o.kind === 'tree') {
    const h = UNIT * o.h;
    box(c - 0.09 + 0.5, row + 0.42, 0.18, 0.18, UNIT * 0.34, '#8d8f89', base);   // 树干
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

// 朝向向量。0 背对镜头 / 1 右 / 2 面对镜头 / 3 左
const FACE = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/*
  画人。身体、兜帽、头三块盒子，外加一层深色描边。
  朝向影响三件事：身体的长宽互换、兜帽往身后挪、眼睛贴在朝向的那一面。
  背对镜头时先画头再画兜帽，让兜帽把脸盖住 —— 从背后本来就看不到脸。
*/
function drawBody(col, row, y, h, f, scale = 1) {
  const [fx, fy] = FACE[f];
  const sideways = fx !== 0;
  const bw = (sideways ? 0.46 : 0.54) * scale;
  const bd = (sideways ? 0.54 : 0.46) * scale;

  // 略大的深色盒子垫在下面，露出来的一圈就是描边。
  // 世界里既有近白的广场也有近黑的马路，任何单一颜色的人都会在其中一种上消失。
  box(col - bw / 2 - 0.03, row + 0.5 - bd / 2 - 0.03, bw + 0.06, bd + 0.06, h + 2, C.dark, y - 1);
  box(col - bw / 2, row + 0.5 - bd / 2, bw, bd, h, C.accent, y);        // 红帽衫

  const hw = (sideways ? 0.30 : 0.34) * scale;
  const hd = (sideways ? 0.34 : 0.30) * scale;

  // 兜帽分两块：脖子上一圈领口 + 背后垂下来的那一坨。
  // 早先是拿一个大红盒子整个罩住头，背对镜头时人就变成一根没有头的红柱子 ——
  // 现在头永远露在外面，兜帽只负责说明"这是件帽衫"。
  box(col - (hw + 0.16) / 2, row + 0.5 - (hd + 0.16) / 2, hw + 0.16, hd + 0.16,
      UNIT * 0.15 * scale, C.accent, y + h);                                  // 领口
  box(col - (hw * 0.9) / 2 - fx * 0.14, row + 0.5 - (hd * 0.9) / 2 - fy * 0.14,
      hw * 0.9, hd * 0.9, UNIT * 0.3 * scale, C.accent, y + h);               // 背后的帽子

  box(col - hw / 2 + fx * 0.02, row + 0.5 - hd / 2 + fy * 0.02,
      hw, hd, UNIT * 0.26 * scale, C.skin, y + h + UNIT * 0.11 * scale);      // 头

  if (f !== 0) {
    // 眼睛：贴在朝向的那一面。
    const ey = y + h + UNIT * 0.21 * scale;
    if (fx === 0) box(col - hw * 0.34, row + 0.5 + fy * (hd / 2) - 0.02, hw * 0.68, 0.04, UNIT * 0.06 * scale, C.dark, ey);
    else          box(col + fx * (hw / 2) - 0.02, row + 0.5 - hd * 0.34, 0.04, hd * 0.68, UNIT * 0.06 * scale, C.dark, ey);

    // 帽檐：朝朝向的方向探出一小块。
    // 这个投影只看得到顶面、正面和右侧面 —— 左侧面根本不出现，
    // 所以只靠贴在侧面的眼睛，往左走时完全看不出人转过去了。
    // 探出来的这一块会改变顶面的轮廓，四个方向都读得出来。
    const bw2 = fx === 0 ? 0.24 * scale : 0.11 * scale;
    const bd2 = fx === 0 ? 0.11 * scale : 0.24 * scale;
    box(col + fx * (hw / 2 + 0.055) - bw2 / 2,
        row + 0.5 + fy * (hd / 2 + 0.055) - bd2 / 2,
        bw2, bd2, UNIT * 0.11 * scale, C.accent, y + h + UNIT * 0.17 * scale);
  }
}

// 松鼠。只在把人叼走的那一秒出现，所以就是身体 + 大尾巴 + 两只耳朵。
function drawSquirrel(col, row, y) {
  box(col - 0.17, row + 0.4, 0.34, 0.26, UNIT * 0.26, '#4a4c50', y);
  box(col - 0.09, row + 0.62, 0.18, 0.12, UNIT * 0.52, '#5c5e62', y + UNIT * 0.06);  // 尾巴
  box(col - 0.06, row + 0.34, 0.06, 0.06, UNIT * 0.08, '#4a4c50', y + UNIT * 0.26);  // 耳朵
  box(col + 0.02, row + 0.34, 0.06, 0.06, UNIT * 0.08, '#4a4c50', y + UNIT * 0.26);
}

function drawPlayer() {
  const t = player.t;
  // 逻辑上 col 是格号，格中心在 col+0.5 —— 障碍物、咖啡、碰撞判定都按中心算，
  // 所以人也必须画在中心上。
  const col = player.col + 0.5;
  const row = t < 1 ? player.fromRow + (player.toRow - player.fromRow) * t : player.row;

  const lane = laneAt(Math.round(row));
  const onRide = player.ride && t >= 1;
  let base = lane.base;
  if (lane.type === 'trench') base = onRide ? UNIT * 0.22 : 0;

  // 跳跃弧线 + 落地压扁。动画只有这两下，但没有它整个游戏会显得很硬。
  const arc = t < 1 ? Math.sin(t * Math.PI) * UNIT * 0.75 : 0;
  const squish = 1 - player.squish * 0.28;
  const h = UNIT * 0.86 * squish;

  if (mode === 'dying') { drawDeath(col, row, base, h); return; }

  tile(col - 0.3, row + 0.2, 0.6, 0.56, 'rgba(0,0,0,0.16)', base);

  const y = base + arc;
  drawBody(col, row, y, h, player.facing);

  // 收集到的咖啡顶在头上摞起来。最多画 6 杯 —— 再高就挡住前面的车道了，
  // 真实数量以 HUD 为准。
  const stack = Math.min(coffee, 6);
  for (let i = 0; i < stack; i++) {
    const wobble = t < 1 ? Math.sin(t * Math.PI) * 0.012 * (i + 1) : 0;
    cup(col + wobble, row + 0.47, y + h + UNIT * (0.30 + i * 0.30), 0.92);
  }

  // 待太久时头顶出现的阴影，是松鼠要来了的提示。
  if (player.idle > 9.5) {
    const k = (player.idle - 9.5) / 4.5;
    const rr = 0.55 * (1 - k * 0.55);
    tile(col - rr, row + 0.5 - rr, rr * 2, rr * 2, `rgba(0,0,0,${0.1 + k * 0.35})`, base + 0.5);
  }
}

/*
  四种死法各有各的动画。都只用位移和缩放做 —— 这套渲染里没有旋转，
  "翻滚"是靠盒子的宽高来回互换假装出来的。
*/
function drawDeath(col, row, base, h) {
  const p = clamp(dyingT / DEATH_TIME[deathKind], 0, 1);
  const f = player.facing;

  if (deathKind === 'hit') {
    // 被撞飞：顺着车的方向抛出去，空中翻两圈，落地压成一张纸
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
    // 掉进沟里：往下沉、同时缩小。近处那一行的地面会在它上面画，
    // 于是人是"被沟吃掉"的，不是凭空消失的 —— 遮挡关系是免费送的。
    const drift = deathKind === 'carried' ? deathDir * p * 1.1 : 0;
    const drop = p * p * UNIT * 2.6;
    const k = 1 - p * 0.45;
    drawBody(col + drift, row, base - drop, h * k, f, k);
    return;
  }

  // 被松鼠叼走：先被拽起来，再一路带出画面，人在下面荡
  const lift = p * p * UNIT * 7;
  const sway = Math.sin(p * 9) * 0.1 * p;
  tile(col - 0.3, row + 0.2, 0.6, 0.56, `rgba(0,0,0,${0.16 * (1 - p)})`, base);
  drawBody(col + sway, row, base + lift, h, 2, 1 - p * 0.25);
  drawSquirrel(col + sway * 1.3, row, base + lift + h + UNIT * 0.5);
}


/* ⑧ 输入 ---------------------------------------------------- */

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
  e.preventDefault();          // 不拦的话方向键会去滚页面
  if (mode === 'title') { start(); return; }
  hop(k[0], k[1]);
});

// 触屏：滑动给方向，轻点等于往前走一步。
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


/* ⑨ 声音 / HUD / 流程 ---------------------------------------- */

let audio = null, muted = false;
try { muted = localStorage.getItem('fc-muted') === '1'; } catch (_) { /* 隐私模式下会抛 */ }

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
    g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'die' ? 0.45 : 0.12));
    o.connect(g); g.connect(audio.destination);
    o.start(now); o.stop(now + 0.5);
  } catch (_) { /* 声音失败绝不能拖垮游戏 */ }
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

function gameOver() {
  mode = 'over';
  if (player.maxRow > best) {
    best = player.maxRow;
    try { localStorage.setItem('fc-best', String(best)); } catch (_) { /* 无痕模式，忍了 */ }
  }
  ui.best.textContent = best;
  ui.cause.textContent = cause;
  ui.finalScore.textContent = player.maxRow;
  ui.finalBest.textContent = best;
  ui.finalCoffee.textContent = coffee;
  ui.over.hidden = false;
}

document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('againBtn').addEventListener('click', start);

ui.sound.dataset.muted = String(muted);
ui.sound.addEventListener('click', () => {
  muted = !muted;
  ui.sound.dataset.muted = String(muted);
  try { localStorage.setItem('fc-muted', muted ? '1' : '0'); } catch (_) { /* 同上 */ }
});

// 主循环。dt 上限 1/20 秒：切走标签页再切回来时，
// 不这么夹一下，车会一帧之内瞬移几十格直接把你撞死。
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
