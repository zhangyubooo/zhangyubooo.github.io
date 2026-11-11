# Ask Napier: exhibit screens

**Live:** https://zhangyubooo.github.io/napier/
**Backend code:** https://github.com/zhangyubooo/napier-backend
**Prompt log:** [prompt_log.md](prompt_log.md)

---

## What it is

The screens for *Making Calculation Visible*, my exhibit design on John Napier's *Rabdologia* (1617)
for CMU's Posner Center (51-265 Environments Studio, fall 2026). The look follows the exhibit's
screen UI package (dark UI, Georgia, accent `#F0A046`), exported from the Rhino model on 2026-11-11.
Each screen shows how to use the interaction beside it, and an AI Napier answers questions about it.

| Set | URL | Screen | Chat |
|---|---|---|---|
| 1 · Rods 2–7 Touch & Learn | `?zone=rods&page=1…7` | six square 15″ × 15″ screens; each shows its own page by default, visitors can page through all seven. Pages 1–6 are the design's; page 7 is my 3D model of the set (below) | opens over the page from the avatar; pages 2 and 5 start with it open, as designed |
| 2 · Rod 15 Promptuarium | `?zone=promptuary` | tall 17″ × 36″ screen: Pick a plate → Lay it across → Add the diagonals | always on screen under "STUCK? ASK NAPIER" |
| 3 · Rod 16 Location Arithmetic | `?zone=location` | tall 17″ × 36″ screen: Stand on squares → Now the other arm → Stand on START | always on screen |

Without `?zone=` the page shows links to every screen. Add `&kiosk=1` in the exhibit: the "All
screens" link is hidden and the backend is pinged every 10 minutes so it never falls asleep.

The screen is drawn at design size (1500 units wide; 1500 × 1500 or 1500 × 3176) and scaled to fit
the display, with black bars if the display's shape differs (for example a 40″ 16:9 screen turned
upright for the tall sets).

This folder used to hold **Napier's Rod Box** (15-113 Project 2, submitted 10/2026). Its code is
still in this repository's git history, and its two backend endpoints still work.

## Page 7: the set in its box

