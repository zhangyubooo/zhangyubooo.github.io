// The microphone: records a spoken question while a hand is raised, and draws its
// sound as a little wave. Also (optional) Napier reading his answer aloud.

const MAX_MS = 15_000;            // a question longer than this is cut off and sent
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/**
 * recorder.start() begins recording; recorder.stop() resolves to { blob, ms }.
 * onLimit() fires if the visitor speaks past MAX_MS (the caller then stops).
 */
export function createRecorder(stream, { wave, onLimit } = {}) {
  const audio = new MediaStream(stream.getAudioTracks());
  const mimeType = TYPES.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
  let rec = null, chunks = [], startedAt = 0, limit = 0;

  // The wave: an analyser on the same microphone.
  let ctx = null, analyser = null, raf = 0;
  const g = wave?.getContext("2d");
  function ensureAnalyser() {
    if (ctx || !wave) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(audio).connect(analyser);
  }
  function drawWave() {
    raf = requestAnimationFrame(drawWave);
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const { width: w, height: h } = wave;
    g.clearRect(0, 0, w, h);
    const bars = 30, step = Math.floor(data.length / bars);
    g.fillStyle = "#F0A046";
    for (let i = 0; i < bars; i++) {
      let peak = 0;
      for (let j = i * step; j < (i + 1) * step; j++) peak = Math.max(peak, Math.abs(data[j] - 128));
      const bar = Math.max(3, (peak / 128) * h * 1.6);
      g.fillRect(i * (w / bars) + 2, (h - Math.min(h, bar)) / 2, w / bars - 4, Math.min(h, bar));
    }
  }

  return {
    /** Call once from a click or key press, so the browser lets audio run. */
    unlock() { ensureAnalyser(); ctx?.resume?.(); },

    get recording() { return !!rec; },

    start() {
      if (rec) return;
      chunks = [];
      rec = new MediaRecorder(audio, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start(250);
      startedAt = performance.now();
      limit = setTimeout(() => onLimit?.(), MAX_MS);
      ensureAnalyser();
      if (analyser) { ctx.resume?.(); drawWave(); }
    },

    /** Stop and hand back the recording. discard=true throws it away. */
    stop(discard = false) {
      clearTimeout(limit);
      cancelAnimationFrame(raf);
      g?.clearRect(0, 0, wave.width, wave.height);
      const current = rec;
      rec = null;
      if (!current) return Promise.resolve(null);
      const ms = performance.now() - startedAt;
      return new Promise((resolve) => {
        current.onstop = () => resolve(discard ? null : { blob: new Blob(chunks, { type: current.mimeType || mimeType || "audio/webm" }), ms });
        current.stop();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Napier's voice (off unless ?voice=1, or V pressed): the browser's own speech.
// ---------------------------------------------------------------------------
let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => /en-GB/i.test(v.lang) && /male|daniel|arthur|george/i.test(v.name))
       || voices.find((v) => /en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); }

export function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice && /^[\x00-\x7F‘-”–—]*$/.test(text)) u.voice = voice;   // English → a British voice
  u.rate = 0.92; u.pitch = 0.85;
  speechSynthesis.speak(u);
}
export const hush = () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); };
