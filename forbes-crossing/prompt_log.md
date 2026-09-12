# Prompt log — Forbes Crossing

## Models and tools

| Phase | Tool | Model |
|---|---|---|
| In-class sprint (30 min) | Kiro | _TODO: fill in the model you actually used in class_ |
| Finishing at home | Claude desktop app, Cowork mode, linked directly to this repo folder on my laptop | `claude-opus-5` (Claude Opus 5) |

**A note on language.** I type my prompts in Chinese. Every prompt below is a
direct, literal translation of what I actually sent — same order, same
content, nothing merged, nothing tidied up, nothing added. They are
translations, not AI-written summaries. Mike said a translation is fine for
this log.

**A note on the workflow.** At home I did not paste code back and forth in a
chat window. The model was connected to `~/Documents/GitHub/zhangyubooo.github.io`
and edited the files in place, ran the game in a headless Chromium, took
screenshots, looked at them, and fixed what it saw. That changed the shape of
my prompts: most of them are art-direction notes on a screenshot I had just
looked at, not code instructions.

---

## Part 1 — the in-class sprint (Kiro)

> I didn't save the prompts after class.

**Where the sprint ended up:** I made a playful classic crossy road game, but there are a few visual bugs.

---

## Part 2 — finishing at home (Claude Opus 5, Cowork)

### 1. Setting the constraints

I pasted the entire assignment text, and added one line at the end:

> Based on the above, I've decided to stop using Kiro. Work directly on my
> local files for this homework.

This one line fixed two things: throw away the in-class code and restart from
scratch, and edit the repo on my laptop directly instead of emitting code into
a chat window. The assignment text itself is the most detailed spec I could
have written (static only, must run on GitHub Pages, its own folder, its own
README, linked from the portfolio), so I did not restate any of it.

### 2. Three decisions

The model asked three questions before writing anything. My answers:

> Repo location: under ~/Documents.
> Theme: CMU campus version.
> How to work: write the whole thing, then walk me through it section by section.

The theme answer is the single most important decision in this project. The
assignment says "make it yours," so I did not want a faithful Crossy Road
clone — I wanted the setting moved to CMU: crossing Forbes Ave, cutting across
the Cut, and going around the construction that is never finished.

### 3. Understanding what I had

Before asking for any changes, I asked for the code to be explained:

> Explain the mechanism in detail.

> Tell me the current game rules.

I did this deliberately. I need to be able to explain the projection, the
depth sorting and the lane generation at a project review, and I could not do
that from a screenshot. The answer to the first one is the reason I understand
that the whole 2.5D effect is a single function, `P(col, row)`, and that the
depth sorting is nothing but the direction of a `for` loop.

### 4. Art direction pass one — the character and the trenches

> Make the coffee cup look more like a cup. Put the character in a red hoodie.
> When you collect coffee, the cups should stack up. Also the construction
> trench doesn't read as a trench right now — you could add an excavator or a
> dump truck.

Result: cups became tapered paper cups with a red sleeve; the body became a
red hoodie and the backpack moved to charcoal so two reds would not compete;
collected cups stack on the character's head; the pit got exposed pipe and
rebar, black-and-white barriers, and parked machinery.

### 5. Art direction pass two — visibility, animation, turning

> I can't see the excavator or the dump truck — alternatively, spawn them
> randomly on the moving steel plates so they double as obstacles. There's a
> black block on the front of the character, is that a hand? Remove it. Also:
> give the squirrel death a being-carried-off animation, the car death a
> knocked-flying animation, and the trench death a falling-in animation. And
> the character should turn around when walking forward and back, and turn
> left and right when moving sideways.

This one produced the best structural change in the project. The machinery had
been parked on the shoulder outside the playable band, where a slightly narrow
window cropped it off entirely. Moving it onto the plates put it permanently in
frame *and* turned it into a mechanic: the two cells a machine occupies cannot
be stood on, so a long plate is no longer automatically a safe plate.

### 6. Art direction pass three — the face, the palette, the landmark

> The turning still isn't clear enough — there should be an actual face, in a
> colour that separates from the rest of the head. Also make the machinery more
> yellow, right now it doesn't read as construction equipment. You could also
> put orange traffic cones on the steel plates to make it look more like a work
> site. On the normal road lanes, some cars could have TARTANS, SCOTTY and
> other CMU things written on them. And occasionally a CMU Police car. And on
> the left of the starting row (bottom-left of the screen), build the classic
> CMU sculpture Walking to the Sky — basically a leaning pole with a few
> different-coloured rectangles on it for people, plus a few more standing at
> the bottom.

"The turning still isn't clear enough" turned out to be a real constraint of
the projection, not a tuning problem: this camera only ever shows a box's top,
front and right faces, so **the left face never appears at all**, and any
marker painted on a side face vanishes when you walk left. The fix was to make
the head two blocks — dark hair and a light face — with the face offset toward
the direction of travel, so the cue lives on the top face where it is always
visible.

### 7. Scope and mechanics

> Keep only TARTANS / SCOTTY on the vehicles, don't have a whole lane of
> lettered cars, and lower the chance of lettering. The squirrel death doesn't
> read as a squirrel — the animation could be a giant squirrel running in from
> the side and eating you. And seven coffees on your head should just win the
> game. Winning means you made it to class safely.

This is the prompt that gave the game a win condition. Up to here it was an
endless runner with no ending; seven coffees turned the collectible from
decoration into the goal, which meant the spawn rate had to go up and the HUD
had to show `n/7` so the goal explains itself.

### 8. Style consistency

> The text on the vehicles — 61C, CMU POLICE, TARTANS and SCOTTY — breaks the
> illusion. Could it be pixel style too?

Correct call. The lettering had been Inter drawn with `fillText`: smooth
vector type sitting on a world made entirely of blocks. It became a hand-built
3×5 bitmap font drawn as filled squares. M, N and W needed four columns —
three is not enough room for a diagonal, and the first attempt rendered
TARTANS as something closer to TARTAMS.

### 9. Last fix

> Right now the CMU police cars come in whole rows. Make them appear more
> randomly — maybe just one car within a line of traffic.

The vehicle type had been drawn once per lane, so a police car could never
appear alone; it appeared as a convoy of six. Now each vehicle rolls
separately.

---

## What the process actually looked like

Nine design prompts, plus a handful of deployment ones (a stuck
`.git/index.lock`, a failed terminal `git push` — GitHub has not accepted
password authentication since 2021, so pushing goes through VS Code).

Almost none of my prompts were about code. They were about **legibility**:
I could not tell where the character was, I could not tell a trench from a
road, I could not tell which way the character was facing. Each of those
turned out to have a cause in the projection rather than in the art, and the
fixes are the parts of this project I would actually talk about:

1. Horizontal and vertical scale have to be computed separately, or a wide
   window shows twenty-plus rows and the screen turns into noise.
2. The four ground types have to be separated by **value**, not hue — the
   first version had grass and plaza at nearly the same lightness and you
   could not tell what was safe to stand on.
3. Anything painted on a left-hand face is invisible in this projection.
4. A white character disappears on the plaza; a dark one disappears on the
   road. The character needs an outline either way.

---

