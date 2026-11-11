// The static artwork of each screen page, drawn as SVG in design units.
// Coordinates follow the screen UI package (source_scripts/screens_ai.py and
// screens_tall.py) and the exported PNGs.

const NS = "http://www.w3.org/2000/svg";

export const C = {
  bg1: "#1E2430", bg2: "#0E1016",
  cream: "#F0EADC", grey: "#969CA6", accent: "#F0A046",
  cell: "#2A303E", cell2: "#3C4456", cellH: "#604224",
  dimLine: "#464E60", black: "#08090C", floor: "#0A0C10", green: "#2EAA78",
};

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Text centred on (x, y). */
function text(g, x, y, str, size, fill = C.cream, extra = {}) {
  g.append(el("text", { x, y, "font-size": size, fill, class: "t", ...extra }, str));
}

function arrow(g, x1, y1, x2, y2, color, width) {
  g.append(el("line", { x1, y1, x2, y2, stroke: color, "stroke-width": width,
    "marker-end": `url(#arrow-${color === C.accent ? "accent" : "grey"})` }));
}

function defs(svg) {
  const d = el("defs");
  const grad = el("linearGradient", { id: "bg", x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(el("stop", { offset: 0, "stop-color": C.bg1 }), el("stop", { offset: 1, "stop-color": C.bg2 }));
  d.append(grad);
  for (const [name, color] of [["accent", C.accent], ["grey", C.grey]]) {
    const m = el("marker", { id: `arrow-${name}`, viewBox: "0 0 10 10", refX: 6, refY: 5,
      markerWidth: 4.5, markerHeight: 4.5, markerUnits: "strokeWidth", orient: "auto-start-reverse" });
    m.append(el("path", { d: "M0 0 L10 5 L0 10 Z", fill: color }));
    d.append(m);
  }
  svg.append(d);
}

// ---------------------------------------------------------------------------
// Rod pieces
// ---------------------------------------------------------------------------

/** One multiplication square: tens upper-left (blank when 0), units lower-right. */
function lcell(g, x, y, s, val, { fill = C.cell, dim = false, size } = {}) {
  const c = dim ? C.grey : C.cream;
  g.append(el("rect", { x, y, width: s, height: s, fill, stroke: c, "stroke-width": 3 }));
  g.append(el("line", { x1: x, y1: y + s, x2: x + s, y2: y, stroke: c, "stroke-width": 3 }));
  const fs = size || s * 0.36;
  const tens = Math.floor(val / 10), units = val % 10;
  if (tens) text(g, x + s * 0.28, y + s * 0.28, tens, fs, c);
  text(g, x + s * 0.72, y + s * 0.72, units, fs, c);
}

/** A whole rod: the digit on top, then its nine multiples. */
function rod(g, x, y, s, d, { hl = null, dimRows = false } = {}) {
  g.append(el("rect", { x, y, width: s, height: s, fill: C.cell, stroke: C.cream, "stroke-width": 3 }));
  text(g, x + s / 2, y + s / 2, d, s * 0.62);
  for (let r = 1; r <= 9; r++) {
    const on = hl === r;
    lcell(g, x, y + r * s, s, d * r, { fill: on ? C.cellH : C.cell, dim: dimRows && !on });
  }
}

function rowLabels(g, x, y, s, { hl = null, prefix = "", size = 44 } = {}) {
  for (let r = 1; r <= 9; r++) {
    text(g, x, y + r * s + s / 2, `${prefix}${r}`, size, hl === r ? C.accent : C.grey);
  }
}

// ---------------------------------------------------------------------------
// Set 1 · square pages
// ---------------------------------------------------------------------------
const PAGES = {
  blank() {},                       // a page whose content is a live widget (see main.js)

  rodsIntro(g) {
    [[1, 330, 300], [4, 478, 340], [7, 626, 300], [9, 774, 340]].forEach(([d, x, y]) => rod(g, x, y, 78, d));
    text(g, 1100, 630, "multiply with", 66, C.grey, { "font-style": "italic" });
    text(g, 1100, 705, "sticks", 66, C.grey, { "font-style": "italic" });
  },

  oneRod(g) {
    const x = 560, y = 290, s = 95;
    rod(g, x, y, s, 7, { hl: 3 });
    rowLabels(g, 478, y, s, { prefix: "×", hl: 3 });
    arrow(g, x + s + 30, y + 3.5 * s, 830, y + 3.5 * s, C.accent, 6);
    text(g, 1065, 608, "7 × 3", 76);
    text(g, 1065, 693, "= 21", 76);
  },

  lineUp(g) {
    const x = 627, y = 380, s = 82;
    [4, 2, 5].forEach((d, i) => text(g, x + s / 2 + i * s, 330, d, 84, C.accent));
    [4, 2, 5].forEach((d, i) => rod(g, x + i * s, y, s, d));
    rowLabels(g, 562, y, s);
  },

  findRow(g) {
    const x = 627, y = 380, s = 82;
    text(g, 750, 322, "425 × 6", 84);
    [4, 2, 5].forEach((d, i) => rod(g, x + i * s, y, s, d, { hl: 6, dimRows: true }));
    rowLabels(g, 562, y, s, { hl: 6 });
    arrow(g, 905, y + 6.5 * s, 1060, y + 6.5 * s, C.accent, 6);
  },

  diagonals(g) {
    // left, under the chat panel: the rods with row 6
    const x0 = 300, y0 = 330, s0 = 74;
    [4, 2, 5].forEach((d, i) => rod(g, x0 + i * s0, y0, s0, d, { hl: 6, dimRows: true }));
    // right: the row, the slants, the answer
    const x = 830, y = 430, s = 150;
    [24, 12, 30].forEach((v, i) => lcell(g, x + i * s, y, s, v, { fill: C.cellH, size: 54 }));
    [2, 5, 5, 0].forEach((digit, i) => {
      arrow(g, x + 43 + i * s, 595, x + 6 + i * s, 682, C.grey, 4);
      text(g, x + i * s, 765, digit, 84, C.accent);
    });
    text(g, 1055, 930, "= 2550", 104);
  },

  yourTurn(g) {
    const x = 590, y = 290, s = 80;
    [3, 8, 6].forEach((d, i) => rod(g, x + i * s, y, s, d));
    arrow(g, 927, 560, 927, 1080, C.accent, 8);
    ["try the", "rods", "below"].forEach((t, i) => text(g, 1208, 705 + i * 79, t, 72, C.grey, { "font-style": "italic" }));
  },

  // -------------------------------------------------------------------------
  // Set 2 · Promptuarium (screens_tall.py → prompt_steps)
  // -------------------------------------------------------------------------
  promptSteps(g) {
    const xs = [275, 750, 1225], top = 300;
    ["Pick a plate", "Lay it across", "Add the diagonals"].forEach((t, i) => { badge(g, xs[i], top + 20, i + 1); label(g, xs[i], top + 70, t); });

    // step 1: a rack of plates, plate 7 pulled out
    let cx = xs[0];
    g.append(el("line", { x1: cx - 200, y1: 470, x2: cx + 200, y2: 470, stroke: C.grey, "stroke-width": 8 }));
    [6, 7, 8].forEach((d, j) => {
      const off = d === 7 ? 60 : 0, y = 500 + j * 95;
      if (d !== 7) {
        g.append(el("line", { x1: cx - 150, y1: 470, x2: cx - 150, y2: y, stroke: C.grey, "stroke-width": 2 }));
        g.append(el("line", { x1: cx + 150, y1: 470, x2: cx + 150, y2: y, stroke: C.grey, "stroke-width": 2 }));
      }
      plate(g, cx - 170 + off, y + (d === 7 ? 70 : 0), 340, 66, d, d === 7);
    });
    arrow(g, cx + 20, 900, cx + 20, 952, C.accent, 6);
    label(g, cx + 20, 965, "×7", 64, C.accent);

    // step 2: the board, with the plate laid across one row
    cx = xs[1]; const s = 76; let x0 = cx - 2.5 * s;
    const digits = [9, 8, 7, 6, 5];
    digits.forEach((d, i) => digitCell(g, x0 + i * s, 480, s, d));
    for (let r = 0; r < 4; r++) {
      const y = 480 + s + r * s;
      digits.forEach((d, i) => (r === 1 ? lcell(g, x0 + i * s, y, s, d * 7, { fill: C.cellH }) : dimCell(g, x0 + i * s, y, s)));
    }
    g.append(el("rect", { x: x0 - 46, y: 480 + 2 * s - 6, width: 5 * s + 52, height: s + 12, fill: "none", stroke: C.accent, "stroke-width": 6 }));
    g.append(el("rect", { x: x0 - 46, y: 480 + 2 * s - 6, width: 40, height: s + 12, fill: C.black }));
    text(g, x0 - 26, 480 + 2.5 * s, "7", 44, C.accent);
    label(g, cx, 900, "98765 × 7", 40, C.grey);

    // step 3: read the diagonals
    cx = xs[2]; x0 = cx - 2.5 * s; const y = 540;
    digits.forEach((d, i) => lcell(g, x0 + i * s, y, s, d * 7, { fill: C.cellH }));
    [6, 9, 1, 3, 5, 5].forEach((dg, i) => {
      const bx = x0 + i * s, nudge = i < 5 ? 0 : -6;
      arrow(g, bx + nudge, y + s + 14, bx - 12 + nudge, y + s + 62, C.accent, 4);
      text(g, bx - 14, y + s + 112, dg, 58, C.accent);
    });
    label(g, cx, 850, "= 691,355", 76, C.cream, 520);
  },

  // -------------------------------------------------------------------------
  // Set 3 · Location arithmetic (screens_tall.py → loc_steps)
  // -------------------------------------------------------------------------
  locSteps(g) {
    const xs = [275, 750, 1225], top = 300;
    ["Stand on squares", "Now the other arm", "Stand on START"].forEach((t, i) => { badge(g, xs[i], top + 20, i + 1); label(g, xs[i], top + 70, t); });
    const s = 62, W = 5.3 * s;
    [[[8, 1], [], false], [[8, 1], [8, 4], false], [[8, 1], [8, 4], true]].forEach(([rowSel, colSel, start], i) => {
      floorGrid(g, xs[i] - W / 2, 900, s, rowSel, colSel, start);
    });
    label(g, xs[0], 1000, "8 + 1 = 9", 52, C.green);
    label(g, xs[1], 1000, "8 + 4 = 12", 52, C.green);
    label(g, xs[0], 440, "stay 5 seconds", 36, C.grey);
    const cx = xs[2];
    g.append(el("rect", { x: cx - 190, y: 450, width: 380, height: 120, fill: C.black, stroke: C.grey, "stroke-width": 3 }));
    text(g, cx, 510, "9 × 12 = 108", 54);
    const sx = xs[2] - W / 2 + 4 * s + 0.65 * s;
    arrow(g, sx, 880, sx, 612, C.accent, 6);
    label(g, cx, 1000, "the wall multiplies", 40, C.grey);
  },
};

// ---- tall-screen pieces ----------------------------------------------------
function badge(g, cx, cy, n) {
  g.append(el("circle", { cx, cy, r: 34, fill: C.accent }));
  text(g, cx, cy, n, 44, C.bg2, { "font-weight": "bold" });
}
/** A label whose box starts at y (as in the design script): centred at y + 0.75·size. */
function label(g, cx, y, str, size = 46, fill = C.cream) {
  text(g, cx, y + size * 0.75, str, size, fill);
}
function plate(g, x, y, w, h, d, hl) {
  g.append(el("rect", { x, y, width: w, height: h, fill: C.black, stroke: hl ? C.accent : C.grey, "stroke-width": hl ? 4 : 2 }));
  text(g, x + h / 2, y + h / 2, d, h * 0.7, hl ? C.accent : C.cream);
  const n = 5, cw = (w - h) / n;
  for (let i = 0; i < n; i++) {
    const x0 = x + h + i * cw + cw * 0.2, sz = cw * 0.6, y0 = y + h * 0.18, hh = h * 0.64;
    g.append(el("path", { d: `M${x0} ${y0 + hh} L${x0 + sz} ${y0} L${x0 + sz} ${y0 + hh} Z`, fill: C.cell2 }));
  }
}
function dimCell(g, x, y, s) {
  g.append(el("rect", { x, y, width: s, height: s, fill: C.cell, stroke: C.dimLine, "stroke-width": 3 }));
  g.append(el("line", { x1: x, y1: y + s, x2: x + s, y2: y, stroke: C.dimLine, "stroke-width": 3 }));
}
function digitCell(g, x, y, s, d) {
  g.append(el("rect", { x, y, width: s, height: s, fill: C.cell2, stroke: C.cream, "stroke-width": 3 }));
  text(g, x + s / 2, y + s / 2, d, s * 0.6);
}
/** The L-shaped floor: a row 8 4 2 1, START in the corner, a column 1 2 4 8 above it. */
function floorGrid(g, x0, yb, s, rowSel, colSel, start) {
  const cell = (x, y, w, h, v, on) => {
    g.append(el("rect", { x, y, width: w, height: h, fill: on ? C.green : C.floor, stroke: C.cream, "stroke-width": 3 }));
    text(g, x + w / 2, y + h / 2, v, Math.min(w, h) * 0.5);
  };
  [8, 4, 2, 1].forEach((v, i) => cell(x0 + i * s, yb, s, s, v, rowSel.includes(v)));
  const S = 1.3 * s;
  g.append(el("rect", { x: x0 + 4 * s, y: yb, width: S, height: S, fill: start ? C.accent : C.floor, stroke: C.cream, "stroke-width": 3 }));
  text(g, x0 + 4 * s + S / 2, yb + S / 2, "START", s * 0.3, start ? C.bg2 : C.cream, { "font-weight": "bold" });
  [1, 2, 4, 8].forEach((v, j) => cell(x0 + 4 * s, yb - (j + 1) * s, s, s, v, colSel.includes(v)));
}

// ---------------------------------------------------------------------------
/**
 * The whole static page: background, frame, header, the page's drawing,
 * the footer line under the page dots and the "Ask Napier" label.
 */
export function drawPage({ w, h }, kicker, page, { section } = {}) {
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, class: "art", "aria-hidden": "true" });
  defs(svg);
  svg.append(el("rect", { x: 0, y: 0, width: w, height: h, fill: "url(#bg)" }));
  svg.append(el("rect", { x: 34, y: 34, width: w - 68, height: h - 68, fill: "none", stroke: C.grey, "stroke-width": 2 }));
  const g = el("g");
  text(g, w / 2, 95, kicker, 36, C.accent);
  text(g, w / 2, 185, page.title, 104);
  PAGES[page.art](g);
  if (section) {
    g.append(el("line", { x1: 140, y1: 1135, x2: 1360, y2: 1135, stroke: C.grey, "stroke-width": 2 }));
    text(g, w / 2, 1191, section, 38, C.accent);
  }
  const yNav = h === 1500 ? 1350 : h - 150;
  text(g, 750, yNav + 40, page.footer, 36, C.grey);
  text(g, 1370, yNav - 113, "Ask Napier", 30, C.accent, { "font-style": "italic" });
  svg.append(g);
  return svg;
}
