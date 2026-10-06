// main.js — connects the pieces: rods ↔ backend ↔ inscription.
//
// The page is always in one of these moments:
//   idle      nothing chosen; the plaque invites you to pick a rod
//   selected  a rod is lifted; the plaque shows its question + "Present the rod"
//   asking    waiting for Napier (the portrait dims, the candle brightens)
//   answered  the inscription is painted; the rod joins the box
//   error     something failed; the plaque explains and offers "Try again"

import { CARDS, cardById, MEMORY_CARD } from "./cards.js";
import { getVisitorId, resetVisitor, wake, loadBox, presentRod } from "./api.js";
import { writeInscription, clearInscriptions } from "./inscription.js";
import { renderTray, renderBox } from "./rods.js";

// ---------------------------------------------------------------------------
// 1. Elements and state
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  status: $("status"),
  portrait: $("portrait"), portraitImg: $("portrait-img"),
  inscription: $("inscription"), ghosts: $("ghosts"),
  plaque: $("plaque"), eyebrow: $("plaque-eyebrow"), plaqueText: $("plaque-text"),
  presentBtn: $("present-btn"), retryBtn: $("retry-btn"),
  tray: $("tray"), trayCount: $("tray-count"),
  box: $("box"), boxCount: $("box-count"), boxNote: $("box-note"),
  reading: $("reading"), newVisitor: $("new-visitor"),
  bindBtn: $("bind-btn"), pack: $("pack"), packStage: $("pack-stage"), packText: $("pack-text"),
  packReplay: $("pack-replay"), skip: $("skip"),
};

const state = {
  selected: null,   // card id of the lifted rod, or null
  busy: false,      // true while waiting for Napier
  rods: [],         // this visitor's box: [{card, inscription, motto}], oldest first
  counts: {},       // {"4": 12} — how many visitors have asked each rod
  skipped: false,   // true after "Skip experience": empty places hold unanswered rods
};

const GREETING_FIRST = "Good visitor, choose a rod and present it to me. I shall answer you in paint.";
const GREETING_BACK = "Ah, you return. Your rods are where you left them, and I have not forgotten you.";

// ---------------------------------------------------------------------------
// 2. Drawing helpers
// ---------------------------------------------------------------------------
function answeredIds() {
  return new Set(state.rods.map((rod) => rod.card));
}

function drawRods(justAdded = null) {
  const inTray = renderTray(el.tray, answeredIds(), state.selected, selectRod);
  const inBox = renderBox(el.box, state.rods, openReading, justAdded);
  el.trayCount.textContent = inTray ? `· ${inTray} to ask` : "· all presented";
  el.boxCount.textContent = inBox ? `· ${inBox} of ${CARDS.length}` : "";

  // A full box can be packed into the real case.
  el.bindBtn.hidden = !isComplete();
  if (!isComplete()) closePacking();
}

function isComplete() {
  return answeredIds().size === CARDS.length;
}

function setPlaque({ eyebrow = "Napier's Rod Box", text, present = false, retry = false }) {
  el.eyebrow.textContent = eyebrow;
  el.plaqueText.textContent = text;
  el.presentBtn.hidden = !present;
  el.retryBtn.hidden = !retry;
}

/** On a phone the painting scrolls out of view; bring the inscription tablet back for the answer. */
function showPortrait() {
  const tablet = el.portrait.querySelector(".tablet");
  const box = tablet.getBoundingClientRect();
  if (box.top < 0 || box.bottom > window.innerHeight) {
    tablet.scrollIntoView({ behavior: "smooth", block: "end" });
  }
}

// ---------------------------------------------------------------------------
// 2b. The finale: packing the set (WebGL, loaded only when it's needed)
// ---------------------------------------------------------------------------
let packing = null;   // the running animation, if any

