/* ============================================================
   Ask Yubo — floating chat widget  (15-113 HW4)
   ask-yubo.js

   A round button in the bottom-right corner of every page. Click it and a
   text-message style chat opens on the right, where visitors can talk to an
   AI version of me.

   This site is static (GitHub Pages) and holds no secrets. Every question
   goes to my Flask backend on Render, which adds the persona, calls the Groq
   AI API with the key it keeps in an environment variable, and sends back
   {"reply": "..."}.
   Backend code + docs: https://github.com/zhangyubooo/ask-yubo-backend

   Adding it to a page takes two lines — the script builds everything else:
     <link rel="stylesheet" href="ask-yubo.css">
     <script src="ask-yubo.js"></script>

   Sections: ① Settings ② Build the widget ③ Remembering the chat across pages
             ④ Open / close ⑤ Drawing messages ⑥ Talking to the backend
             ⑦ Sending ⑧ Wiring up events
   ============================================================ */

(() => {
  /* ① SETTINGS ------------------------------------------------
     Opened from my own machine (localhost) → talk to the backend running locally.
     Anywhere else (the live site) → talk to Render.
     Deciding this automatically means I can't forget to switch the URL back before pushing. */
  const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API_BASE = IS_LOCAL
    ? 'http://127.0.0.1:5001'
    : 'https://ask-yubo-backend.onrender.com';

  const MAX_CHARS = 500;          // same limit the backend enforces
  const MAX_HISTORY = 12;         // same as the backend: last 6 back-and-forths
  const SLOW_AFTER_MS = 6000;     // after this, explain that the server is waking up
  const GIVE_UP_AFTER_MS = 70000; // a Render cold start can take close to a minute

  const GREETING = "Hi! I'm an AI version of Yubo. Ask me about my projects, what I study, or how I like to work.";
  const SUGGESTIONS = [
    'What are you studying?',
    'How did you make Restless Mind?',
    '用中文介绍一下你自己',
  ];

  // The portrait is found relative to this script file, so the widget still
  // works if a page in a sub-folder ever includes it.
  const SCRIPT_URL = document.currentScript?.src || location.href;
  const AVATAR_URL = new URL('images/ask-avatar.jpg', SCRIPT_URL).href;


  /* ② BUILD THE WIDGET ------------------------------------------
     The markup lives here instead of in each HTML page, so there's one copy
     to maintain rather than three. It's a fixed template with no visitor
     text in it; visitor and AI text is only ever added with textContent (⑤). */
  const root = document.createElement('div');
  root.className = 'ask';
  root.innerHTML = `
    <button class="ask__launcher" type="button"
            aria-expanded="false" aria-controls="ask-panel"
            aria-label="Chat with an AI version of Yubo">
      <svg class="ask__icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"/>
      </svg>
      <svg class="ask__icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>

    <section class="ask__panel" id="ask-panel" role="dialog" aria-labelledby="ask-name">
      <header class="ask__header">
        <img class="ask__avatar" src="${AVATAR_URL}" alt="">
        <p class="ask__title">
          <span class="ask__name" id="ask-name">Yubo (AI)</span>
          <span class="ask__sub">Answers from this site · can be wrong</span>
        </p>
        <button class="ask__close" type="button" aria-label="Close chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>

      <!-- aria-live: screen readers announce new replies as they arrive -->
      <ol class="ask__log" aria-live="polite"></ol>

      <ul class="ask__suggestions" aria-label="Example questions"></ul>

      <form class="ask__form">
        <label class="visually-hidden" for="ask-input">Your message</label>
        <input id="ask-input" type="text" maxlength="${MAX_CHARS}" autocomplete="off"
               placeholder="Message">
        <button class="ask__send" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
      </form>
    </section>`;
  document.body.append(root);

  const launcher = root.querySelector('.ask__launcher');
  const closeBtn = root.querySelector('.ask__close');
  const log = root.querySelector('.ask__log');
  const suggestionList = root.querySelector('.ask__suggestions');
  const form = root.querySelector('.ask__form');
  const input = root.querySelector('#ask-input');
  const sendBtn = root.querySelector('.ask__send');

  SUGGESTIONS.forEach((text) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => send(text));
    li.append(b);
    suggestionList.append(li);
  });


  /* ③ REMEMBERING THE CHAT ACROSS PAGES --------------------------
     Each page of the site is a separate HTML file, so clicking "About" loads a
     fresh page and all JavaScript variables are lost. sessionStorage keeps the
     conversation (and whether the chat was open) for as long as this browser
     tab is open — close the tab and it's gone. Nothing is stored on the server.
     Storage can be unavailable (private mode, blocked cookies), so every access
     is wrapped in try/catch and the chat simply works without memory then. */
  const STORE_KEY = 'askYubo';

  function loadState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.history)) return saved;
    } catch { /* no storage, or nothing saved yet */ }
    return { history: [], open: false };
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        history: history.slice(-MAX_HISTORY),
        open: root.classList.contains('is-open'),
      }));
    } catch { /* ignore — the chat still works, it just won't follow you to the next page */ }
  }

  const saved = loadState();
  // The conversation so far. The backend remembers nothing between requests,
  // so the browser keeps this and sends it along every time.
  const history = saved.history;   // [{ role: 'user' | 'model', text: '...' }]


  /* ④ OPEN / CLOSE --------------------------------------------- */
  function setOpen(open, { focus = true } = {}) {
    root.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Chat with an AI version of Yubo');
    document.documentElement.classList.toggle('ask-lock', open);   // phones: stop the page scrolling behind
    saveState();

    if (open) {
      wakeServer();
      scrollToEnd();
      if (focus) input.focus({ preventScroll: true });
    } else if (focus) {
      launcher.focus();
    }
  }

  // Render's free tier sleeps when idle. A cheap GET /health starts the wake-up
  // before the visitor has finished typing. The result doesn't matter.
  function wakeServer() {
    fetch(`${API_BASE}/health`).catch(() => {});
  }


  /* ⑤ DRAWING MESSAGES ------------------------------------------
     Text goes in with textContent, never innerHTML, so nothing in a reply
     (or in what a visitor types) can be interpreted as HTML. */
  function addBubble(role, text) {
    const li = document.createElement('li');
    li.className = `ask__msg ask__msg--${role}`;
    li.textContent = text;
    log.append(li);
    scrollToEnd();
    return li;
  }

  function addNote(text, alignRight = false) {
    const li = document.createElement('li');
    li.className = 'ask__note' + (alignRight ? ' ask__note--right' : '');
    li.textContent = text;
    log.append(li);
    scrollToEnd();
    return li;
  }

  function addTyping() {
    const li = document.createElement('li');
    li.className = 'ask__msg ask__msg--model';
    li.setAttribute('aria-label', 'Yubo (AI) is typing');
    li.innerHTML = '<span class="ask__typing" aria-hidden="true"><span></span><span></span><span></span></span>';
    log.append(li);
    scrollToEnd();
    return li;
  }

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function updateSuggestions() {
    suggestionList.hidden = history.length > 0;   // only before the first question
  }

  // Redraw the conversation carried over from the previous page
  addBubble('model', GREETING);
  history.forEach((m) => addBubble(m.role, m.text));
  updateSuggestions();


  /* ⑥ TALKING TO THE BACKEND -------------------------------------
     Returns the reply text, or throws an Error whose message is safe to show. */
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

      // My backend always answers in JSON — but if something in between
      // (a proxy, a crashed server) sends HTML, don't fall over.
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
        throw new Error('The server took too long to answer.');
      }
      if (err instanceof TypeError) {
        // fetch() throws TypeError when there is no response at all:
        // offline, server down, or blocked by CORS.
        throw new Error("Couldn't reach the server — it may still be waking up.");
      }
      throw err;
    } finally {
      clearTimeout(giveUp);
      clearTimeout(slow);
    }
  }


  /* ⑦ SENDING ------------------------------------------------ */
  let busy = false;
  let failed = null;   // the last message that didn't go through: { bubble, note }

  function setBusy(isBusy) {
    busy = isBusy;
    sendBtn.disabled = isBusy;
    suggestionList.querySelectorAll('button').forEach((b) => { b.disabled = isBusy; });
    root.setAttribute('aria-busy', String(isBusy));
  }

  async function send(rawText) {
    if (busy) return;               // one question at a time
    const message = rawText.trim();

    // Check in the browser first so obvious mistakes don't cost a round trip.
    // The backend checks again anyway — it can't trust the browser.
    if (!message) {
      input.focus();
      return;                       // an empty send just does nothing, like in Messages
    }
    if (message.length > MAX_CHARS) {
      addNote(`Please keep it under ${MAX_CHARS} characters.`);
      return;
    }

    // Retrying? Clear away the faded copy of the message that failed.
    if (failed) {
      failed.bubble.remove();
      failed.note.remove();
      failed = null;
    }

    const bubble = addBubble('user', message);
    input.value = '';
    updateSuggestionsWhileSending();
    setBusy(true);

    const typing = addTyping();
    let slowNote = null;

    try {
      const reply = await requestReply(message, () => {
        slowNote = addNote('Waking up the server — the first reply can take up to a minute.');
        log.append(typing);           // keep the dots below the note
        scrollToEnd();
      });
      typing.remove();
      slowNote?.remove();
      addBubble('model', reply);
      history.push({ role: 'user', text: message }, { role: 'model', text: reply });
      saveState();
    } catch (err) {
      typing.remove();
      slowNote?.remove();
      bubble.classList.add('is-failed');
      const note = addNote(`Not delivered — ${err.message}`, true);
      failed = { bubble, note };
      input.value = message;          // give it back so it can be re-sent with one tap
    } finally {
      setBusy(false);
      updateSuggestions();
      input.focus({ preventScroll: true });
    }
  }

  // Hide the example questions as soon as the first one is on its way
  function updateSuggestionsWhileSending() {
    suggestionList.hidden = true;
  }


  /* ⑧ WIRING UP EVENTS ----------------------------------------- */
  launcher.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  closeBtn.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', (event) => {
    event.preventDefault();         // stay on the page instead of reloading it
    send(input.value);
  });

  // Any element with data-ask-open elsewhere on the site (e.g. the "Open the chat"
  // button on ask-yubo.html) opens the chat too. Listening on document means the
  // button doesn't need its own script.
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-ask-open]')) setOpen(true);
  });

  // Esc closes the chat when focus is inside it
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-open')) setOpen(false);
  });

  // Was the chat open on the previous page? Reopen it without the slide-in
  // animation, and without grabbing focus from the page that just loaded.
  if (saved.open) {
    root.classList.add('no-anim');
    setOpen(true, { focus: false });
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));
  } else {
    wakeServer();                   // start waking Render while the visitor looks around
  }
})();
