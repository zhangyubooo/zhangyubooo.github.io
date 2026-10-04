# Prompt log — Napier's Rod Box (15-113 Project 2)

> **TODO (Yubo):** keep adding entries as you work — every session, every hand edit. Prompts are
> pasted verbatim (most were written in Chinese; that is the original wording). Lines marked ✍️
> need your own words.

## Tools

| Tool | Used for | ✍️ Why this tool |
|---|---|---|
| Claude (Cowork, desktop app; model `claude-opus-5-5`) | Translating the brief, brainstorming, design discussion, writing the first version of the backend and frontend, fact-checking against web sources, browser screenshot tests | |
| Groq API, `openai/gpt-oss-20b` | Runs inside the app: writes Napier's inscription + motto | Reused from HW4 (Ask Yubo), where Gemini was blocked |
| ✍️ (add anything else: VS Code, ChatGPT for debugging, etc.) | | |

## Time log

| Date | What | Hours |
|---|---|---|
| Wed 9/30 | Earlier exploration: a gesture-controlled Napier's rods calculator (MediaPipe). Planned, then dropped in favour of the portrait idea | ✍️ |
| Thu 10/1 | Read the brief, brainstormed directions, settled the design (prompts 1–9) | ✍️ |
| Sat 10/3 | First full build: backend + frontend + local tests (prompt 10); real portrait, first real Groq test, 16 rods + bone set (prompts 11–14) | ✍️ |
| ✍️ | | |

---

## Phase 1 — Choosing the idea (Thu 10/1)

**Prompt 1** — pasted the whole Project 2 brief:
> 翻译，并说说可能的idea: 15113 project 2 [full assignment text pasted here]

Result: translation + five ideas. I liked "a conversation with John Napier" because it could serve my studio exhibit.

**Prompt 2**
> "和 John Napier 对话"的互动角色这个挺有趣的，有没有别的可以服务于我的exhibit

**Prompt 3** — after checking with my studio instructor that AI is allowed:
> studio我已经和peter聊过了，可以使用ai，还有什么别的想法说说

**Prompt 4** — the key design constraint:
> 我还是觉得对话Napier这个会很有趣，但是怎么表现呢？我不想是聊天ai

Result: five ways to show the character without a chat interface (letters, a living portrait, marginalia, question cards, answering by calculation).

**Prompt 5**
> 我觉得你说的那个组合很好，我喜欢问题卡片的提问形式，可以是那种抽出问题卡片，然后napier收到之后进行回答，但是你说的用算筹算一遍，这个怎么根据问题翻译算式？其实我比较喜欢napier油画像能动的感觉。你怎么说？

**Prompt 6** — cutting what doesn't fit an exhibit:
> 我觉得不要视觉追踪，也不要语音输出，因为语音输出在展览里不太适合。还能怎么办

**Prompt 7**
> 回答出现，采用写进画里的铭文。对于记忆怎么"看得见"这个会不会太难了，而且目前技术上符合113吗

**Prompt 8** — keeping art production small:
> 我觉得不用出现物品，想办法把问题卡片设计成，问完问题之后就会被陈列出来，或者其他形式，我不想太多关于美术

Result: question cards shaped like Napier's rods; once asked, a rod is carved with a motto and stored in a rod box under the portrait.

**Prompt 9**
> 就第一种了

✍️ *My decisions in this phase, in my words (what I rejected and why: voice, eye tracking, objects in the painting, the calculation gimmick):*

## Phase 2 — First build (Sat 10/3)

**Prompt 10**
> 开始做吧

What Claude produced (first version, before my own changes):
- Backend `napier-backend/`: Flask app with `/health`, `/visitor/<id>`, `/ask`; `persona.md` (who Napier is, output format), `facts.md` (fact sheet with sources), `cards.json` (the twelve rods), `storage.py` (SQLAlchemy: SQLite locally, Postgres on Render).
- Frontend `napier/`: portrait with CSS-only motion, rod tray, rod box, inscription animation, error states.
- Tested with a mock AI mode and headless-browser screenshots at desktop and phone sizes.

## Phase 3 — Real portrait, first real test, 16 rods (Sat 10/3, evening)

**Prompt 11** — sent the 1616 portrait image:
> 这是那个肖像，然后你告诉我两个终端都输入什么指令来本地测试

Result: the portrait was placed in `images/`. Because the real painting already has lettering at the top and his face sits high, the inscription moved from the top of the canvas to a painted tablet at the foot of the frame.

