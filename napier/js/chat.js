// AI Napier's chat panel.
//   square screen (overlay) — closed until the avatar is tapped, then opens over the page;
//                             suggested questions sit at the end of the conversation
//   tall screens (modal)    — a popup over the dimmed page, opened by the avatar or the
//                             page's hint bubble; "TRY ASKING" chips stay under the talk,
//                             Napier's bubbles carry his small portrait, and a pill says
//                             which page the visitor is on
// Every request carries the page the visitor is looking at.

import { askNapier } from "./api.js";

const HISTORY_TURNS = 6;          // earlier messages sent back for context
const MAX_SUGGESTIONS = 3;
const WAKING_HINT_MS = 6000;
const WORD_DELAY_MS = 45;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);

export function createChat(zone, { modal, getPage }) {
  const panel = $("chat"), log = $("chat-log"), form = $("chat-form");
  const input = $("chat-input"), send = $("chat-send"), avatar = $("avatar");
  const backdrop = $("chat-backdrop"), chipsBox = $("chat-chips");

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
    if (modal && role === "napier") {               // his small portrait beside each reply
      const row = document.createElement("div");
      row.className = "msgrow";
      const face = document.createElement("img");
      face.className = "msgrow__face";
      face.src = "images/napier-avatar.jpg";
      face.alt = "";
      row.append(face, p);
      log.append(row);
    } else {
      log.append(p);
    }
    return p;
  }

  function suggestionButton(preset) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = modal ? "chip" : "suggest__btn";
    b.textContent = preset.question;
    b.addEventListener("click", () => ask({ preset }));
    return b;
  }

  function renderSuggestions() {
    if (modal) {                                      // fixed chips under the conversation
      chipsBox.querySelectorAll(".chip").forEach((c) => { c.disabled = busy; });
      return;
    }
    log.querySelector(".suggest")?.remove();
    if (busy) return;
    const left = zone.presets.filter((p) => !asked.has(p.id)).slice(0, MAX_SUGGESTIONS);
    if (!left.length) return;
    const box = document.createElement("div");
    box.className = "suggest";
    left.forEach((preset) => box.append(suggestionButton(preset)));
    log.append(box);
  }

  function render() {
    log.replaceChildren();
    for (const [q, a] of seed) { bubble("visitor", q); bubble("napier", a); }
    renderSuggestions();
    log.scrollTop = 0;
  }

  if (modal) {
    $("chat-try").hidden = false;
    $("chat-context").hidden = false;
    chipsBox.replaceChildren(...(zone.chips || []).map(suggestionButton));
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
    if (modal) renderSuggestions();
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
    const page = getPage?.();
    const body = preset ? { zone: zone.id, page, preset: preset.id, history: recent }
                        : { zone: zone.id, page, question, history: recent };
    let reply = null, note = null, error = null;
    try {
      ({ reply } = await askNapier(body));
    } catch (err) {
      if (preset && err.offline && preset.fallback) {   // the live portrait can't be reached: his notes
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
      again.addEventListener("click", () => {
        (thinking.closest(".msgrow") || thinking).remove();
        again.remove();
        fetchReply({ preset, question });
      });
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

  // ---- open / close -------------------------------------------------------------
  const isOpen = () => panel.classList.contains("is-open");
  function open() {
    panel.classList.add("is-open");
    if (modal) backdrop.hidden = false;
    avatar.setAttribute("aria-expanded", "true");
  }
  function close() {
    panel.classList.remove("is-open");
    backdrop.hidden = true;
    avatar.setAttribute("aria-expanded", "false");
  }

  avatar.addEventListener("click", () => (isOpen() && !modal ? close() : open()));
  $("chat-close").addEventListener("click", close);
  backdrop.addEventListener("click", close);          // tap anywhere outside the popup
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  /**
   * Start a fresh conversation from a seed: [[question, answer, presetId?], …].
   * The panel closes unless `openNow` is set.
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
    (openNow ? open : close)();
  }

  return {
    start, open, close,
    /** Open the chat and ask a preset at once (the tall screens' hint bubble). */
    askPreset(preset) { open(); if (preset) ask({ preset }); },
    setContext(title) { $("chat-context").textContent = `You’re on:  ${title}`; },
    get busy() { return busy; },
    get live() { return live > 0 || input.value.trim() !== ""; },
    get open() { return isOpen(); },
  };
}
