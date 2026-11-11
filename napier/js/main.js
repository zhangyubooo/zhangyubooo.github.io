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
const params = new URLSearchParams(location.search);
const zone = ZONES[params.get("zone")];
const kiosk = params.get("kiosk") === "1";

if (!zone) showLanding();
else showScreen(zone);

// ---------------------------------------------------------------------------
function showLanding() {
  const sets = [
    ["Set 1 · Rods 2–7", "Touch & Learn", "six 15″ × 15″ screens, one page each"],
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
    if (z.pages.length > 1) {
      z.pages.forEach((p, n) => {
        const a = document.createElement("a");
        a.href = `?zone=${id}&page=${n + 1}`;
        a.textContent = `p${n + 1}`;
        a.title = p.title;
        links.append(a);
      });
    } else {
      const a = document.createElement("a");
      a.href = `?zone=${id}`;
      a.textContent = "Open the screen →";
      links.append(a);
    }
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

  const inline = z.shape === "tall";
  const chat = createChat(z, { inline });
  const defaultPage = clampPage(Number(params.get("page") || 1) - 1, z);
  let page = -1;

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
    $("prev").addEventListener("click", () => goTo((page - 1 + z.pages.length) % z.pages.length));
    $("next").addEventListener("click", () => goTo((page + 1) % z.pages.length));
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
    $("art").replaceChildren(drawPage(SHAPES[z.shape], z.kicker, p, { section: z.section }));
    mountWidget(p);
    [...dots.children].forEach((d, i) => d.setAttribute("aria-current", String(i === n)));
    // A page with a conversation in its design starts with it open — unless a
    // visitor is already talking to Napier, in which case the talk carries on.
    if (!inline && !chat.live) chat.start(p.seed || [], { openNow: Boolean(p.seed) });
  }

  function startOver() {
    if (inline) chat.start(z.seed);
    goTo(defaultPage, { force: true });
    if (!inline) chat.start(z.pages[defaultPage].seed || [], { openNow: Boolean(z.pages[defaultPage].seed) });
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
  const isDirty = () => chat.live || page !== defaultPage || Boolean(widget?.dirty)
    || chat.open !== (inline || Boolean(z.pages[page].seed));
  watchIdle({ isDirty, isBusy: () => chat.busy, startOver });
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
