# Prompt log — Napier's Rod Box (15-113 Project 2)
## Tools

| Tool | Used for | Why this tool |
|---|---|---|
| Claude (Cowork, desktop app; model `claude-opus-5-5`) | Translating the brief, brainstorming, design discussion, writing the first version of the backend and frontend, fact-checking against web sources, browser screenshot tests | Wrote and tested the code from my design decisions |
| Groq API, `openai/gpt-oss-20b` | Runs inside the app: writes Napier's inscription + motto | Reused from HW4 (Ask Yubo), where Gemini was blocked |
| VS Code | Editing the code by hand (commit `9841bf0`: lid position, flight arc and duration, dust count) and reading the files Claude wrote | To make and check my own changes by hand |

## Time log

About 1.5 hours a day on average, roughly 9 hours in total.

| Date | What | Hours |
|---|---|---|
| Wed 9/30 | Earlier exploration: a gesture-controlled Napier's rods calculator (MediaPipe). Planned, then dropped in favour of the portrait idea | ~1.5 |
| Thu 10/1 | Read the brief, brainstormed directions, settled the design (prompts 1–9) | ~1.5 |
| Sat 10/3 | First full build: backend + frontend + local tests (prompt 10); real portrait, first real Groq test, 16 rods + bone set (prompts 11–14) | ~1.5 |
| Sun 10/4 | Deployed: backend to Render, frontend to GitHub Pages; Neon discussed; numerals on the 3D rods (prompts 17–19); midpoint check-in | ~1.5 |
| Tue 10/6 | Skip experience, requirements check, rod flight + case label + dust, portfolio card, lid fix (prompts 20–24); my own edits in VS Code (commit `9841bf0`) | ~1.5 |
| Wed 10/7 | README and prompt log, demo video, submission (prompts 25–30) | ~1.5 |

---

## Phase 1 — Choosing the idea (Thu 10/1)

**Prompt 1** — pasted the whole Project 2 brief:
> Suggest some possible ideas: 15113 project 2 [full assignment text pasted here]

Result: translation + five ideas. I liked "a conversation with John Napier" because it could serve my studio exhibit.

**Prompt 2**
> The interactive character idea, "a conversation with John Napier", is quite interesting. Are there other ideas that could serve my exhibit?

**Prompt 3** — after checking with my studio instructor that AI is allowed:
> What other ideas do you have?

**Prompt 4** — the key design constraint:
> I still think talking with Napier would be interesting, but how should it be shown? I don't want it to be a chat AI.

Result: five ways to show the character without a chat interface (letters, a living portrait, marginalia, question cards, answering by calculation).

**Prompt 5**
> I think the combination you described is good. I like asking through question cards: you draw a question card, and Napier answers once he receives it. But for the idea of working it out on the rods, how would a question be turned into a calculation? Actually, I quite like the feeling of Napier's oil portrait coming alive. What do you think?

**Prompt 6** — cutting what doesn't fit an exhibit:
> I don't want eye tracking, and no voice output either, because voice output doesn't really suit an exhibition. What else could we do?

**Prompt 7**
> For how the answer appears, use an inscription written into the painting. Would making the memory "visible" be too hard? And does this meet the 113 technical requirements?

**Prompt 8** — keeping art production small:
> I don't think objects need to appear. Find a way to design the question cards so that once a question is asked, the card gets displayed, or some other form. I don't want too much art work.

Result: question cards shaped like Napier's rods; once asked, a rod is carved with a motto and stored in a rod box under the portrait.

**Prompt 9**
> Let's go with the first one.

**My decisions in this phase:** no voice output, because spoken answers don't suit an exhibit space; and no text box, because visitors don't know what to ask — so they choose from question cards instead.

## Phase 2 — First build (Sat 10/3)

**Prompt 10**
> Let's start building.

What Claude produced (first version, before my own changes):
- Backend `napier-backend/`: Flask app with `/health`, `/visitor/<id>`, `/ask`; `persona.md` (who Napier is, output format), `facts.md` (fact sheet with sources), `cards.json` (the twelve rods), `storage.py` (SQLAlchemy: SQLite locally, Postgres on Render).
- Frontend `napier/`: portrait with CSS-only motion, rod tray, rod box, inscription animation, error states.
- Tested with a mock AI mode and headless-browser screenshots at desktop and phone sizes.

## Phase 3 — Real portrait, first real test, 16 rods (Sat 10/3, evening)

**Prompt 11** — sent the 1616 portrait image:
> Here is the portrait. Tell me what commands to type in the two terminals to test locally.

Result: the portrait was placed in `images/`. Because the real painting already has lettering at the top and his face sits high, the inscription moved from the top of the canvas to a painted tablet at the foot of the frame.

