// Ask Napier — the last portrait. The exhibit's final station: Napier's 1616 portrait
// projected on a wall with six question rods beside it, a camera that watches hands and a
// microphone. Nothing to touch:
//
//   point at a rod and hold      → Napier answers that rod's question
//   raise your hand, speak,      → the question is written down (Whisper, via the backend)
//   lower it                       and Napier answers it
//
// Napier writes back letter by letter; the conversation builds up like letters.
// On a computer the webcam and microphone stand in for the gallery's.
//
// For testing without a camera (not shown to visitors):
//   1–6 ask a rod · hold Space to speak · / to type · Esc start over · V Napier reads aloud
//
//   ./            the station (asks for camera + microphone with a Begin card)
//   ./?kiosk=1    gallery: starts by itself, no link back, no mouse pointer, keep-awake pings
//   ./?voice=1    Napier also reads his answers aloud

import { QUESTIONS, GREETING, RESTING } from "./questions.js";
import { askNapier, transcribe, wake } from "./api.js";
import { writeInscription } from "./inscription.js";
import { startDust } from "./dust.js";
import { classify, createGestureTracker, PALM_LOST_MS } from "./gestures.js";
import { openCameraAndMicrophone, watchHands } from "./hands.js";
import { createRecorder, speak, hush } from "./voice.js";

const MAX_CHARS = 200;            // same cap as the backend
const HISTORY_TURNS = 6;          // earlier questions and answers sent back for context
const LOG_KEEP = 12;              // messages kept on screen
const DWELL_MS = 1100;            // hold a pointing finger on a rod this long to ask it
const MIN_SPEECH_MS = 700;        // shorter than this is a raised hand, not a question
const IDLE_MS = 60_000;           // nobody seen for this long → "Still there?"
const IDLE_COUNTDOWN_S = 10;
const KEEP_AWAKE_MS = 10 * 60_000;
const WAKING_HINT_MS = 6000;

const $ = (id) => document.getElementById(id);
const el = {
  stage: $("stage"), frame: $("frame"), log: $("log"), status: $("status"), tray: $("tray"),
  ear: $("ear"), earText: $("ear-text"), wave: $("ear-wave"), pointer: $("pointer"),
  eye: $("eye"), video: $("eye-video"), bones: $("eye-bones"), eyeCaption: $("eye-caption"),
  pen: $("pen"), input: $("pen-input"), placeholder: $("pen-placeholder"), count: $("pen-count"),
  begin: $("begin"), beginGo: $("begin-go"), beginNote: $("begin-note"),
};
const params = new URLSearchParams(location.search);
const kiosk = params.get("kiosk") === "1";
if (kiosk) document.body.classList.add("is-kiosk");

const state = {
  busy: false,          // Napier is hearing or answering
  history: [],          // [{ role: "visitor" | "napier", text }]
  generation: 0,        // bumps on start over, so a late answer is dropped
  started: false,       // Begin has been pressed (camera + microphone asked for)
  camera: false,        // hands are being read
  voice: params.get("voice") === "1",
};
let recorder = null;    // set once the microphone is open

// ---------------------------------------------------------------------------
// 1. The question rods
// ---------------------------------------------------------------------------
const rods = new Map();           // key "1"–"6" → { q, node }
for (const q of QUESTIONS) {
  const li = document.createElement("li");
  li.className = "rod";
  li.dataset.key = q.key;
  li.innerHTML = `<span class="rod__key" aria-hidden="true"></span><span class="rod__q"></span>`;
  li.querySelector(".rod__key").textContent = q.key;
  li.querySelector(".rod__q").textContent = q.question;
  el.tray.append(li);
  rods.set(q.key, { q, node: li });
}

function pressRod(key) {
  const rod = rods.get(key);
  if (!rod || state.busy) return;
  for (const { node } of rods.values()) node.classList.remove("is-chosen");
  rod.node.classList.add("is-chosen", "is-asked");
  send({ preset: rod.q });
}

// ---------------------------------------------------------------------------
// 2. The conversation on screen
// ---------------------------------------------------------------------------
function addLine(role, text = "", who = role === "napier" ? "Napier" : "You") {
  const line = document.createElement("div");
  line.className = `line line--${role}`;
  line.innerHTML = `<span class="line__who"></span><p class="line__text"></p>`;
  line.querySelector(".line__who").textContent = who;
  line.querySelector(".line__text").textContent = text;
  el.log.append(line);
  while (el.log.children.length > LOG_KEEP) el.log.firstElementChild.remove();
  el.log.scrollTop = el.log.scrollHeight;
  return line;
}

