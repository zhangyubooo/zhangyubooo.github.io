// Drawing rods: the tray (rods still to present) and the box (rods collected).
// These functions only build DOM from data; they don't talk to the server.

import { CARDS, MEMORY_CARD, cardById } from "./cards.js";

/** A rod in the tray: numeral + short title. Clicking selects it. */
function trayRod(card, onSelect) {
  const rod = document.createElement("button");
  rod.type = "button";
  rod.className = "rod rod--tray";
  rod.dataset.card = card.id;
  rod.setAttribute("role", "listitem");
  rod.setAttribute("aria-label", `Rod ${card.numeral}: ${card.question}`);
  rod.setAttribute("aria-pressed", "false");
  rod.innerHTML = `
    <span class="rod__numeral">${card.numeral}</span>
    <span class="rod__title">${card.title}</span>`;
  rod.addEventListener("click", () => onSelect(card));
  return rod;
}

/** A rod in the box: a bone strip carrying only its numeral. Clicking it opens Napier's answer. */
function boxRod(card, saved, onOpen) {
  const rod = document.createElement("button");
  rod.type = "button";
  rod.className = "rod rod--box";
  rod.dataset.card = card.id;
  if (saved.skipped) {
    rod.classList.add("is-skipped");                 // placed by "Skip experience", never answered
    rod.title = `Rod ${card.numeral} (skipped)`;
    rod.setAttribute("aria-label", `Rod ${card.numeral}, skipped, not answered.`);
  } else {
    rod.title = `Rod ${card.numeral}: “${saved.motto}”`;
    rod.setAttribute("aria-label", `Rod ${card.numeral}, answered: ${saved.motto}. Open to read.`);
  }
  const numeral = document.createElement("span");
  numeral.className = "rod__numeral";
  numeral.setAttribute("aria-hidden", "true");
  numeral.textContent = card.numeral;
  rod.append(numeral);
  rod.addEventListener("click", () => onOpen(card, saved));
  return rod;
}

/**
 * Redraw the tray. `answered` is a Set of card ids already in the box; those
 * leave the tray. The memory rod (XVI) is locked until every other rod has
 * been presented, so Napier's last answer can recall the whole visit.
 */
export function renderTray(trayEl, answered, selectedId, onSelect) {
  const othersDone = CARDS.every((card) => card.id === MEMORY_CARD || answered.has(card.id));
  const rods = CARDS
    .filter((card) => !answered.has(card.id))
    .map((card) => {
      const rod = trayRod(card, onSelect);
      if (card.id === MEMORY_CARD && !othersDone) {
        rod.disabled = true;
        rod.classList.add("is-locked");
        rod.title = "Present the other rods first — this one is asked last.";
        rod.setAttribute("aria-label", `Rod ${card.numeral}: ${card.question} Locked until the other rods are presented.`);
      }
      if (card.id === selectedId) {
        rod.classList.add("is-selected");
        rod.setAttribute("aria-pressed", "true");
      }
      return rod;
    });
  trayEl.replaceChildren(...rods);
  return rods.length;
}

/**
 * Redraw the box: sixteen places in one row, in rod order. A place holds its
 * rod once that rod has been presented; `justAdded` gets an arrival animation.
 */
export function renderBox(boxEl, savedRods, onOpen, justAdded = null) {
  const byCard = new Map(savedRods.map((saved) => [saved.card, saved]));
  const places = CARDS.map((card) => {
    const place = document.createElement("div");
    place.className = "place";
    place.setAttribute("role", "listitem");
    const saved = byCard.get(card.id);
    if (saved) {
      const rod = boxRod(card, saved, onOpen);
      if (card.id === justAdded) rod.classList.add("is-arriving");
      place.append(rod);
    } else {
      place.setAttribute("aria-label", `Place for rod ${card.numeral}, empty`);
    }
    return place;
  });
  boxEl.replaceChildren(...places);
  return byCard.size;
}
