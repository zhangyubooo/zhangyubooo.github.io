# Napier's Rod Box

> **TODO (Yubo):** the sections marked ✍️ must be rewritten in your own words before submitting —
> the course asks for a README you wrote yourself. The notes under each heading are only reminders
> of what to cover. The section at the very bottom is labelled as AI-generated and may stay as is.

**Live:** https://zhangyubooo.github.io/napier/
**Backend code:** https://github.com/zhangyubooo/napier-backend
**Prompt log:** [prompt_log.md](prompt_log.md)

---

## ✍️ What it is

*Reminder:* a web companion to the 51-265 exhibit on Napier's bones and the *Rabdologia* for the
Posner Center. You choose one of sixteen carved rods (each one is a question), present it to the
1616 portrait of John Napier, and his answer appears as an inscription painted into the canvas.
The rod then joins your box, carved with a short motto. Come back later and the box — and Napier —
remember you. Rod XVI, "What do you remember of me?", unlocks last; once all sixteen are in the box,
a 3D animation packs them the way the real set travels — onto the tray, into the case, lid slid shut —
using my own CAD model of the set. No chat box, no typing, no voice: it should feel like an exhibit
object, not an AI app.

## ✍️ How to use it

*Reminder:* pick a rod → read the question on the plaque → "Present the rod" → watch the
inscription → open rods in your box to reread. Rod XVI ("What do you remember of me?") is locked
until the other fifteen are asked. With a full box, "Pack the set" plays the packing animation (drag to
turn the case). Once packed, a paper label with the date appears on the case, and "Save a picture" downloads a PNG of it.
"Begin as a new visitor", under the box, empties it after a second click (useful at the exhibit). "Skip experience →" in the footer fills the box with unanswered rods and jumps straight to the packing animation (nothing is saved; reload to return). Works on phones.

## ✍️ Features I'm most proud of

*Reminder — pick 2–3 and say why:*
- Question cards instead of a text box: the design choice that removes prompt injection entirely
- The inscription surfacing letter by letter, with older answers sinking into the varnish as "ghosts"
- Memory you can see: the rod box, stored per anonymous visitor in a database
- Napier only speaks from a curated fact sheet, and legends are told as legends

## ✍️ Parts I wrote or changed myself

*Reminder — list the concrete changes you made by hand and why (graders weight this heavily).*

## How to run it locally

1. Start the backend (see the backend README): `python app.py` → http://127.0.0.1:5002
2. In the portfolio folder: `python3 -m http.server 8000`
3. Open http://localhost:8000/napier/ — the page talks to the local backend automatically
   (`js/api.js` switches by hostname). Port 8000 matters: it is on the backend's CORS list.

## Secrets

The frontend holds no secrets. The Groq API key and the database URL exist only as environment
variables on Render (and in a local `.env` file that `.gitignore` keeps out of git). The browser
only ever sends a random visitor id and a card number 1–12.

## ✍️ How I used AI

*Reminder:* which tools for which parts, one place it was wrong, and a citation for the code it
produced. Details and verbatim prompts are in [prompt_log.md](prompt_log.md).

## Credits

- Portrait of John Napier (1616), public domain, via Wikimedia Commons — **TODO: add exact file link**
- Typeface: IM Fell English by Igino Marini (Google Fonts, SIL Open Font License)
- 3D: [three.js](https://threejs.org) (MIT); the tray, case and lid are my own CAD model
- Facts: MacTutor History of Mathematics (University of St Andrews), entries on John Napier and Henry Briggs

---

## AI-generated technical notes

*This section was written by Claude (Anthropic) and describes the code as built.*

### Architecture

```
browser (GitHub Pages, this folder)
   │  GET  /health              wake Render's free server as the page opens
   │  GET  /visitor/<uuid>      rods already in this visitor's box + how many visitors asked each rod
   │  POST /ask {visitor_id, card}
   ▼
Flask backend on Render (napier-backend)
   ├─ validates: visitor id must be a UUID, card must be 1–16, 8 requests/min per IP
   ├─ builds the prompt: persona.md + facts.md (system) + the card's question/focus + this visitor's earlier rods
   ├─ Groq API (openai/gpt-oss-20b) → JSON {"inscription", "motto"} → validated and trimmed
   └─ database (Postgres on Neon; SQLite file locally) → the rod is saved to the visitor's box
```

### Files in this folder

| File | Role |
|---|---|
| `index.html` | Page structure: portrait, plaque, tray, box, reading dialog |
| `style.css` | All visuals in 12 numbered sections — gilded frame, candle flicker, rods, box, inscription animation |
| `js/cards.js` | The sixteen rods (id, numeral, title, question). Must match the backend's `cards.json` |
| `js/api.js` | Backend URL, anonymous visitor id in localStorage, fetch with a 75 s timeout and friendly errors |
| `js/inscription.js` | Splits the answer into letter spans with staggered animation; retires the previous answer to a ghost layer |
| `js/rods.js` | Builds tray rods (lying flat, with titles) and the box: sixteen places in one row, each rod carrying only its numeral; locks rod XVI until last |
| `js/flight.js` | After an answer, the rod flies from the tray into its place in the box (FLIP technique with the Web Animations API) |
| `js/dust.js` | Dust motes drifting through the light in the portrait (a 2D canvas over the painting; paused off-screen and for reduced motion) |
| `js/packing.js` | The finale in WebGL (three.js): builds the tray, case and lid from `models/rod-box.json`, adds sixteen rods at real size, and animates them with a pure `pose(t)` timeline. Loaded only when needed |
| `models/rod-box.json` | Tray, case and lid meshes exported from my Fusion model (`napiers rods.3mf`), each recentred, in millimetres |
| `vendor/three-napier.min.js` | three.js r186 (MIT) — only the classes `packing.js` uses, bundled and minified with esbuild |
| `js/main.js` | The page's states (idle → selected → asking → answered / error) and all event wiring |

### Error handling

- Server asleep: the status dot pulses; after 6 s of waiting the plaque explains that waking takes up to a minute.
- Server unreachable or AI error: the plaque shows the backend's message and a "Try again" button; the rod returns to the tray.
- Database down: Napier still answers; the plaque notes the rod could not be saved.
- Portrait image missing: the frame shows an empty canvas instead of a broken image.
- `prefers-reduced-motion`: all animation is turned off and inscriptions appear at once.
