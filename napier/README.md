# Ask Napier: the last portrait

**Live:** https://zhangyubooo.github.io/napier/
**Backend code:** https://github.com/zhangyubooo/napier-backend
**Prompt log:** [prompt_log.md](prompt_log.md)

---

## What it is

A prototype of the last station of *Making Calculation Visible*, my exhibit design on John
Napier's *Rabdologia* (1617) for CMU's Posner Center (51-265 Environments Studio, fall 2026).

After visitors have seen the real rods, used the rod stations, the promptuary wall and the
location-arithmetic floor, they reach Napier's 1616 portrait, projected on the wall of the south
waiting area. Six question rods are projected to its left, the conversation to its right. A camera
watches for hands and a microphone listens. Nothing to touch:

- **Point at a rod and hold** for a second: Napier answers that rod's question.
- **Raise your hand and ask aloud**, then lower it: what you said is written down, shown, and
  Napier answers it.

Napier writes back, letter by letter, and the conversation builds up beside the painting like an
exchange of letters.

**Why this form.** The professor's feedback was that screens compete with the objects for
attention, so the screens beside the stations were dropped and AI Napier became one station at the
end, where visitors have questions and the objects are behind them. A keyboard didn't make sense
in a gallery either, so the station uses what everyone already does: point at what you mean, and
raise your hand to ask a question. Projection keeps it in the same language as the promptuary wall
and the location-arithmetic floor.

**What this prototype tests.** The exhibit has a physical-interaction prototype (the Arduino rods)
and a spatial-projection prototype (location arithmetic). This one tests the conversation: what
visitors ask, how Napier answers, and whether pointing and raising a hand are understood without
instructions. It runs on any computer, with the webcam and microphone standing in for the
gallery's camera and microphone, and full screen standing in for the projection.

## How to use it

1. Open the page and press **Begin**; allow the camera and the microphone.
2. **Point** (index finger out, other fingers curled) at a rod. A ring follows your finger; hold it on
   a rod until the bar fills.
3. **Raise an open hand** and keep it up while you speak. The bar turns orange and shows your voice.
   **Lower your hand** to send. Napier shows what he heard ("You asked"), then answers. Any language
   works; he answers in the language he is asked in.
4. After a minute with no hands in view the station asks "Still there?" and starts over, so one
   visitor's conversation is never left for the next. Raising a hand keeps it.

The little camera view under the rods shows the hands being read (orange when a gesture is
recognised). Video is read in the browser and never leaves the computer; only the spoken question
is sent, to be written down, and the recording is not kept.