**Prompt 12** — after running both terminals locally, with a screenshot of the first real Groq answer:
> 这样应该是跑通了吧？

Result: yes — the full chain worked (page → Flask → Groq → SQLite → box). Two issues spotted in the screenshot: the answer claimed the rods give "the product of any two numbers" (overstated), and the old greeting's ghost overlapped the new inscription.

**Prompt 13** — design changes:
> 两个小问题可以修掉，然后问题的话再加4个做到16个吧，因为实际rods就有16个。然后问的16个rods横着摆放，这样更好看清上面的字。全问完就可以把box里的rods打包成真正的rods

**Prompt 14** — bug report while that was being built:
> 现在的话，有一个bug12个问完，第十二个不会消失

Result: rod XII/XVI ("What do you remember of me?") had been designed to stay in the tray so it could be re-asked, which looked like a bug and meant the box never felt finished. Now it is locked until the other fifteen are asked, and leaves the tray like the others. Also: four new rods (Reading Rods, The Point, Merchiston, The Pigeons), tray rods lie flat in two columns, and a full box can be bound into a printable set of Napier's bones (`js/bones.js`). The fact sheet now says exactly how the rods are read (one digit of the multiplier at a time).

**Prompt 15** — with my CAD model of the real set attached (`napiers rods.3mf`: a tray, sixteen rods and a case with a sliding lid):
> 首先，问完之后列在box里的rods上不要文字，，保证box一行能直接放下所有rods。然后装订效果非常不好，数字都是乱的。不要上面是数字的。直接做一个动画就是把rods打包好，装进盒子里，文件里是我根据实际建模出来的，里面有一个托盘和十六个rods然后还有盖子。可以帮助你理解rods是怎么打包的。

Result: the box now has sixteen places in one row and the rods carry no text (rods keep the real 1:10 proportions, 5.3 × 53.3 mm). The printable "bone set" was removed. In its place, `js/packing.js` loads the tray, case and lid from my model (converted to `models/rod-box.json`) and animates the packing in three.js: rods tip over onto the tray one by one, the tray stands up and slides into the case, and the lid slides shut along its groove. Positions come from measuring the model (e.g. case cavity 96 × 9.2 × 57.8 mm, the tray 95.1 × 57.5 × 7.5 mm, lid groove at the top).

**Prompt 16**
> 问完box里的rods还是要带问题的数字的，pack的动画很好，那个begin as a new visitor的按钮再明显一点，可以放在box下面单独一个按钮

Result: rods in the box carry their Roman numeral again (stacked letter over letter so it fits a rod 1/10 as wide as it is tall); "Begin as a new visitor" moved from the footer to a real button under the box, next to "Pack the set". It still needs a second click, and turns red while waiting for it.

## Where AI got it wrong (candidates — ✍️ pick one and write the paragraph yourself)

1. **An invented fact in the card mottos.** While drafting the twelve cards, Claude wrote a motto for rod V saying Henry Briggs "rode four days" to meet Napier. When the fact sheet was checked against MacTutor, nothing supported the four days; what the sources do record is the quarter-hour of silent admiration. The line was cut and the motto rewritten. This is exactly why Napier may only speak from `facts.md`.
2. **A layout bug the AI wrote and only found by looking.** The first CSS made the page wider than a phone screen: the tray of twelve rods stretched the grid column (a CSS grid item's minimum width defaults to its content). It only showed up in the phone screenshot; fixed with `minmax(0, 1fr)` columns.
3. **Overstating what the rods do (found in the first real Groq answer).** Napier's inscription for rod I said a simple addition of diagonals "gives the product of any two numbers". The rods actually multiply a many-digit number by one digit per reading; a many-digit multiplier needs one reading per digit and an addition of the partial results. The model wasn't inventing a fact so much as stretching a vague line in the fact sheet, so the fix was to make `facts.md` precise (with the 425 × 6 example) rather than to argue with the model.
4. **A refactor that deleted two functions it still needed.** While swapping the bone set for the packing animation, Claude replaced a block of `main.js` by slicing between two comments, and the slice also contained `setPlaque()` and `showPortrait()`. The page loaded with no visible error, but clicking a rod did nothing. The headless-browser test caught it (`setPlaque is not defined` in the console) and the functions were restored. Lesson: an edit that "looks" small can remove more than intended; run the click-through test after every change.
5. ✍️ (add any others you find)

## ✍️ My own changes

| Date | File | What I changed and why |
|---|---|---|
| | | |
