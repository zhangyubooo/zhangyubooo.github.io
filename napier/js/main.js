// Ask Napier — the last portrait. The exhibit's final station: a screen showing
// Napier's 1616 portrait and six numbered question rods, and a keyboard on a writing
// desk in front of it. The visitor presses a rod's number or types a question of their
// own; Napier writes back, letter by letter, and the conversation builds up beside the
// painting like an exchange of letters. No touch screen, no mouse.
//
//   1–6    ask that rod's question (when nothing has been typed yet)
//   Enter  send what you typed          Esc  clear the line / start over
//
//   ./            the station
//   ./?kiosk=1    in the gallery: no link back to the portfolio, no mouse pointer,
//                 backend pinged every 10 minutes

import { QUESTIONS, GREETING, RESTING } from "./questions.js";
import { askNapier, wake } from "./api.js";
import { writeInscription } from "./inscription.js";
import { startDust } from "./dust.js";

const MAX_CHARS = 200;            // same cap as the backend
const HISTORY_TURNS = 6;          // earlier questions and answers sent back for context
const LOG_KEEP = 12;              // messages kept on screen; older ones have scrolled away
const IDLE_MS = 75_000;           // no key for this long → "Still there?"
const IDLE_COUNTDOWN_S = 10;
const KEEP_AWAKE_MS = 10 * 60_000;
const WAKING_HINT_MS = 6000;
const PLACEHOLDER_MS = 4500;

const $ = (id) => document.getElementById(id);
const el = {
  frame: $("frame"), log: $("log"), status: $("status"), tray: $("tray"),
  pen: $("pen"), input: $("pen-input"), placeholder: $("pen-placeholder"), count: $("pen-count"),
};
const kiosk = new URLSearchParams(location.search).get("kiosk") === "1";
if (kiosk) document.body.classList.add("is-kiosk");

const state = {
  busy: false,
  history: [],          // [{ role: "visitor" | "napier", text }]
  generation: 0,        // bumps on start over, so a late answer is dropped
};

// ---------------------------------------------------------------------------
// 1. The question rods
// ---------------------------------------------------------------------------
const rods = new Map();           // key "1"–"6" → { q, node }
for (const q of QUESTIONS) {
  const li = document.createElement("li");
  li.className = "rod";
  li.innerHTML = `<span class="rod__key" aria-hidden="true"></span><span class="rod__q"></span>`;
  li.querySelector(".rod__key").textContent = q.key;
  li.querySelector(".rod__q").textContent = q.question;
  li.setAttribute("aria-label", `Press ${q.key}: ${q.question}`);
  el.tray.append(li);
  rods.set(q.key, { q, node: li });
}

function pressRod(key) {
  const rod = rods.get(key);
  if (!rod || state.busy) return;
  for (const { node } of rods.values()) node.classList.remove("is-chosen");
  rod.node.classList.add("is-chosen", "is-asked");
  send(rod.q);
}

// ---------------------------------------------------------------------------
// 2. The conversation on screen
// ---------------------------------------------------------------------------
function addLine(role, text = "") {
  const line = document.createElement("div");
  line.className = `line line--${role}`;
  line.innerHTML = `<span class="line__who"></span><p class="line__text"></p>`;
  line.querySelector(".line__who").textContent = role === "napier" ? "Napier" : "You";
  line.querySelector(".line__text").textContent = text;
  el.log.append(line);
  while (el.log.children.length > LOG_KEEP) el.log.firstElementChild.remove();
  el.log.scrollTop = el.log.scrollHeight;
  return line;
}

/** Napier's reply surfaces letter by letter (inscription.js), keeping the log scrolled down. */
async function napierWrites(line, text, note = "") {
  line.classList.remove("is-writing");
  const p = line.querySelector(".line__text");
  const follow = setInterval(() => { el.log.scrollTop = el.log.scrollHeight; }, 120);
  await writeInscription(p, null, text);
  clearInterval(follow);
  if (note) {
    const small = document.createElement("span");
    small.className = "line__note";
    small.textContent = note;
    line.append(small);
  }
  el.log.scrollTop = el.log.scrollHeight;
}

// ---------------------------------------------------------------------------
// 3. Asking
// ---------------------------------------------------------------------------
/** Offline: answer from Napier's notes, choosing the suggested question nearest to the typed one. */
function fromNotes(text, preset) {
  if (preset) return preset.fallback;
  const lower = text.toLowerCase();
  const match = QUESTIONS.find((q) => q.keywords.some((k) => new RegExp(`\\b${k}`).test(lower)));
  return match ? match.fallback : RESTING;
}

