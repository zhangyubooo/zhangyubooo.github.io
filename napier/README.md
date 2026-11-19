# Ask Napier: the last portrait

**Live:** https://zhangyubooo.github.io/napier/
**Backend code:** https://github.com/zhangyubooo/napier-backend
**Prompt log:** [prompt_log.md](prompt_log.md)

---

## What it is

A prototype of the last station of *Making Calculation Visible*, my exhibit design on John
Napier's *Rabdologia* (1617) for CMU's Posner Center (51-265 Environments Studio, fall 2026).

After visitors have seen the real rods, used the rod stations, the promptuary wall and the
location-arithmetic floor, they reach Napier's 1616 portrait on a screen, with a keyboard on a
writing desk in front of it. Six numbered question rods stand to the left of the portrait, the conversation to the right: press a number
to ask that rod's question, or type a question of your own. Napier writes back, letter by letter,
and the conversation builds up beside the painting like an exchange of letters.

**Why at the end, and why one screen.** The professor's feedback was that screens compete with the
objects for attention, so the screens beside the stations were dropped. AI Napier moved to the end,
where visitors have questions to ask and the objects are behind them. It stays a conversation you
type, because talking to him is the point; there is no touch screen and no mouse, only the keyboard.

## How to use it

1. Press **1–6** to ask one of the question rods (the rod lights up and Napier answers).
2. Or just start typing and press **Enter**. Once you have started typing, digits are just digits.
3. **Esc** clears the line; on an empty line it starts the conversation over.
4. Every key goes to the writing line; nothing needs clicking. Chinese and other input methods work,
   and Napier answers in the language he is written to.
5. After 75 seconds without a key the station asks "Still there?" and starts over, so one visitor's
   conversation is never left for the next. Any key keeps it.

For the gallery: open `?kiosk=1` in a full-screen browser (Chrome `--kiosk`). The link back to the
portfolio and the mouse pointer are hidden, and the backend is pinged every 10 minutes so it doesn't
fall asleep. The page is drawn at 1920 × 1080 and scales to any screen.

## The keyboard station

- Any USB keyboard works. A compact one without a number pad or function row is best; fix it to the
  desk. The number row is what the rods use.
- On a Mac, set the keyboard's Command key to "No Action" (System Settings → Keyboard → Keyboard
  Shortcuts → Modifier Keys) so visitors can't quit the browser; on Windows use assigned access.
- Optional: label keys 1–6 with the rods' numerals, or make a brass "Ask" button that is really an
  Enter key (an Arduino Leonardo can act as a keyboard).

## The six question rods

| Key | Question |
|---|---|
| 1 | Why did you make the rods? |
| 2 | Why didn't the promptuary catch on? |
| 3 | Is your chessboard really binary? |
| 4 | What are you proudest of? |
| 5 | Are you really a warlock? |
| 6 | What would you make of my century? |

Each rod has an offline answer written from the fact sheet (`fallback` in `js/questions.js`), so the
station still answers without a connection, marked "From Napier's notes". A typed question is
matched by keywords to the nearest rod's answer; if nothing matches, Napier asks to be asked about
his devices.

## How Napier answers

- The backend sends the question to an LLM (Groq, `openai/gpt-oss-20b`) with who Napier is and how he
  speaks (`persona_chat.md`), the fact sheet he may draw on (`facts.md`), and where the visitor is
  (`zones.json`, zone `portrait`: the end of the exhibit). Each rod also carries a short note on what
  its answer should draw on.
- He may only state facts from the fact sheet; his life ends in 1617, so later events are things he
  "has been told". Legends are told as legends.
- He remembers the last few questions of the visit. Typed questions are cleaned, length-capped and
  always reach the model as a visitor's question, never as instructions.

## Files in this folder

| File | Role |
|---|---|
| `index.html` | The station: framed portrait, the conversation and writing line, the rods, idle prompt |
| `style.css` | Exhibit colours around a gilded frame; everything in design units (`--u`) |
| `js/questions.js` | The six rods (ids match the backend's `portrait` presets), offline answers, greeting |
| `js/main.js` | The keyboard (1–6, typing, Enter, Esc), the conversation, asking Napier, idle reset |
| `js/inscription.js` | Napier's reply appears letter by letter |
| `js/dust.js` | Dust drifting through the light in the painting |
| `js/api.js` | Backend URL (local or Render), fetch with a 75 s timeout and friendly errors |
| `images/napier-portrait.jpg` | The 1616 portrait (public domain) |

## How to run it locally

1. Start the backend (see its README): `python app.py` → http://127.0.0.1:5002
   (`MOCK_AI=1` in its `.env` gives canned replies without a Groq key).
2. In the portfolio folder: `python3 -m http.server 8000`
3. Open http://localhost:8000/napier/. The page talks to the local backend automatically.

## Secrets

The frontend holds no secrets. The Groq API key and the database URL exist only as environment
variables on Render and in the backend's local `.env`, which git ignores.

## History of this folder (all in git)

- **Napier's Rod Box** (15-113 Project 2, Oct 2026): sixteen question rods presented to the portrait,
  with a three.js packing animation. This station grew out of it.
- **Exhibit screens** (11–12 Nov 2026): a screen beside every station (rods 2–7, rod 15, rod 16) with
  how-to pages and a Napier chat. Dropped after the 17 Nov feedback; see commit "upgrade 2.0 v3".
- **Rod-and-slot station** (17 Nov 2026): drag a rod into a slot under the portrait, answer on a tablet
  in the frame. Replaced the same day by the keyboard conversation.

## How I used AI

- **Claude** (Anthropic) wrote the code under my direction. My prompts are in [prompt_log.md](prompt_log.md).
- **Groq** (`openai/gpt-oss-20b`) writes Napier's answers live, from the fact sheet.
- AI use in the 51-265 studio project is with the instructor's permission and is disclosed here.

## Credits

- Portrait of John Napier (1616), public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:John_Napier_(mathematician))
- Typefaces: IM Fell English by Igino Marini; Gelasio by Eben Sorkin (Google Fonts, SIL Open Font License); Georgia
- Facts: MacTutor History of Mathematics; Wikipedia (Napier's bones, Promptuary, Location arithmetic);
  Museo Arqueológico Nacional via Google Arts & Culture; Kolpas & Tomash, MAA Convergence (2018)
