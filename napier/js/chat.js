// AI Napier's chat panel.
//   square screen — closed until the avatar is tapped, then opens over the page
//   tall screens  — always on screen; the avatar puts the cursor in the input
//
// A conversation starts from a `seed` written for the screen. Visitors can tap a
// suggested question (outlined bubbles) or type their own; Napier's replies come
// from the backend and appear word by word.

import { askNapier } from "./api.js";

const HISTORY_TURNS = 6;          // earlier messages sent back for context
const MAX_SUGGESTIONS = 3;
const WAKING_HINT_MS = 6000;
const WORD_DELAY_MS = 45;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);

export function createChat(zone, { inline }) {
  const panel = $("chat"), log = $("chat-log"), form = $("chat-form");
  const input = $("chat-input"), send = $("chat-send"), avatar = $("avatar");

  let history = [];               // [{ role: "visitor" | "napier", text }] incl. the seed
  let live = 0;                   // messages added by a visitor in this session
  let asked = new Set();          // preset ids already asked (or answered by the seed)
  let seed = [];
  let busy = false;
  let generation = 0;             // bumps on reset, so late replies are dropped

  // ---- building the log -----------------------------------------------------
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function bubble(role, text) {
    const p = document.createElement("p");
    p.className = `msg msg--${role}`;
    p.textContent = text;
    log.append(p);
    return p;
  }

  function renderSuggestions() {
    log.querySelector(".suggest")?.remove();
    if (busy) return;
    const left = zone.presets.filter((p) => !asked.has(p.id)).slice(0, MAX_SUGGESTIONS);
    if (!left.length) return;
    const box = document.createElement("div");
    box.className = "suggest";
    for (const preset of left) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "suggest__btn";
      b.textContent = preset.question;
      b.addEventListener("click", () => ask({ preset }));
      box.append(b);
    }
    log.append(box);
  }

  function render() {
    log.replaceChildren();
    for (const [q, a] of seed) { bubble("visitor", q); bubble("napier", a); }
    renderSuggestions();
    log.scrollTop = 0;
  }

  /** Napier's reply appears word by word, like ink drying. */
  function reveal(p, text, note) {
    p.classList.remove("msg--thinking");
    p.replaceChildren();
    p.setAttribute("aria-label", text);
    const words = text.split(" ");
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.setAttribute("aria-hidden", "true");
      span.textContent = word + (i < words.length - 1 ? " " : "");
      if (!reduceMotion.matches) span.style.animationDelay = `${i * WORD_DELAY_MS}ms`;
      p.append(span);
    });
    if (note) {
      const small = document.createElement("span");
      small.className = "msg__note";
      small.textContent = note;
      p.append(small);
    }
  }

  // ---- asking -----------------------------------------------------------------
  function setBusy(value) {
    busy = value;
    send.disabled = value;
    panel.classList.toggle("is-busy", value);
  }

  function ask({ preset, question }) {
    if (busy) return;
    const text = preset ? preset.question : question;
    if (preset) asked.add(preset.id);
    live++;
    log.querySelector(".suggest")?.remove();
    bubble("visitor", text);
    fetchReply({ preset, question: text });
  }

  async function fetchReply({ preset, question }) {
    const mine = generation;
    setBusy(true);
    const thinking = bubble("napier", "");
    thinking.classList.add("msg--thinking");
    thinking.innerHTML = '<span class="quill" aria-hidden="true"><i></i><i></i><i></i></span><span class="visually-hidden">Napier is writing</span>';
    scrollDown();
    const hint = setTimeout(() => {
      thinking.insertAdjacentHTML("beforeend", '<span class="msg__waking">Napier is waking. The first question can take up to a minute.</span>');
      scrollDown();
    }, WAKING_HINT_MS);

    const recent = history.slice(-HISTORY_TURNS);
    const body = preset ? { zone: zone.id, preset: preset.id, history: recent }
                        : { zone: zone.id, question, history: recent };
    let reply = null, note = null, error = null;
    try {
      ({ reply } = await askNapier(body));
    } catch (err) {
      if (preset && err.offline) {          // the live portrait can't be reached: Napier's notes
        reply = preset.fallback;
        note = "From Napier’s notes. The live portrait is resting.";
      } else {
        error = err.message;
      }
    } finally {
      clearTimeout(hint);
    }
    if (mine !== generation) return;
    setBusy(false);

    if (reply) {
      reveal(thinking, reply, note);
      history.push({ role: "visitor", text: question }, { role: "napier", text: reply });
    } else {
      thinking.classList.remove("msg--thinking");
      thinking.classList.add("msg--error");
      thinking.textContent = error;
      const again = document.createElement("button");
      again.type = "button";
      again.className = "retry";
      again.textContent = "Try again";
      again.addEventListener("click", () => { thinking.remove(); again.remove(); fetchReply({ preset, question }); });
      log.append(again);
    }
    renderSuggestions();
    scrollDown();
    setTimeout(scrollDown, reduceMotion.matches ? 0 : 60 * WORD_DELAY_MS);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!question || busy) return;
    input.value = "";
    input.blur();                         // closes the on-screen keyboard
    ask({ question });
  });

  // ---- open / close (square screen) ---------------------------------------------
  const isOpen = () => inline || panel.classList.contains("is-open");
  function open() { panel.classList.add("is-open"); avatar.setAttribute("aria-expanded", "true"); }
  function close() { if (!inline) { panel.classList.remove("is-open"); avatar.setAttribute("aria-expanded", "false"); } }

  avatar.addEventListener("click", () => {
    if (inline) { input.focus(); return; }
    isOpen() ? close() : open();
  });
  $("chat-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  /**
   * Start a fresh conversation from a seed: [[question, answer, presetId?], …].
   * On the square screen the panel closes unless `openNow` is set.
   */
  function start(newSeed = [], { openNow = false } = {}) {
    generation++;
    setBusy(false);
    seed = newSeed;
    history = seed.flatMap(([q, a]) => [{ role: "visitor", text: q }, { role: "napier", text: a }]);
    asked = new Set(seed.map((s) => s[2]).filter(Boolean));
    live = 0;
    input.value = "";
    render();
    if (!inline) (openNow ? open : close)();
  }

  return {
    start,
    get busy() { return busy; },
    get live() { return live > 0 || input.value.trim() !== ""; },
    get open() { return isOpen(); },
  };
}
