// flight.js — after Napier answers, the rod you presented flies from the tray
// (lying flat) into its own place in the box (standing up).
//
// Technique: "FLIP". Measure where the rod was (First) and where its twin now
// sits in the box (Last), then animate a stand-in element between the two with
// the Web Animations API. The real rod in the box stays hidden until it lands.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * The CSS transform that makes an element of `size` (the standing box rod)
 * cover `rect`. A lying rod is the standing one turned −90° and stretched:
 * after the turn its width runs vertically, so it is scaled by rect.height.
 */
function cover(rect, size, lying) {
  const x = rect.left + rect.width / 2 - size.width / 2;
  const y = rect.top + rect.height / 2 - size.height / 2;
  if (!lying) return { x, y, turn: 0, sx: 1, sy: 1 };
  return { x, y, turn: -90, sx: rect.height / size.width, sy: rect.width / size.height };
}

const css = ({ x, y, turn, sx, sy }) => `translate(${x}px, ${y}px) rotate(${turn}deg) scale(${sx}, ${sy})`;

/**
 * Fly a stand-in from `fromRect` (where the tray rod was) to `toEl` (the rod
 * in the box). Resolves when it has landed. Does nothing if motion is reduced
 * or either end can't be measured.
 */
export function flyRod(fromRect, toEl, numeral) {
  if (!fromRect || !toEl || reduceMotion.matches) return Promise.resolve();
  const to = toEl.getBoundingClientRect();
  if (!to.width || !fromRect.width) return Promise.resolve();

  const ghost = document.createElement("div");
  ghost.className = "rod rod--box rod--flying";
  ghost.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "rod__numeral";
  label.textContent = numeral;
  ghost.append(label);
  Object.assign(ghost.style, { width: `${to.width}px`, height: `${to.height}px` });
  document.body.append(ghost);
  toEl.style.visibility = "hidden";

  const start = cover(fromRect, to, true);
  const end = cover(to, to, false);
  // Halfway: lifted above both ends, half turned — a little arc through the air.
  const mid = {
    x: (start.x + end.x) / 2,
    y: Math.min(start.y, end.y) - 70,
    turn: -45,
    sx: (start.sx + 1) / 2,
    sy: (start.sy + 1) / 2,
  };

  const flight = ghost.animate(
    [
      { transform: css(start), opacity: 0.5 },
      { transform: css(mid), opacity: 1, offset: 0.45 },
      { transform: css(end), opacity: 1 },
    ],
    { duration: 950, easing: "cubic-bezier(.45, 0, .2, 1)" },
  );

  return flight.finished
    .catch(() => {})                       // cancelled (e.g. page hidden) — still clean up
    .then(() => {
      ghost.remove();
      toEl.style.visibility = "";
      toEl.classList.add("is-landed");     // a small settle when it touches down
    });
}