/** Ask a rod's question (preset) or what was typed in the writing line. */
async function send(preset = null) {
  const question = preset ? preset.question : el.input.value.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!question || state.busy) return;
  if (!preset) {
    setLine("");
    for (const { node } of rods.values()) node.classList.remove("is-chosen");
  }

  const mine = ++state.generation;
  state.busy = true;
  el.pen.classList.add("is-waiting");
  el.frame.classList.add("is-thinking");
  const asked = addLine("visitor", question);
  if (preset) asked.querySelector(".line__who").textContent = `Rod ${preset.key}`;
  const answer = addLine("napier");
  answer.classList.add("is-writing");
  const hint = setTimeout(() => { el.status.textContent = "Napier is waking. The first answer can take up to a minute."; }, WAKING_HINT_MS);

  let reply, note = "";
  try {
    const history = state.history.slice(-HISTORY_TURNS);
    ({ reply } = await askNapier(preset
      ? { zone: "portrait", preset: preset.id, history }
      : { zone: "portrait", question, history }));
    setAwake(true);
  } catch (err) {
    if (err.offline) { reply = fromNotes(question, preset); note = "From Napier’s notes: the live portrait is resting."; setAwake(false); }
    else reply = err.message;
  } finally {
    clearTimeout(hint);
  }
  if (mine !== state.generation) return;

  el.frame.classList.remove("is-thinking");
  state.history.push({ role: "visitor", text: question }, { role: "napier", text: reply });
  await napierWrites(answer, reply, note);
  if (mine !== state.generation) return;
  state.busy = false;
  el.pen.classList.remove("is-waiting");
}

// ---------------------------------------------------------------------------
// 4. The keyboard: number keys pick a rod, everything else goes to the writing line
// ---------------------------------------------------------------------------
function setLine(text) {
  el.input.value = text;
  onInput();
}

function onInput() {
  const text = el.input.value;
  el.placeholder.hidden = text.length > 0;
  const left = MAX_CHARS - text.length;
  el.count.textContent = left <= 40 ? `${left}` : "";
  el.input.style.height = "auto";                     // grow to a second line if needed
  el.input.style.height = `${el.input.scrollHeight}px`;
}
el.input.addEventListener("input", onInput);

el.input.addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) return;    // Chinese / Japanese input method at work
  if (rods.has(e.key) && !el.input.value.trim() && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();                                // a digit on an empty line chooses a rod;
    pressRod(e.key);                                   // once typing has begun, digits are just digits
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (!e.shiftKey) send();
  } else if (e.key === "Tab") {
    e.preventDefault();                                // keep focus on the writing line
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (el.input.value) setLine(""); else if (state.history.length || state.busy) startOver();
  }
});
el.pen.addEventListener("submit", (e) => { e.preventDefault(); send(); });
// (A rod can't be clicked: in the gallery there is only the keyboard.)

// Keep the writing line focused: a visitor never has to click anything.
const focusLine = () => { if (document.activeElement !== el.input) el.input.focus({ preventScroll: true }); };
el.input.addEventListener("blur", () => setTimeout(focusLine, 0));
document.addEventListener("pointerdown", (e) => { e.preventDefault(); focusLine(); });
window.addEventListener("focus", focusLine);

// The placeholder alternates between the two ways to ask.
const PROMPTS = ["Type your own question…", "…or press 1 to 6 to ask a rod"];
let promptIndex = 0;
function nextPrompt() {
  el.placeholder.textContent = PROMPTS[promptIndex++ % PROMPTS.length];
  el.placeholder.classList.remove("is-new"); void el.placeholder.offsetWidth; el.placeholder.classList.add("is-new");
}
setInterval(nextPrompt, PLACEHOLDER_MS);

// ---------------------------------------------------------------------------
// 5. Start, stay awake, start over
// ---------------------------------------------------------------------------
function setAwake(on) {
  el.status.classList.toggle("is-awake", on);
  el.status.textContent = on ? "Napier is awake" : "Waking the portrait…";
}
const ping = () => wake().then(() => setAwake(true), () => setAwake(false));
ping();
setInterval(ping, kiosk ? KEEP_AWAKE_MS : 5 * KEEP_AWAKE_MS);

function startOver() {
  state.generation++;
  state.busy = false;
  state.history = [];
  for (const { node } of rods.values()) node.classList.remove("is-chosen", "is-asked");
  el.frame.classList.remove("is-thinking");
  el.pen.classList.remove("is-waiting");
  el.log.replaceChildren();
  setLine("");
  promptIndex = 0;
  nextPrompt();
  napierWrites(addLine("napier"), GREETING);
}

startDust(el.frame);
startOver();
focusLine();

// Idle: a shared station must not show one visitor's conversation to the next.
(function watchIdle() {
  const overlay = $("idle"), count = $("idle-count");
  let timer = null, countdown = null;
  const dirty = () => state.history.length || el.input.value;
  const stop = () => { clearInterval(countdown); countdown = null; overlay.hidden = true; };
  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!dirty()) return;
      if (state.busy) { arm(); return; }
      let left = IDLE_COUNTDOWN_S;
      count.textContent = left;
      overlay.hidden = false;
      countdown = setInterval(() => {
        left -= 1; count.textContent = left;
        if (left <= 0) { stop(); startOver(); }
      }, 1000);
    }, IDLE_MS);
  }
  // The key that wakes the overlay only dismisses it; it doesn't type or send.
  document.addEventListener("keydown", (e) => {
    if (countdown) { e.preventDefault(); e.stopImmediatePropagation(); stop(); }
    arm();
  }, { capture: true });
  for (const type of ["pointerdown", "input"]) document.addEventListener(type, () => { if (countdown) stop(); arm(); }, { passive: true });
  arm();
})();