async function napierWrites(line, text, note = "") {
  line.classList.remove("is-writing");
  const p = line.querySelector(".line__text");
  const follow = setInterval(() => { el.log.scrollTop = el.log.scrollHeight; }, 120);
  if (state.voice) speak(text);
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

/** What the listening bar says. state: ready | listening | hearing | busy | nocam */
const EAR = {
  ready: "Raise your hand and ask your own question aloud",
  listening: "Listening… lower your hand to send",
  hearing: "Writing down what you said…",
  busy: "Napier is writing…",
};
function setEar(mode, text = EAR[mode]) {
  el.ear.dataset.state = mode;
  el.earText.textContent = text;
}
function readyEar() {
  setEar("ready", state.camera || !state.started ? EAR.ready
    : recorder ? "No camera: hold Space and speak, or press 1–6 for a rod"
    : "Press 1–6 for a rod, or / to type a question");
}
let earNoteTimer = 0;
function earNote(text) {          // a short message, then back to the invitation
  setEar("ready", text);
  clearTimeout(earNoteTimer);
  earNoteTimer = setTimeout(() => { if (!state.busy && !recorder?.recording) readyEar(); }, 4000);
}

// ---------------------------------------------------------------------------
// 3. Asking
// ---------------------------------------------------------------------------
/** Offline: answer from Napier's notes, choosing the rod nearest to the question. */
function fromNotes(text, preset) {
  if (preset) return preset.fallback;
  const lower = text.toLowerCase();
  const match = QUESTIONS.find((q) => q.keywords.some((k) => new RegExp(`\\b${k}`).test(lower)));
  return match ? match.fallback : RESTING;
}

/** Ask a rod's question ({ preset }) or the visitor's own ({ question, spoken }). */
async function send({ preset = null, question = "", spoken = false }) {
  question = preset ? preset.question : question.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!question || (state.busy && !spoken)) return;
  if (!preset) for (const { node } of rods.values()) node.classList.remove("is-chosen");

  const mine = ++state.generation;
  state.busy = true;
  hush();
  setEar("busy");
  el.frame.classList.add("is-thinking");
  addLine("visitor", question, preset ? `Rod ${preset.key}` : spoken ? "You asked" : "You");
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
  readyEar();
}

// ---------------------------------------------------------------------------
// 4. Speaking: raise a hand → listen; lower it → write it down → ask
// ---------------------------------------------------------------------------
function startListening() {
  if (!recorder || state.busy || recorder.recording) return;
  hush();
  pointAt(null);
  recorder.start();
  setEar("listening");
  el.stage.classList.add("is-listening");
}

/** tailMs: how long the recording ran on after the visitor finished (the hand-lost grace). */
async function stopListening(tailMs = 0) {
  if (!recorder?.recording) return;
  el.stage.classList.remove("is-listening");
  const take = await recorder.stop();
  if (!take || take.ms - tailMs < MIN_SPEECH_MS) { earNote("Raise your hand, then speak while it is up"); return; }

  const mine = ++state.generation;
  state.busy = true;
  setEar("hearing");
  let text = "";
  try {
    ({ text } = await transcribe(take.blob));
  } catch (err) {
    if (mine !== state.generation) return;
    state.busy = false;
    earNote(err.offline ? "Napier cannot hear just now. Point at a rod instead." : err.message);
    return;
  }
  if (mine !== state.generation) return;
  if (!text) { state.busy = false; earNote("Napier did not catch that. Raise your hand and try again."); return; }
  send({ question: text, spoken: true });
}

// ---------------------------------------------------------------------------
// 5. Pointing: a finger aims at the wall; holding it on a rod asks that rod
// ---------------------------------------------------------------------------
let dwell = { node: null, since: 0, done: false };
function pointAt(target) {
  if (!target) {
    el.pointer.hidden = true;
    if (dwell.node) dwell.node.style.removeProperty("--dwell");
    dwell = { node: null, since: 0, done: false };
    return;
  }
  const box = el.stage.getBoundingClientRect();
  const x = box.left + target.x * box.width, y = box.top + target.y * box.height;
  el.pointer.hidden = false;
  el.pointer.style.transform = `translate(${x - box.left}px, ${y - box.top}px)`;

  const node = document.elementFromPoint(x, y)?.closest(".rod") || null;
  const now = performance.now();
  if (node !== dwell.node) {
    dwell.node?.style.removeProperty("--dwell");
    dwell = { node, since: now, done: false };
  }
  el.pointer.classList.toggle("is-on-rod", !!node && !state.busy);
  if (!node || dwell.done || state.busy) return;
  const progress = Math.min(1, (now - dwell.since) / DWELL_MS);
  node.style.setProperty("--dwell", progress.toFixed(3));
  if (progress >= 1) {
    dwell.done = true;                     // must leave the rod before asking it again
    node.style.removeProperty("--dwell");
    pressRod(node.dataset.key);
  }
}

const tracker = createGestureTracker({
  onPointer: pointAt,
  onRaise: startListening,
  onLower: () => stopListening(PALM_LOST_MS),
  onSeen: () => idle.seen(),
});

