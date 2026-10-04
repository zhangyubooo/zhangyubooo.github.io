// Talking to the backend (Flask on Render), and remembering who this visitor is.

// ---------------------------------------------------------------------------
// 1. Where the backend lives
//    Testing on my laptop → the local Flask server; everywhere else → Render.
// ---------------------------------------------------------------------------
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_BASE = LOCAL ? "http://127.0.0.1:5002" : "https://napier-backend.onrender.com";

// Render's free tier sleeps; the first request can take ~50 s. Wait that long
// before giving up, but no longer.
const TIMEOUT_MS = 75_000;

// ---------------------------------------------------------------------------
// 2. Visitor id — an anonymous random id kept in this browser.
//    No name, no login: the id is the only thing linking a visitor to their box.
// ---------------------------------------------------------------------------
const STORAGE_KEY = "napier-visitor-id";
let memoryOnlyId = null; // used if the browser blocks localStorage (private mode etc.)

export function getVisitorId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    memoryOnlyId ??= crypto.randomUUID();
    return memoryOnlyId;
  }
}

export function resetVisitor() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing stored */ }
  memoryOnlyId = null;
}

// ---------------------------------------------------------------------------
// 3. One fetch helper: timeout + friendly errors
//    Every failure becomes an Error whose message is safe to show visitors.
// ---------------------------------------------------------------------------
async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(API_BASE + path, { ...options, signal: controller.signal });
  } catch (err) {
    throw new Error(err.name === "AbortError"
      ? "Napier did not wake in time. Please try again."
      : "The portrait cannot be reached — check your connection, or try again shortly.");
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await response.json(); } catch { /* not JSON */ }
  if (!response.ok) {
    throw new Error(data?.error || `Something went wrong (${response.status}). Please try again.`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// 4. The three calls the page makes
// ---------------------------------------------------------------------------

/** Ping as soon as the page opens, so a sleeping server starts waking up. */
export const wake = () => request("/health");

/** { rods: [{card, inscription, motto}], counts: {"4": 12, ...} } */
export const loadBox = () => request(`/visitor/${getVisitorId()}`);

/** { card, inscription, motto, repeat, count, saved } */
export const presentRod = (card) =>
  request("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitor_id: getVisitorId(), card }),
  });
