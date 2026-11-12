// Ask Napier — the exhibit screens for "Making Calculation Visible".
//
//   ./                               landing: links to every screen
//   ./?zone=rods&page=3              a rods screen showing page 3 (each of rods 2–7
//                                    shows its own page by default; visitors can page)
//   ./?zone=promptuary               the rod 15 screen
//   ./?zone=location                 the rod 16 screen
//   …&kiosk=1                        as it runs in the exhibit: no "All screens" link,
//                                    and the backend is pinged every 10 minutes

import { ZONES, ZONE_ORDER, SHAPES } from "./zones.js";
import { drawPage } from "./art.js";
import { createChat } from "./chat.js";
import { wake } from "./api.js";

const IDLE_MS = 60_000;           // no touch for this long → "Still there?" (if in use)
const IDLE_COUNTDOWN_S = 10;      // …then back to this screen's default state
const KEEP_AWAKE_MS = 10 * 60_000;
const HINTS = {
  packed: "Double-tap the box to unpack it",
  unpacking: "Unpacking…",
  open: "Drag any piece  ·  double-tap to pack it up",
  packing: "Packing…",
};

const $ = (id) => document.getElementById(id);
const svgCache = new Map();       // tall-screen page SVGs, fetched once
let svgToken = 0;
const params = new URLSearchParams(location.search);
const zone = ZONES[params.get("zone")];
const kiosk = params.get("kiosk") === "1";

if (!zone) showLanding();
else showScreen(zone);

// ---------------------------------------------------------------------------
function showLanding() {
  const sets = [
    ["Set 1 · Rods 2–7", "Touch & Learn", "15″ × 15″ screens"],
    ["Set 2 · Rod 15", "Promptuarium", "17″ × 36″ screen"],
    ["Set 3 · Rod 16", "Location Arithmetic", "17″ × 36″ screen"],
  ];
  ZONE_ORDER.forEach((id, i) => {
    const z = ZONES[id];
    const card = document.createElement("section");
    card.className = "set";
    card.innerHTML = `<p class="set__kicker"></p><h2 class="set__title"></h2><p class="set__size"></p><div class="set__pages"></div>`;
    card.querySelector(".set__kicker").textContent = sets[i][0];
    card.querySelector(".set__title").textContent = sets[i][1];
    card.querySelector(".set__size").textContent = sets[i][2];
    const links = card.querySelector(".set__pages");
    const a = document.createElement("a");
    a.href = `?zone=${id}`;                  // the rods screen opens on page 1
    a.textContent = "Open the screen →";
    links.append(a);
    $("landing-sets").append(card);
  });
  $("landing").hidden = false;
}

