// The static artwork of the square screen's pages, drawn as SVG in design units.
// Coordinates follow the screen UI package (source_scripts/screens_ai.py) and its PNGs.
// (The tall screens' pages are SVG files in art/, exported from their own generator.)

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
    // right: the row, then each slant runs on down-left into a box for its digit
    // (drawn like the station's writing board)
    const x = 830, y = 430, s = 150, run = 64, box = 96;
    [24, 12, 30].forEach((v, i) => lcell(g, x + i * s, y, s, v, { fill: C.cellH, size: 54 }));
    [2, 5, 5, 0].forEach((digit, i) => {
      const x1 = x + i * s, y1 = y + s;                // where the slant leaves the row
      const x2 = x1 - run, y2 = y1 + run;              // the box's top-right corner
      g.append(el("line", { x1, y1, x2, y2, stroke: C.cream, "stroke-width": 3 }));
      g.append(el("rect", { x: x2 - box, y: y2, width: box, height: box, fill: "none", stroke: C.cream, "stroke-width": 3 }));
      text(g, x2 - box / 2, y2 + box / 2, digit, 64, C.accent);
    });
    text(g, 1055, 900, "= 2550", 104);
  },

  yourTurn(g) {
    const x = 590, y = 290, s = 80;
    [3, 8, 6].forEach((d, i) => rod(g, x + i * s, y, s, d));
    arrow(g, 927, 560, 927, 1080, C.accent, 8);
    ["try the", "rods", "below"].forEach((t, i) => text(g, 1208, 705 + i * 79, t, 72, C.grey, { "font-style": "italic" }));
  },

};

// ---------------------------------------------------------------------------
/**
 * The whole static page: background, frame, header, the page's drawing,
 * the footer line under the page dots and the "Ask Napier" label.
 */
export function drawPage({ w, h }, kicker, page) {
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, class: "art", "aria-hidden": "true" });
  defs(svg);
  svg.append(el("rect", { x: 0, y: 0, width: w, height: h, fill: "url(#bg)" }));
  svg.append(el("rect", { x: 34, y: 34, width: w - 68, height: h - 68, fill: "none", stroke: C.grey, "stroke-width": 2 }));
  const g = el("g");
  text(g, w / 2, 95, kicker, 36, C.accent);
  text(g, w / 2, 185, page.title, 104);
  PAGES[page.art](g);
  const yNav = h === 1500 ? 1350 : h - 150;
  text(g, 750, yNav + 40, page.footer, 36, C.grey);
  text(g, 1370, yNav - 113, "Ask Napier", 30, C.accent, { "font-style": "italic" });
  svg.append(g);
  return svg;
}