**Prompt 12** — after running both terminals locally, with a screenshot of the first real Groq answer:
> So it's working now, right?

Result: yes — the full chain worked (page → Flask → Groq → SQLite → box). Two issues spotted in the screenshot: the answer claimed the rods give "the product of any two numbers" (overstated), and the old greeting's ghost overlapped the new inscription.

**Prompt 13** — design changes:
> Fix the two small issues. Then add 4 more questions to make 16, because a real set has 16 rods. Lay the 16 question rods horizontally so the text on them is easier to read. Once all are asked, the rods in the box can be packed into a real set of rods.

**Prompt 14** — bug report while that was being built:
> Right now there's a bug: after all 12 are asked, the twelfth one doesn't disappear.

Result: rod XII/XVI ("What do you remember of me?") had been designed to stay in the tray so it could be re-asked, which looked like a bug and meant the box never felt finished. Now it is locked until the other fifteen are asked, and leaves the tray like the others. Also: four new rods (Reading Rods, The Point, Merchiston, The Pigeons), tray rods lie flat in two columns, and a full box can be bound into a printable set of Napier's bones (`js/bones.js`). The fact sheet now says exactly how the rods are read (one digit of the multiplier at a time).

**Prompt 15** — with my CAD model of the real set attached (`napiers rods.3mf`: a tray, sixteen rods and a case with a sliding lid):
> First, the rods listed in the box after being asked should have no text on them, and make sure one row of the box fits all the rods. Second, the binding effect looks very bad; the numbers are all jumbled. Drop the version with numbers on it. Instead, just make an animation that packs the rods and puts them into the case. The file is my model of the real set: a tray, sixteen rods and a lid. It can help you understand how the rods are packed.

Result: the box now has sixteen places in one row and the rods carry no text (rods keep the real 1:10 proportions, 5.3 × 53.3 mm). The printable "bone set" was removed. In its place, `js/packing.js` loads the tray, case and lid from my model (converted to `models/rod-box.json`) and animates the packing in three.js: rods tip over onto the tray one by one, the tray stands up and slides into the case, and the lid slides shut along its groove. Positions come from measuring the model (e.g. case cavity 96 × 9.2 × 57.8 mm, the tray 95.1 × 57.5 × 7.5 mm, lid groove at the top).

**Prompt 16**
> The rods in the box should still carry their question's numeral after being asked. The pack animation is good. Make the "Begin as a new visitor" button more visible; it can be its own button under the box.

Result: rods in the box carry their Roman numeral again (stacked letter over letter so it fits a rod 1/10 as wide as it is tall); "Begin as a new visitor" moved from the footer to a real button under the box, next to "Pack the set". It still needs a second click, and turns red while waiting for it.

## Phase 4 — Deploying (Sun 10/4, early morning)

**Prompt 17**
> Let's start deploying. I'll check the details tomorrow and fix them then.

Result: backend committed and published from GitHub Desktop, deployed on Render. `napier-backend.onrender.com` turned out to belong to someone else (it answered `{"detail":"Not Found"}`, a FastAPI-style error, not our Flask one), so Render gave the service `napier-backend-prtd.onrender.com`; `js/api.js` was pointed there.

**Prompt 18**
> What is Neon? Do we need to connect it?

Result: Render's free tier wipes the server's disk whenever it sleeps (after 15 idle minutes), restarts or redeploys, so the SQLite file — and every visitor's box — disappears. Neon is a free, permanent Postgres host; `storage.py` already switches to it when `DATABASE_URL` is set. Decided to connect it after the check-in.

**Prompt 19**
> Put the box numerals on the front of the rods in the pack animation too.

Result: each 3D rod's front face now carries its Roman numeral, drawn on a canvas (1:10 like the rod) and used as a texture on the +z face of the box geometry; the camera moved slightly closer so the numerals read.

## Phase 5 — After the midpoint check-in

**Prompt 20**
> To the right of the Backend code and Frontend code links, add a "Skip experience" that jumps straight to the point where the visitor has asked everything, with all the rods in the box, and goes directly to packing.

Result: a "Skip experience →" link next to the code links. It fills every empty place in the box with an unanswered rod (shown faded; opening one says it was skipped), keeps any rods already answered, and starts the packing animation. It never calls the server, so a reload shows the visitor's real box again — a shortcut for reviewers that doesn't spend sixteen AI calls or fake Napier's answers.

**Prompt 21** — after asking whether the project meets the Project 2 requirements and what visual improvements could be added (Claude listed five; I chose three):
> Do 1, 2 and 3.