// ---------------------------------------------------------------------------
// 6. Camera and microphone
// ---------------------------------------------------------------------------
async function begin() {
  if (state.started) return;
  state.started = true;
  el.beginGo.disabled = true;
  el.beginNote.textContent = "Waiting for the camera and microphone…";
  let stream;
  try {
    stream = await openCameraAndMicrophone();
  } catch (err) {
    console.warn("No camera/microphone:", err);
    el.eye.classList.add("is-off");
    el.eyeCaption.textContent = "No camera or microphone. Press 1–6 for a rod, or / to type a question.";
    finishBegin();
    return;
  }
  recorder = createRecorder(stream, { wave: el.wave, onLimit: () => { tracker.reset(); stopListening(); } });
  recorder.unlock();
  finishBegin();
  try {
    await watchHands({
      stream, video: el.video, bones: el.bones,
      onFrame: (hands, now) => {
        tracker.feed(hands, now);
        return hands.map(classify);
      },
    });
    state.camera = true;
    el.eye.classList.add("is-on");
  } catch (err) {
    console.warn("Hand tracking unavailable:", err);
    el.eye.classList.add("is-off");
    el.eyeCaption.textContent = "The hand reader could not load. Hold Space and speak, or press 1–6 for a rod.";
  }
  if (!state.busy) readyEar();
}
function finishBegin() {
  el.begin.hidden = true;
  if (!state.busy) readyEar();
}
el.beginGo.addEventListener("click", begin);

// ---------------------------------------------------------------------------
// 7. The keyboard (testing only)
// ---------------------------------------------------------------------------
function openPen(open) {
  el.pen.hidden = !open;
  el.ear.hidden = open;
  if (open) { el.input.value = ""; onInput(); el.input.focus(); } else el.input.blur();
}
function onInput() {
  el.placeholder.hidden = el.input.value.length > 0;
  const left = MAX_CHARS - el.input.value.length;
  el.count.textContent = left <= 40 ? `${left}` : "";
}
el.input.addEventListener("input", onInput);
el.input.addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const question = el.input.value;
    openPen(false);
    send({ question });
  } else if (e.key === "Escape") {
    e.preventDefault();
    openPen(false);
  }
  e.stopPropagation();
});
el.pen.addEventListener("submit", (e) => e.preventDefault());

document.addEventListener("keydown", (e) => {
  if (e.target === el.input || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!el.begin.hidden) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); begin(); }
    return;
  }
  if (rods.has(e.key)) { e.preventDefault(); pressRod(e.key); }
  else if (e.key === " ") { e.preventDefault(); if (!e.repeat) startListening(); }
  else if (e.key === "/") { e.preventDefault(); openPen(true); }
  else if (e.key === "Escape") { e.preventDefault(); startOver(); }
  else if (e.key === "v" || e.key === "V") { state.voice = !state.voice; if (!state.voice) hush(); earNote(state.voice ? "Napier will read his answers aloud" : "Napier will answer in writing only"); }
});
document.addEventListener("keyup", (e) => {
  if (e.key === " " && e.target !== el.input && el.begin.hidden) { e.preventDefault(); stopListening(); }
});

// ---------------------------------------------------------------------------
// 8. Start, stay awake, start over
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
  hush();
  recorder?.stop(true);
  tracker.reset();
  el.stage.classList.remove("is-listening");
  el.frame.classList.remove("is-thinking");
  for (const { node } of rods.values()) node.classList.remove("is-chosen", "is-asked");
  el.log.replaceChildren();
  openPen(false);
  readyEar();
  napierWrites(addLine("napier"), GREETING);
}

// Idle: a shared station must not show one visitor's conversation to the next.
const idle = (function watchIdle() {
  const overlay = $("idle"), count = $("idle-count");
  let timer = null, countdown = null;
  const dirty = () => state.history.length > 0;
  const stop = () => { clearInterval(countdown); countdown = null; overlay.hidden = true; };
  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!dirty()) return;
      if (state.busy || recorder?.recording) { arm(); return; }
      let left = IDLE_COUNTDOWN_S;
      count.textContent = left;
      overlay.hidden = false;
      countdown = setInterval(() => {
        left -= 1; count.textContent = left;
        if (left <= 0) { stop(); startOver(); }
      }, 1000);
    }, IDLE_MS);
  }
  let lastSeen = 0;
  function seen() {                 // called every camera frame with a hand: re-arm at most twice a second
    const now = performance.now();
    if (countdown) stop();
    if (now - lastSeen > 500) { lastSeen = now; arm(); }
  }
  document.addEventListener("keydown", (e) => {
    if (countdown) { e.preventDefault(); e.stopImmediatePropagation(); stop(); }
    arm();
  }, { capture: true });
  arm();
  return { seen };
})();

startDust(el.frame);
startOver();
if (kiosk) begin(); else { el.begin.hidden = false; el.beginGo.focus(); }

// For automated tests: feed made-up hands without a camera.
window.__napier = { feed: (hands, now = performance.now()) => tracker.feed(hands, now) };
