/* ============================================================
   Ask Yubo — chat box on about.html  (15-113 HW4)

   This page is static (GitHub Pages) and holds no secrets.
   Every question goes to my Flask backend on Render, which adds
   the persona, calls the Groq AI API with the key it keeps in an
   environment variable, and sends back {"reply": "..."}.
   Backend code + docs: https://github.com/zhangyubooo/ask-yubo-backend
   ============================================================ */

(() => {
  // ---- 1. Where the backend lives -----------------------------------------
  // Opened from my own machine (localhost) → talk to the backend running locally.
  // Anywhere else (the live site) → talk to Render.
  // Deciding this automatically means I can't forget to switch the URL back before pushing.
  const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API_BASE = IS_LOCAL
    ? 'http://127.0.0.1:5001'
    : 'https://ask-yubo-backend.onrender.com';

  const MAX_CHARS = 500;          // same limit the backend enforces
  const MAX_HISTORY = 12;         // same as the backend: last 6 back-and-forths
  const SLOW_AFTER_MS = 6000;     // after this, explain that the server is waking up
  const GIVE_UP_AFTER_MS = 70000; // a Render cold start can take close to a minute

  // ---- 2. Elements --------------------------------------------------------
  const root = document.querySelector('[data-ask]');
  if (!root) return;              // this script only does anything on a page with the chat box

  const log = root.querySelector('[data-ask-log]');
  const form = root.querySelector('[data-ask-form]');
  const input = form.querySelector('input');
  const button = form.querySelector('button');
  const suggestions = root.querySelectorAll('[data-ask-suggestion]');

  // The conversation so far. The backend remembers nothing between requests,
  // so the browser keeps this and sends it along every time.
  const history = [];

  // ---- 3. Wake the server up early ----------------------------------------
  // Render's free tier sleeps when idle. Pinging /health as soon as the page loads
  // starts the wake-up while the visitor is still reading. The result doesn't matter.
  fetch(`${API_BASE}/health`).catch(() => {});

  // ---- 4. Drawing messages ------------------------------------------------
  // who: 'user' | 'model' | 'error'. Text is set with textContent, never innerHTML,
  // so nothing in a reply can be interpreted as HTML.
  function addMessage(who, text) {
    const item = document.createElement('li');
    item.className = `ask__msg ask__msg--${who}`;

    const label = document.createElement('span');
    label.className = 'ask__who';
    label.textContent = { user: 'You', model: 'Yubo (AI)', error: 'Not sent' }[who];

    const body = document.createElement('p');
    body.className = 'ask__text';
    body.textContent = text;

    item.append(label, body);
    log.append(item);
    return body;
  }

  function setBusy(isBusy) {
    button.disabled = isBusy;
    input.disabled = isBusy;
    button.textContent = isBusy ? 'Sending…' : 'Send';
    root.setAttribute('aria-busy', String(isBusy));
    suggestions.forEach((b) => { b.disabled = isBusy; });
  }

  // ---- 5. Talking to the backend ------------------------------------------
  // Returns the reply text, or throws an Error whose message is safe to show.
  async function requestReply(message, onSlow) {
    const controller = new AbortController();
    const giveUp = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);
    const slow = setTimeout(onSlow, SLOW_AFTER_MS);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history.slice(-MAX_HISTORY) }),
        signal: controller.signal,
      });

      // Every response from my backend is JSON — but if something in between
      // (a proxy, a crashed server) returns HTML, don't fall over.
      let data = null;
      try { data = await response.json(); } catch { /* not JSON */ }

      if (!response.ok) {
        // 400 / 429 / 500 / 502 / 503 all carry {"error": "..."} written for visitors
        throw new Error(data?.error || `The server answered with an error (${response.status}).`);
      }
      if (typeof data?.reply !== 'string') {
        throw new Error('The server sent back something unexpected.');
      }
      return data.reply;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('The server took too long to answer. Please try again.');
      }
      if (err instanceof TypeError) {
        // fetch() throws TypeError when there's no response at all:
        // offline, server down, or CORS refused.
        throw new Error("Couldn't reach the server — it may still be waking up. Try again in a moment.");
      }
      throw err;
    } finally {
      clearTimeout(giveUp);
      clearTimeout(slow);
    }
  }

  // ---- 6. Sending a message -----------------------------------------------
  async function send(rawText) {
    const message = rawText.trim();

    // Check in the browser first so obvious mistakes don't cost a round trip.
    // The backend checks again anyway — it can't trust the browser.
    if (!message) {
      addMessage('error', 'Type a question first.');
      input.focus();
      return;
    }
    if (message.length > MAX_CHARS) {
      addMessage('error', `Please keep it under ${MAX_CHARS} characters.`);
      return;
    }

    addMessage('user', message);
    input.value = '';
    setBusy(true);

    const pending = addMessage('model', 'Thinking…');
    pending.parentElement.classList.add('is-pending');

    try {
      const reply = await requestReply(message, () => {
        pending.textContent = 'Waking up the server — the first answer can take up to a minute…';
      });
      pending.textContent = reply;
      pending.parentElement.classList.remove('is-pending');
      history.push({ role: 'user', text: message }, { role: 'model', text: reply });
    } catch (err) {
      pending.parentElement.remove();          // drop the "Thinking…" placeholder
      addMessage('error', err.message);
      input.value = message;                    // give the question back so it can be re-sent
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();                     // stay on the page instead of reloading it
    send(input.value);
  });

  suggestions.forEach((b) => {
    b.addEventListener('click', () => send(b.textContent));
  });
})();