async function openPacking() {
  el.pack.hidden = false;
  el.pack.scrollIntoView({ behavior: "smooth", block: "start" });
  if (packing) { packing.replay(); el.packReplay.hidden = true; return; }
  try {
    const { startPacking } = await import("./packing.js");   // three.js is ~550 KB, so load it late
    packing = await startPacking(el.packStage, {
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onDone: () => { el.packReplay.hidden = false; },
    });
  } catch (err) {
    console.error(err);
    el.packStage.replaceChildren();
    el.packText.textContent = "This browser could not draw the 3D case (WebGL is unavailable), but your sixteen rods are safe in the box above.";
  }
}

function closePacking() {
  packing?.dispose();
  packing = null;
  el.pack.hidden = true;
  el.packReplay.hidden = true;
}

// ---------------------------------------------------------------------------
// 3. Choosing and presenting a rod
// ---------------------------------------------------------------------------
function selectRod(card) {
  if (state.busy) return;
  state.selected = card.id;
  drawRods();
  setPlaque({
    eyebrow: `Rod ${card.numeral} · ${card.group}`,
    text: card.question,
    present: true,
  });
}

async function present() {
  const card = cardById(state.selected);
  if (!card || state.busy) return;

  state.busy = true;
  el.portrait.classList.add("is-thinking");
  el.tray.querySelector(`[data-card="${card.id}"]`)?.classList.add("is-presented");
  setPlaque({ eyebrow: `Rod ${card.numeral}`, text: "Napier is reading your rod…" });
  showPortrait();

  // If the server was asleep this can take a while — say so instead of looking frozen.
  const slowTimer = setTimeout(() => {
    setPlaque({ eyebrow: `Rod ${card.numeral}`, text: "He has slept four hundred years. Waking him can take up to a minute…" });
  }, 6000);

  try {
    const answer = await presentRod(card.id);
    clearTimeout(slowTimer);
    el.portrait.classList.remove("is-thinking");

    // Update memory first, so the box is right even if the animation is skipped.
    state.rods = state.rods.filter((rod) => rod.card !== answer.card)
      .concat({ card: answer.card, inscription: answer.inscription, motto: answer.motto });
    if (answer.count) state.counts[answer.card] = answer.count;
    if (answer.saved !== false) el.boxNote.hidden = true;  // the box works after all
    state.selected = null;

    await writeInscription(el.inscription, el.ghosts, answer.inscription);
    drawRods(answer.card);
    // Wide screens: make sure the rod is seen landing in the box.
    if (window.matchMedia("(min-width: 900px)").matches) {
      el.box.querySelector(".is-arriving")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    let text = answer.repeat
      ? "That rod was already in your box. Napier repeats himself, as old men do."
      : `Rod ${card.numeral} now rests in your box.${answeredIds().size < CARDS.length - 1 ? " Choose another." : ""}`;
    if (isComplete() && !answer.repeat) text = "Your box is full — all sixteen rods. Press “Pack the set” below the box.";
    else if (answeredIds().size === CARDS.length - 1 && !answeredIds().has(MEMORY_CARD)) {
      text += " One rod remains: the last, and Napier's memory of you.";
    }
    if (answer.saved === false) text += " (Napier answered, but the box could not be saved this time.)";
    setPlaque({ eyebrow: `“${answer.motto}”`, text });
  } catch (err) {
    clearTimeout(slowTimer);
    el.portrait.classList.remove("is-thinking");
    drawRods(); // put the rod back down in the tray
    setPlaque({ eyebrow: `Rod ${card.numeral}`, text: err.message, retry: true });
  } finally {
    state.busy = false;
  }
}

// ---------------------------------------------------------------------------
// 4. Reading a rod from the box
// ---------------------------------------------------------------------------
function openReading(card, saved) {
  $("reading-numeral").textContent = `Rod ${card.numeral} · ${card.group}`;
  $("reading-title").textContent = card.question;
  $("reading-inscription").textContent = saved.inscription;
  $("reading-motto").textContent = saved.motto ? `“${saved.motto}”` : "";
  const count = state.counts[card.id];
  $("reading-count").textContent = count > 1
    ? `${count} visitors have presented this rod.`
    : count === 1 ? "You are the first to present this rod." : "";
  el.reading.showModal();
}

// Clicking the dark backdrop around the dialog closes it too.
el.reading.addEventListener("click", (event) => {
  if (event.target === el.reading) el.reading.close();
});

// ---------------------------------------------------------------------------
// 5. Opening the box when the page loads (and for a new visitor)
// ---------------------------------------------------------------------------
async function openBox() {
  el.boxNote.hidden = true;
  try {
    const data = await loadBox();
    state.rods = data.rods;
    state.counts = data.counts;
    if (state.skipped) fillSkipped();   // the box arrived after a skip: keep the box full
    drawRods();
    if (state.rods.length && !state.busy) {
      writeInscription(el.inscription, el.ghosts, GREETING_BACK);
    }
  } catch (err) {
    el.boxNote.textContent = `Your box could not be opened just now (${err.message}) Rods you present may not be remembered.`;
    el.boxNote.hidden = false;
  }
}

let confirmTimer = null;
el.newVisitor.addEventListener("click", () => {
  if (state.busy) return;
  // Two clicks needed, so nobody empties their box by accident.
  if (!confirmTimer) {
    el.newVisitor.textContent = "Click again to empty your box";
    el.newVisitor.classList.add("is-confirming");
    confirmTimer = setTimeout(() => {
      el.newVisitor.textContent = "Begin as a new visitor";
      el.newVisitor.classList.remove("is-confirming");
      confirmTimer = null;
    }, 3000);
    return;
  }
  clearTimeout(confirmTimer);
  confirmTimer = null;
  el.newVisitor.textContent = "Begin as a new visitor";
  el.newVisitor.classList.remove("is-confirming");
  resetVisitor();
  getVisitorId(); // make the new id now
  state.rods = [];
  state.counts = {};
  state.selected = null;
  state.skipped = false;
  clearInscriptions(el.inscription, el.ghosts);
  drawRods();
  setPlaque({ text: "A new visitor. Choose a rod and present it to Napier." });
  writeInscription(el.inscription, el.ghosts, GREETING_FIRST);
  openBox();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------------------------------------------------------------------------
// 5b. Skip experience (for reviewers and demos): fill every empty place in the
//     box with an unanswered rod and go straight to the packing. Nothing is
//     sent to the server, so reloading the page shows the real box again.
// ---------------------------------------------------------------------------
const SKIPPED_TEXT = "You skipped ahead, so Napier has not answered this rod yet. Begin as a new visitor to present it properly.";

function fillSkipped() {
  const have = answeredIds();
  const blanks = CARDS
    .filter((card) => !have.has(card.id))
    .map((card) => ({ card: card.id, inscription: SKIPPED_TEXT, motto: "", skipped: true }));
  state.rods = state.rods.concat(blanks);
}

el.skip.addEventListener("click", () => {
  if (state.busy) return;
  state.skipped = true;
  state.selected = null;
  fillSkipped();
  drawRods();
  setPlaque({ eyebrow: "Skipped ahead", text: "All sixteen rods are in your box. The ones you didn't present stay unanswered." });
  openPacking();
});

// ---------------------------------------------------------------------------
// 6. Start
// ---------------------------------------------------------------------------
el.presentBtn.addEventListener("click", present);
el.bindBtn.addEventListener("click", openPacking);
el.packReplay.addEventListener("click", () => { packing?.replay(); el.packReplay.hidden = true; });
el.retryBtn.addEventListener("click", present);
el.portraitImg.addEventListener("error", () => el.portrait.classList.add("no-image"));
if (el.portraitImg.complete && el.portraitImg.naturalWidth === 0) el.portrait.classList.add("no-image");

drawRods();
writeInscription(el.inscription, el.ghosts, GREETING_FIRST);

wake()
  .then(() => { el.status.textContent = "The portrait is awake"; el.status.classList.add("is-awake"); })
  .catch(() => { el.status.textContent = "The portrait is asleep — answers may be slow"; });

openBox();
