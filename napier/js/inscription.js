// The inscription: Napier's answer appears letter by letter in the painting,
// like gold paint surfacing. The previous answer doesn't vanish — it fades
// back into the canvas as a faint "ghost", so the painting keeps a trace of
// the conversation.

const LETTER_DELAY_MS = 24;   // time between letters appearing
const MAX_GHOSTS = 1;         // how many old inscriptions stay faintly visible

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Write `text` into `el`. Resolves when the last letter has appeared.
 * `ghosts` is the container that collects earlier inscriptions.
 */
export function writeInscription(el, ghosts, text) {
  // 1. Retire the current inscription to the ghost layer.
  if (el.textContent.trim()) {
    const ghost = document.createElement("p");
    ghost.className = "ghost";
    ghost.textContent = el.textContent;
    ghosts.prepend(ghost);
    while (ghosts.children.length > MAX_GHOSTS) ghosts.lastElementChild.remove();
  }

  // 2. Screen readers get the whole sentence at once; the letter spans are hidden from them.
  el.setAttribute("aria-label", text);
  el.replaceChildren();

  if (reduceMotion.matches) {
    el.textContent = text;
    return Promise.resolve();
  }

  // 3. One <span> per letter, each with a slightly later animation start.
  //    Words are wrapped so a word never breaks across two lines.
  let index = 0;
  for (const word of text.split(" ")) {
    const wordSpan = document.createElement("span");
    wordSpan.className = "word";
    wordSpan.setAttribute("aria-hidden", "true");
    for (const letter of word) {
      const span = document.createElement("span");
      span.className = "letter";
      span.textContent = letter;
      span.style.animationDelay = `${index * LETTER_DELAY_MS}ms`;
      wordSpan.append(span);
      index += 1;
    }
    el.append(wordSpan, " ");
    index += 1; // a beat for the space
  }

  return new Promise((resolve) => setTimeout(resolve, index * LETTER_DELAY_MS + 600));
}

/** Clear everything (used when a new visitor begins). */
export function clearInscriptions(el, ghosts) {
  el.replaceChildren();
  el.removeAttribute("aria-label");
  ghosts.replaceChildren();
}