// ---------------------------------------------------------------------------
function showScreen(z) {
  document.title = `${z.pages[0].title} · Ask Napier`;
  const screen = $("screen");
  screen.dataset.shape = z.shape;
  screen.dataset.zone = z.id;
  if (kiosk) $("back").hidden = true;
  $("stage").hidden = false;

  const tall = z.shape === "tall";
  const defaultPage = clampPage(Number(params.get("page") || 1) - 1, z);
  let page = -1;
  const chat = createChat(z, { modal: tall, getPage: () => page + 1 });

  // --- pages ---
  const dots = $("dots");
  if (z.pages.length > 1) {
    $("pager").hidden = false;
    z.pages.forEach((p, n) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "pager__dot";
      dot.setAttribute("aria-label", `Page ${n + 1}: ${p.title}`);
      dot.addEventListener("click", () => goTo(n));
      dots.append(dot);
    });
    // the square screen loops round; the tall screens stop at the first and last page
    const step = (d) => {
      const n = z.pages.length, to = page + d;
      if (tall) { if (to >= 0 && to < n) goTo(to); } else goTo((to + n) % n);
    };
    $("prev").addEventListener("click", () => step(-1));
    $("next").addEventListener("click", () => step(1));
    watchSwipe(screen, step);
  }

  // --- tall screens: the hint bubble asks this page's question ---
  const presetFor = (p) => z.presets.find((q) => q.id === p.ask);
  if (tall) {
    $("hint").hidden = false;
    $("pager-footer").hidden = false;
    $("hint").addEventListener("click", () => chat.askPreset(presetFor(z.pages[page])));
  }

  // A page can carry a live widget over its artwork (page 7: the 3D model of the set).
  let widget = null, widgetToken = 0;
  async function mountWidget(p) {
    widget?.dispose();
    widget = null;
    const token = ++widgetToken;
    const box = $("widget");
    box.replaceChildren();
    box.hidden = !p.widget;
    $("widget-hint").hidden = !p.widget;
    if (!p.widget) return;
    const hint = $("widget-hint");
    hint.textContent = "Opening the box…";
    try {
      const { mountRodBox } = await import("./rodbox.js");
      const w = await mountRodBox(box, {
        onStateChange: (s) => { hint.textContent = HINTS[s]; },
      });
      if (token !== widgetToken) { w.dispose(); return; }
      widget = w;
      hint.textContent = HINTS.packed;
    } catch (err) {
      console.error(err);
      if (token === widgetToken) hint.textContent = "The model of the set could not be loaded.";
    }
  }

  function goTo(n, { force = false } = {}) {
    if (n === page && !force) return;
    page = n;
    const p = z.pages[n];
    if (p.svg) showSvg(p.svg);
    else $("art").replaceChildren(drawPage(SHAPES[z.shape], z.kicker, p));
    mountWidget(p);
    [...dots.children].forEach((d, i) => d.setAttribute("aria-current", String(i === n)));
    $("prev").classList.toggle("is-off", tall && n === 0);
    $("next").classList.toggle("is-off", tall && n === z.pages.length - 1);
    if (tall) {
      $("pager-footer").textContent = `${n + 1} / ${z.pages.length}   ·   tap the arrows`;
      $("hint-q").textContent = `“${presetFor(p)?.question || ""}”`;
      chat.setContext(p.title);
    }
    // The chat stays closed until the avatar is tapped. On the square screen a page's
    // example conversation is ready inside it — unless a visitor is already talking.
    if (!tall && !chat.live) chat.start(p.seed || []);
  }

  function startOver() {
    chat.start(tall ? [] : z.pages[defaultPage].seed || []);
    goTo(defaultPage, { force: true });
  }

  startOver();

  // --- is the AI awake? ---
  const status = $("chat-status");
  const setOnline = (on) => {
    screen.classList.toggle("is-online", on);
    status.textContent = on ? "AI  ·  online" : "AI  ·  waking…";
  };
  const ping = () => wake().then(() => setOnline(true), () => setOnline(false));
  ping();
  setInterval(ping, kiosk ? KEEP_AWAKE_MS : 5 * KEEP_AWAKE_MS);

  // --- idle: a shared screen must not show one visitor's conversation to the next ---
  const isDirty = () => chat.live || chat.open || page !== defaultPage || Boolean(widget?.dirty);
  watchIdle({ isDirty, isBusy: () => chat.busy, startOver });
}

// Tall-screen pages are SVG files exported from the design's own generator.
async function showSvg(url) {
  const token = ++svgToken;
  if (!svgCache.has(url)) svgCache.set(url, fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(url)))));
  try {
    const text = await svgCache.get(url);
    if (token !== svgToken) return;
    const art = $("art");
    art.innerHTML = text;
    art.firstElementChild?.setAttribute("aria-hidden", "true");
  } catch (err) {
    svgCache.delete(url);
    console.error("Could not load", url, err);
  }
}

/** Swipe left/right on the page to turn it (not on the chat, the buttons or the 3D model). */
function watchSwipe(screen, step) {
  let start = null;
  screen.addEventListener("pointerdown", (e) => {
    start = e.target.closest(".chat, .chat-backdrop, button, input, .screen__widget") ? null
      : { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  screen.addEventListener("pointerup", (e) => {
    if (!start) return;
    const unit = screen.getBoundingClientRect().width / 1500;
    const dx = (e.clientX - start.x) / unit, dy = (e.clientY - start.y) / unit;
    if (Math.abs(dx) > 150 && Math.abs(dx) > 1.5 * Math.abs(dy) && performance.now() - start.t < 900) step(dx < 0 ? 1 : -1);
    start = null;
  });
  screen.addEventListener("pointercancel", () => { start = null; });
}

function clampPage(n, z) {
  return Number.isInteger(n) && n >= 0 && n < z.pages.length ? n : 0;
}

// ---------------------------------------------------------------------------
function watchIdle({ isDirty, isBusy, startOver }) {
  const overlay = $("idle"), count = $("idle-count");
  let idleTimer = null, countdown = null;

  function stopCountdown() { clearInterval(countdown); countdown = null; overlay.hidden = true; }

  function arm() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!isDirty()) return;
      if (isBusy()) { arm(); return; }        // still waiting for Napier: don't interrupt
      let left = IDLE_COUNTDOWN_S;
      count.textContent = left;
      overlay.hidden = false;
      countdown = setInterval(() => {
        left -= 1;
        count.textContent = left;
        if (left <= 0) { stopCountdown(); document.activeElement?.blur(); startOver(); }
      }, 1000);
    }, IDLE_MS);
  }

  function activity() { if (countdown) stopCountdown(); arm(); }
  for (const type of ["pointerdown", "keydown", "input", "wheel"]) document.addEventListener(type, activity, { passive: true });
  $("idle-stay").addEventListener("click", activity);
  arm();
}
