// dust.js — motes of dust drifting through the light in the portrait.
// A canvas laid over the painting; each mote drifts slowly upward and
// twinkles, and is brightest where it crosses the shaft of light that falls
// across the painting from the upper left. Purely decorative.

const COUNT = 80;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function makeMote() {
  return {
    x: Math.random(),                          // position as a fraction of the canvas
    y: Math.random(),
    r: 0.6 + Math.random() * 1.5,              // radius in CSS pixels
    vx: (Math.random() - 0.5) * 0.008,         // drift per second (fractions of the canvas)
    vy: -0.003 - Math.random() * 0.006,        // dust rises in warm air
    phase: Math.random() * Math.PI * 2,        // for twinkling
    speed: 0.6 + Math.random() * 1.2,
  };
}

/**
 * How lit a point is: 1 inside the shaft of light, fading to 0.12 outside.
 * The shaft runs from the upper-left corner towards the lower right.
 */
function light(x, y) {
  const distance = Math.abs(y - (0.05 + x * 0.9)) / Math.SQRT2;   // distance from the line y = 0.05 + 0.9x
  return 0.12 + 0.88 * Math.max(0, 1 - distance / 0.22);
}

export function startDust(container) {
  if (reduceMotion.matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "portrait__dust";
  canvas.setAttribute("aria-hidden", "true");
  container.querySelector(".portrait__candle")?.before(canvas);
  const ctx = canvas.getContext("2d");
  ctx.shadowColor = "rgba(255, 210, 140, 0.9)";   // a soft halo around each mote
  const motes = Array.from({ length: COUNT }, makeMote);

  let width = 0;
  let height = 0;
  function resize() {
    const ratio = Math.min(window.devicePixelRatio, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.shadowColor = "rgba(255, 210, 140, 0.9)";   // resizing a canvas resets its drawing state
    ctx.shadowBlur = 4;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Only animate while the portrait is on screen and the tab is visible.
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (visible && !document.hidden) {
      ctx.clearRect(0, 0, width, height);
      for (const mote of motes) {
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        if (mote.y < -0.02) Object.assign(mote, makeMote(), { y: 1.02 });   // re-enter from below
        if (mote.x < -0.02) mote.x = 1.02;
        if (mote.x > 1.02) mote.x = -0.02;
        const twinkle = 0.55 + 0.45 * Math.sin(now / 1000 * mote.speed + mote.phase);
        const alpha = 0.8 * light(mote.x, mote.y) * twinkle;
        ctx.fillStyle = `rgba(255, 226, 170, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(mote.x * width, mote.y * height, mote.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