Result:
1. `js/flight.js`: after Napier answers, the rod flies from the tray (lying flat) into its own place in the box (standing up), using the FLIP technique: measure the start and end positions, animate a stand-in between them, then reveal the real rod.
2. Packing finale: a paper label ("Napier's Bones · sixteen rods, packed by a visitor · today's date") fades onto the front of the closed case, and a "Save a picture" button downloads a PNG of the packed case.
3. `js/dust.js`: dust motes drift through the light in the portrait, brightest along a diagonal shaft of light; paused when off-screen or for reduced motion.

**Prompt 22** — the portfolio card:
> The Napier card on the homepage is for the whole project. For now, add a separate card for this web app, marked as part of that larger project, and I'll merge them once the larger project is done.

Result: a separate "Napier's Rod Box" card at the top of the portfolio, tagged "Part of Hybrid Exhibition: Napier", with a cover screenshot of the real interface. The exhibition card stays as it is; the two will be merged when the exhibition is finished.

**Prompt 23**
> I didn't see the packing label animation you added earlier.

Result: the label was live and works (checked with screenshots after "Skip experience"); it appears only after the lid has fully closed, about ten seconds in, and an old cached copy of `packing.js` can hide it — a hard refresh fixes that.

**Prompt 24** — a correction to the packing animation:
> One more thing: in the animation, the case's lid hangs in mid-air waiting. It should start on the ground, and only after the rods are in should it rise and slide in.

Result: the lid now starts lying flat on the table beside the case. Once the tray is in, it is lifted (straight up first, then across, like a hand picking it up), lined up with the groove, and slid shut. The packing now takes 10.6 s instead of 9.5 s.

## Where AI got it wrong

**The example I chose: 1.** The others are also listed for the record.

1. **An invented fact in the card mottos.** While drafting the twelve cards, Claude wrote a motto for rod V saying Henry Briggs "rode four days" to meet Napier. When the fact sheet was checked against MacTutor, nothing supported the four days; what the sources do record is the quarter-hour of silent admiration. The line was cut and the motto rewritten. This is exactly why Napier may only speak from `facts.md`.
2. **A layout bug the AI wrote and only found by looking.** The first CSS made the page wider than a phone screen: the tray of twelve rods stretched the grid column (a CSS grid item's minimum width defaults to its content). It only showed up in the phone screenshot; fixed with `minmax(0, 1fr)` columns.
3. **Overstating what the rods do (found in the first real Groq answer).** Napier's inscription for rod I said a simple addition of diagonals "gives the product of any two numbers". The rods actually multiply a many-digit number by one digit per reading; a many-digit multiplier needs one reading per digit and an addition of the partial results. The model wasn't inventing a fact so much as stretching a vague line in the fact sheet, so the fix was to make `facts.md` precise (with the 425 × 6 example) rather than to argue with the model.
4. **A refactor that deleted two functions it still needed.** While swapping the bone set for the packing animation, Claude replaced a block of `main.js` by slicing between two comments, and the slice also contained `setPlaque()` and `showPortrait()`. The page loaded with no visible error, but clicking a rod did nothing. The headless-browser test caught it (`setPlaque is not defined` in the console) and the functions were restored. Lesson: an edit that "looks" small can remove more than intended; run the click-through test after every change.

## My own changes

All four are in commit `9841bf0` ("self fix"), edited by hand.

| Date | File | What I changed (before → after) | Why |
|---|---|---|---|
| Tue 10/6 | `js/packing.js` | `LID_ON_TABLE`: `(210, 20, 1.65)` → `(250, 5, 1.65)` — where the lid lies on the table before it is picked up (x, y in mm; 1.65 = half the lid's 3.3 mm thickness, so it rests on the table) | Further from the tray's path to the case, so the table reads less crowded |
| Tue 10/6 | `js/flight.js` | Arc height of the rod's flight into the box: `70` → `120` px — the rod now rises higher before dropping into its place | A higher arc makes the flight easier to follow with the eye |
| Tue 10/6 | `js/flight.js` | Flight duration: `950` → `1000` ms | A little slower, so the higher arc doesn't feel rushed |
| Tue 10/6 | `js/dust.js` | `COUNT`: `60` → `80` dust motes in the portrait's light | More motes make the shaft of light in the portrait show up better |

**A problem I found in the packing animation (fixed in commit `30926c9`).** While watching the animation I noticed the lid was floating in mid-air beside the case the whole time, waiting to slide in. A real lid would lie on the table. I decided how it should work instead: the lid starts flat on the table, and only after the rods and tray are in the case is it lifted, lined up with the groove and slid shut. Claude wrote the code for it (prompt 24); I then tuned where the lid lies (the `LID_ON_TABLE` row above).
