# Prompt log — Forbes Crossing

**Tools and models**

| Phase | Tool | Model |
|---|---|---|
| In-class sprint (30 min) | Kiro | whatever Kiro ships with by default — I did not change the setting |
| Finishing at home | Claude desktop app, Cowork mode, linked to the local repo folder | `claude-opus-5` (Claude Opus 5) |

**A note on language.** I typed my prompts in Chinese. They appear below
translated into English, marked as translations rather than presented as the
literal strings I sent — a faithful translation of what I asked, not a
paraphrase of it. The original Chinese is still in my chat history if it is
needed. Where a section describes what happened rather than quoting a prompt,
it says so.

---

## Part 1 — in-class sprint (Kiro)

**A note on this section.** I did not export the Kiro session before the class
ended, and the history was gone by the time I sat down to write this log. So
this part is an account of what I did, not a copy-paste of the exact strings I
typed. I would rather say that plainly than reconstruct quotes I cannot verify.

What the 30 minutes actually looked like: one long opening prompt, written the
way the exercise invites you to write it — describe the whole game, ask for the
whole game. Crossy Road, a character hopping forward one grid cell at a time,
traffic moving across lanes, collision kills you, score counts the rows you
advance. Then the rest of the session was spent reacting: it runs / it doesn't
run, the character doesn't move, the cars don't move, make the cars move.

Where it stood when time was called: something that loaded and drew a grid, with
movement roughly working, and nothing that could be called a game — no real
collision, no difficulty, no failure states, nothing that read as a place.

That outcome is the reason for the decision at the top of Part 2. Thirty minutes
of one-shot prompting gets you a program; it does not get you a design. When I
picked it up at home I did not try to repair that code. I deleted it and started
from an empty folder, because debugging generated code you did not design costs
more than writing it again with a plan.

---

## Part 2 — finishing at home (Claude Opus 5, Cowork)

### Prompt 1 — setting the task and the constraints

I pasted the full assignment text into the model, then added this line at the
end:

```
[translated from Chinese]
Given all of the above, I've decided to stop using Kiro. Connect directly to
my local files and do this homework that way.
```

That one line fixed two things. First, that I was abandoning the in-class code
and rewriting from scratch. Second, that the model would edit the files inside
my `zhangyubooo.github.io` repo on my laptop directly, instead of printing code
into a chat window for me to copy out.

The assignment text itself was the most detailed spec available — static only,
has to run on GitHub Pages, needs its own folder and README, has to link back to
the portfolio — so I didn't restate the requirements in my own words.

### Prompt 2 — three decisions

The model didn't start writing immediately; it asked three questions first.
My answer:

```
[translated from Chinese]
Repo location: under ~/Documents
Game theme: a CMU campus version
How I want to work: write the whole thing, then walk me through it section by
section
```

The theme was the single most important decision in this assignment. The brief
says to *make it yours*, so I didn't want a straight Crossy Road clone — I asked
for the setting to become CMU: crossing Forbes Ave, cutting across the Cut,
working around the construction that never seems to finish.

The third line matters for a different reason. I asked to be walked through the
code afterwards rather than to write it line by line, because I have to be able
to explain every decision in the project interview, and reviewing finished code
with someone explaining it is a faster way to understand a system than typing it
out is.

### What happened after that

_This section is my own description of the process, not a quoted prompt._

From here I stopped issuing instructions one at a time — the model worked through
the two constraints above on its own, taking screenshots in a headless Chromium
as it went, spotting problems and fixing them. I'm recording what it changed and
why, because these trade-offs are the real content of the assignment:

1. **First version: cells too small, projection too spread out.** The same scale
   factor was used horizontally and vertically, so on a wide screen you could see
   twenty-plus rows at once. The whole image broke up into noise and the
   character was impossible to find.
   → Changed so horizontal scale is set by screen width and vertical scale by
   screen height, giving a fixed 9 columns × roughly 9 rows on any screen.

2. **Second version: the map edges were built as one continuous wall.** Stacked
   over several rows it read as a ridge line, and it drew more attention than the
   road did.
   → Went back to two cells of trees/planters on each side — the edge is
   *planted* rather than *built*.

3. **Third version: the four ground types were too close in value.** Grass and
   pavement blurred together, so the player couldn't tell what was safe to stand
   on and what would kill them.
   → Pulled the four surfaces apart into four distinct steps of lightness (plaza
   lightest, grass mid-grey, road dark, construction trench near-black).

4. **The character was invisible.** A white figure standing on the light plaza
   disappeared entirely.
   → Draw a slightly larger dark box underneath the body first, as an outline.

5. **You could hit an obstacle on your very first move.** Obstacles were spawning
   directly in front of the start, which reads as the game being broken rather
   than as a mistake you made.
   → Force column 0 clear for the first three rows, and generate no trenches or
   bus lanes in the first 8 rows.

Four of those five are legibility problems, not logic problems. The game logic
was close to right early; what took the time was making the screen say what the
logic already meant.

---

## What I decided, and what the model decided

_This section is my own description, not a quoted prompt._

I should be exact about this, because "I used AI to build a game" can mean very
different things. I did not hand-edit `game.js`. What I contributed was every
decision above the code:

- **Abandoning the in-class version.** The model was never asked to evaluate the
  Kiro output; I decided on my own that thirty minutes of one-shot prompting had
  produced something not worth repairing, and instructed a rewrite from zero.
- **The CMU setting, and every object in it.** Forbes Ave, the construction
  trenches with steel road plates instead of Crossy Road's river and logs, the
  61C on its own lane, Walking to the Sky at the start line, TARTANS and SCOTTY
  vans, CMU Police. None of that was proposed to me — I asked for a campus game
  and then specified what a campus contains.
- **The win condition.** Crossy Road cannot be won; it only ends. Seven coffees
  and you have made it to class was my addition, and it changes what the game is
  about: not survival distance, but detouring off the safe line to collect
  something, which is a different risk calculation on every row.
- **The squirrel.** An anti-camping rule was needed, since standing still is
  otherwise strictly safe. I did not want an abstract timer, so the punishment
  became a campus animal, scaled comically large.
- **The visual system.** Black, grey, white and one CMU red, matching the rest of
  this portfolio — so the game is continuous with the site instead of a widget
  parked inside it.
- **Working mode.** Write it all, then explain it to me section by section, on
  the condition that I understand every part well enough to defend it.

The model contributed the implementation and, in the five cases listed above, the
diagnosis — it caught the legibility failures by screenshotting its own output,
which is something I would have caught slower by playing.
