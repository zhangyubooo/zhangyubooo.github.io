// Talking to the backend (Flask on Render).

// ---------------------------------------------------------------------------
// 1. Where the backend lives
//    Testing on my laptop → the local Flask server; everywhere else → Render.
// ---------------------------------------------------------------------------
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_BASE = LOCAL ? "http://127.0.0.1:5002" : "https://napier-backend-prtd.onrender.com";

// Render's free tier sleeps; the first request can take ~50 s. Wait that long
// before giving up, but no longer.
const TIMEOUT_MS = 75_000;

// ---------------------------------------------------------------------------
// 2. One fetch helper: timeout + friendly errors
//    Every failure becomes an Error whose message is safe to show visitors.
//    err.offline = true when the server could not be reached at all.
// ---------------------------------------------------------------------------
async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(API_BASE + path, { ...options, signal: controller.signal });
  } catch (err) {
    const error = new Error(err.name === "AbortError"
      ? "Napier did not wake in time. Please try again."
      : "Napier cannot be reached just now. Please try again shortly.");
    error.offline = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await response.json(); } catch { /* not JSON */ }
  if (!response.ok) {
    const error = new Error(data?.error || `Something went wrong (${response.status}). Please try again.`);
    error.offline = response.status >= 500;
    throw error;
  }
  return data;
}

// ---------------------------------------------------------------------------
// 3. The calls the page makes
// ---------------------------------------------------------------------------

/** Ping as soon as the page opens, so a sleeping server starts waking up. */
export const wake = () => request("/health");

/**
 * Ask Napier. Either { zone, preset } or { zone, question, history }.
 * history: earlier messages, [{ role: "visitor" | "napier", text }].
 * Resolves to { zone, reply, saved }.
 */
export const askNapier = (body) =>
  request("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