My CAD model of the real set (tray, case and lid, from Napier's Rod Box) with sixteen rods at real
size, each carrying a real rod face (digits 0–9, then 1–6).

- The case stands closed and slowly turns. Drag empty space to turn the view, pinch or scroll to zoom.
- **Double-tap** the box: the lid slides out and lies down, the tray is lifted out and laid flat,
  and the rods are spread out on the table.
- **Drag** any piece across the table: the case, the lid, the tray, or any single rod.
- **Double-tap** again: every piece goes back and the set is packed up.

The animation reuses the Rod Box finale's timeline (`pose(t)`), played backwards to unpack. three.js
loads only when this page opens.

## How a visitor uses it

1. Read the steps on the screen, then try the interaction.
2. Tap the Napier portrait in the corner (on the tall screens the chat is already there). The
   chat starts with the screen's example conversation.
3. Tap a suggested question (outlined bubbles) or type your own in "Ask Napier…" (up to 200
   characters, any language).
4. His reply appears word by word. He remembers the last few messages.
5. After 60 seconds without a touch, the screen asks "Still there?" and then returns to its own
   page and example conversation for the next visitor.

## How Napier answers

- The backend sends the question to an LLM (Groq, `openai/gpt-oss-20b`) with three things: who Napier
  is and how he speaks (`persona_chat.md`), the fact sheet he may draw on (`facts.md`), and what the
  visitor is looking at in this zone (`zones.json`).
- He may only state facts from the fact sheet. His life ends in 1617, so later events (the rods in
  China in 1628, the cabinet in Madrid, Leibniz's binary in 1703) are things he "has been told".
- Suggested questions also carry a short note on what to draw on, so their answers stay precise.
- Typed questions are cleaned and length-capped, and always reach the model as a visitor's question,
  never as instructions. Off-topic or unkind questions are steered back to the exhibit.
- If the backend can't be reached, a suggested question is still answered from Napier's notes
  (`fallback` in `js/zones.js`), marked "From Napier's notes". The status under his name reads
  "AI · online" (green dot) once the backend answers, "AI · waking…" before.

## Files in this folder

| File | Role |
|---|---|
| `index.html` | Landing, the screen (artwork, pager, avatar, chat panel, idle prompt) |
| `style.css` | The design's colours and sizes, all in design units (`--u`), so the layout matches the PNGs |
| `js/zones.js` | The three sets: pages, titles, footers, example conversations, suggested questions + offline answers. Question ids must match the backend's `zones.json` |
| `js/art.js` | Draws each page as SVG with the design's coordinates (rods, plates, floor grid, arrows) |
| `js/chat.js` | AI Napier's panel: example conversation, suggested questions, typed questions, word-by-word replies, errors |
| `js/api.js` | Backend URL (local or Render), fetch with a 75 s timeout and friendly errors |
| `js/main.js` | Picks the set and page from the URL, paging, mounting page 7's 3D viewer, online status, kiosk mode, the idle reset |
| `js/rodbox.js` | Page 7: the 3D set — unpack/pack on double-tap, drag any piece |
| `models/rod-box.json` | Tray, case and lid meshes exported from my Fusion model (`napiers rods.3mf`), in millimetres |
| `vendor/three-napier.min.js` | three.js r186 (MIT), only the classes used, bundled with esbuild |
| `images/napier-avatar.jpg` | The avatar, cropped from the 1616 portrait (public domain) as in the UI package |

## Editing the content

- **Page titles, footers, example conversations, suggested questions:** `js/zones.js`.
- **Drawings:** `js/art.js` (coordinates are the design's, 1500 units wide).
- **What a suggested question should draw on, and what the visitor is looking at:** the backend's `zones.json`.
- **New facts:** the backend's `facts.md`, with a source. Napier can't say what isn't there.
- **Pages 2–3 of the tall screens:** add them to `pages` in `js/zones.js` and a drawing in `js/art.js`;
  the page dots and arrows appear by themselves once a set has more than one page.

## How to run it locally

1. Start the backend (see its README): `python app.py` → http://127.0.0.1:5002
   (`MOCK_AI=1` in its `.env` gives canned replies without a Groq key).
2. In the portfolio folder: `python3 -m http.server 8000`
3. Open http://localhost:8000/napier/?zone=rods&page=2. The page talks to the local backend automatically.
   Port 8000 matters: it is on the backend's CORS list.

## Secrets

The frontend holds no secrets. The Groq API key and the database URL exist only as environment
variables on Render and in the backend's local `.env`, which git ignores.

## How I used AI

- **Claude** (Anthropic) wrote the code under my direction, for the Rod Box and for this exhibit
  version. My prompts are in [prompt_log.md](prompt_log.md).
- **Groq** (`openai/gpt-oss-20b`) writes Napier's replies live, from the fact sheet.
- AI use in the 51-265 studio project is with the instructor's permission and is disclosed here.

Facts were checked against the sources listed at the end of `facts.md`. Claude once invented a
fact (that Henry Briggs "rode four days" to meet Napier), which is why Napier may only answer from
the fact sheet.

## Credits

- Portrait of John Napier (1616), public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:John_Napier_(mathematician))
- Typeface: Georgia; Gelasio by Eben Sorkin (Google Fonts, SIL Open Font License) where Georgia isn't installed
- 3D: [three.js](https://threejs.org) (MIT); the tray, case and lid are my own CAD model
- Screen design: the exhibit's screen UI package (Rhino model `posner center latest.3dm`, 2026-11-11)
- Facts: MacTutor History of Mathematics; Wikipedia (Napier's bones, Promptuary, Location arithmetic);
  Museo Arqueológico Nacional via Google Arts & Culture; Kolpas & Tomash, MAA Convergence (2018)

---

### Architecture

```
exhibit screen (GitHub Pages, this folder, ?zone=…)
   │  GET  /health     wake Render's free server as the page opens (and every 10 min in kiosk mode)
   │  POST /chat       {zone, preset}  or  {zone, question, history}
   ▼
Flask backend on Render (napier-backend)
   ├─ validates zone + preset id, or cleans the typed question (≤ 200 chars); 30 requests/min per IP
   ├─ prompt: persona_chat.md + facts.md + this zone's "where the visitor is standing" (system)
   │          + the last 6 messages + the question (and, for presets, what to draw on)
   ├─ Groq API → JSON {"reply"} → validated and trimmed (≤ 90 words)
   └─ database (Postgres on Neon): the question and reply are logged anonymously
```