**Testing without a camera** (not shown to visitors): **1–6** ask a rod, **hold Space** to speak,
**/** to type a question, **Esc** starts over, **V** makes Napier read his answers aloud
(`?voice=1` turns that on from the start; off by default so the station doesn't fill the hall
with sound).

**In the gallery:** open `?kiosk=1` full screen (Chrome `--kiosk --autoplay-policy=no-user-gesture-required`,
with camera and microphone allowed for the site). It starts without the Begin card, hides the
mouse pointer and the link back, and pings the backend every 10 minutes. The page is drawn at
1920 × 1080 and scales to any projector.

## In the gallery (the station as designed)

- Projector on the wall of the south-waiting-area corner, beside the location-arithmetic projection.
- A webcam (wide angle, 1080p) above or below the projection, aimed at where a visitor stands,
  about 1.5–2.5 m away; the hands should be lit from the front.
- A directional microphone above the standing spot, so the hallway is quieter than the visitor.
  Listening only happens while a hand is raised, so the station never records conversations
  around it.
- A floor mark showing where to stand.

## The six question rods

| Rod (key for testing) | Question |
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
his devices. Spoken questions need the connection (to be written down); offline, the station asks
visitors to point at a rod instead.

## How Napier answers

- The backend sends the question to an LLM (Groq, `openai/gpt-oss-20b`) with who Napier is and how he
  speaks (`persona_chat.md`), the fact sheet he may draw on (`facts.md`), and where the visitor is
  (`zones.json`, zone `portrait`: the end of the exhibit). Each rod also carries a short note on what
  its answer should draw on.
- He may only state facts from the fact sheet; his life ends in 1617, so later events are things he
  "has been told". Legends are told as legends.
- He remembers the last few questions of the visit. Spoken (and typed) questions are cleaned,
  length-capped and always reach the model as a visitor's question, never as instructions. He knows
  the machine that writes them down sometimes mishears.

## How hands and voice are read

- **Hands:** MediaPipe Hand Landmarker (Google), loaded from a CDN and run in the browser on the
  webcam image: 21 points per hand, up to two hands. `js/gestures.js` turns them into two gestures:
  *point* (index finger out, the other three curled: its tip becomes the pointer) and *palm* (all four
  fingers out and the hand upright). A palm must be held ½ second before listening starts, and gone
  for ⅔ second before it stops, so a flicker doesn't cut a question off.
- **Voice:** the browser records while the palm is up (`MediaRecorder`, at most 15 s), sends the
  recording to the backend's `/transcribe`, and Whisper (`whisper-large-v3-turbo` on Groq) writes it
  down. Very short takes, silence and Whisper's usual phantom phrases ("Thank you.") count as
  nothing said. The recording is not stored; the written question is logged like any other.

## Files in this folder

| File | Role |
|---|---|
| `index.html` | The station: rods + camera view, framed portrait, conversation + listening bar, Begin card, idle prompt |
| `style.css` | Exhibit colours around a gilded frame; everything in design units (`--u`) |
| `js/questions.js` | The six rods (ids match the backend's `portrait` presets), offline answers, greeting |
| `js/main.js` | Pointing at rods, raising a hand to speak, the conversation, asking Napier, testing keys, idle reset |
| `js/gestures.js` | Hand landmarks → point / palm, the pointer position, raise and lower events |
| `js/hands.js` | Camera + microphone permission, MediaPipe Hand Landmarker, the camera view with the hand drawn on it |
| `js/voice.js` | Recording a spoken question, the voice wave, Napier reading aloud (optional) |
| `js/inscription.js` | Napier's reply appears letter by letter |
| `js/dust.js` | Dust drifting through the light in the painting |
| `js/api.js` | Backend URL (local or Render), `/chat`, `/transcribe`, a 75 s timeout and friendly errors |
| `images/napier-portrait.jpg` | The 1616 portrait (public domain) |

## How to run it locally

1. Start the backend (see its README): `python app.py` → http://127.0.0.1:5002
   (`MOCK_AI=1` in its `.env` gives canned replies without a Groq key).
2. In the portfolio folder: `python3 -m http.server 8000`
3. Open http://localhost:8000/napier/. The page talks to the local backend automatically.
   Browsers allow the camera and microphone on `localhost` and on https (GitHub Pages) only.

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
- **Keyboard station** (17 Nov 2026): a screen and a keyboard; press 1–6 for a rod or type. Replaced on
  19 Nov by pointing and speaking, after the professor felt a keyboard didn't belong in the gallery.

## How I used AI

- **Claude** (Anthropic) wrote the code under my direction. My prompts are in [prompt_log.md](prompt_log.md).
- **Groq** (`openai/gpt-oss-20b`) writes Napier's answers live, from the fact sheet; Whisper on Groq
  writes down spoken questions.
- **MediaPipe** Hand Landmarker (Google, Apache 2.0) reads hands in the browser.
- AI use in the 51-265 studio project is with the instructor's permission and is disclosed here.

## Credits

- Portrait of John Napier (1616), public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:John_Napier_(mathematician))
- Typefaces: IM Fell English by Igino Marini; Gelasio by Eben Sorkin (Google Fonts, SIL Open Font License); Georgia
- Facts: MacTutor History of Mathematics; Wikipedia (Napier's bones, Promptuary, Location arithmetic);
  Museo Arqueológico Nacional via Google Arts & Culture; Kolpas & Tomash, MAA Convergence (2018)
