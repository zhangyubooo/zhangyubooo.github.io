# Prompt log — Forbes Crossing

## Models and tools

| Phase | Tool | Model |
|---|---|---|
| In-class sprint (30 min) | Kiro | _TODO: fill in the model you actually used in class_ |
| Finishing at home | Claude desktop app, Cowork mode, linked directly to this repo folder on my laptop | `claude-opus-5` (Claude Opus 5) |

**A note on language.** I type in Chinese. The assignment asks for prompts
*verbatim*, so every prompt below is reproduced exactly as I sent it, in
Chinese, with an English translation directly underneath. Nothing here is an
AI-written summary of what I asked — the translations are only there so the
log is readable in English.

**A note on the workflow.** At home I did not paste code back and forth in a
chat window. The model was connected to `~/Documents/GitHub/zhangyubooo.github.io`
and edited the files in place, ran the game in a headless Chromium, took
screenshots, looked at them, and fixed what it saw. That changed the shape of
my prompts: most of them are art-direction notes on a screenshot I just
looked at, not code instructions.

---

## Part 1 — the in-class sprint (Kiro)

> **⚠️ TODO — this part is mine to fill in.**
> Open Kiro, copy the prompts I typed during the 30-minute in-class sprint,
> and paste them below one by one, exactly as typed. The assignment says the
> point is to be able to compare the sprint version with the finished one, so
> this section cannot be skipped. Kiro's history is usually under `~/.kiro`
> or in its session/history panel.
>
> _Delete this blockquote once the prompts are in._

```
(paste the in-class prompts here, one per line, unedited)
```

**Where the sprint ended up:** _TODO — one sentence on what actually worked
when the 30 minutes ran out (e.g. "renders but the character doesn't move" /
"traffic moves but there's no collision" / "white screen")._

---

## Part 2 — finishing at home (Claude Opus 5, Cowork)

### 1. Setting the constraints

I pasted the entire assignment text, and added one line at the end:

> 根据以上内容，我决定不再使用kiro，你直接链接本地文件来做这个hw
>
> *("Based on the above, I've decided to stop using Kiro. Work directly on my
> local files for this homework.")*

This one line fixed two things: throw away the in-class code and restart from
scratch, and edit the repo on my laptop directly instead of emitting code into
a chat window. The assignment text itself is the most detailed spec I could
have written (static only, must run on GitHub Pages, its own folder, its own
README, linked from the portfolio), so I did not restate any of it.

### 2. Three decisions

The model asked three questions before writing anything. My answers:

> 仓库位置：~/Documents 下
> 游戏主题：CMU 校园版
> 参与方式：我直接写完，再逐段给你讲解
>
> *("Repo location: under ~/Documents. Theme: CMU campus version. How to work:
> write the whole thing, then walk me through it section by section.")*

The theme answer is the single most important decision in this project. The
assignment says "make it yours," so I did not want a faithful Crossy Road
clone — I wanted the setting moved to CMU: crossing Forbes Ave, cutting across
the Cut, and going around the construction that is never finished.

### 3. Understanding what I had

Before asking for any changes, I asked for the code to be explained:

> 你详细说一下机制？
>
> *("Explain the mechanism in detail.")*

> 你说一下现在的游戏规则
>
> *("Tell me the current game rules.")*

I did this deliberately. I need to be able to explain the projection, the
depth sorting and the lane generation at a project review, and I could not do
that from a screenshot. The answer to the first one is the reason I understand
that the whole 2.5D effect is a single function, `P(col, row)`, and that the
depth sorting is nothing but the direction of a `for` loop.

### 4. Art direction pass one — the character and the trenches

> 咖啡杯做的像一点，人物穿着红色hoodie，收集到咖啡，咖啡杯可以叠起来。然后施工沟现在看不出来是施工沟，可以加上挖掘机或运土车
>
> *("Make the coffee cup look more like a cup. Put the character in a red
> hoodie. When you collect coffee, the cups should stack up. Also the
> construction trench doesn't read as a trench right now — you could add an
> excavator or a dump truck.")*

Result: cups became tapered paper cups with a red sleeve; the body became a
red hoodie and the backpack moved to charcoal so two reds would not compete;
collected cups stack on the character's head; the pit got exposed pipe and
rebar, black-and-white barriers, and parked machinery.

### 5. Art direction pass two — visibility, animation, turning

> 看不到挖掘机和运土车，要不然把它们随机生成在移动的钢板上可以做障碍物。现在人物正面是有个黑色方块是手吗？不要这个方块。然后被松鼠叼走之后死亡有个被叼走的动效，被车撞有个撞飞的动效，掉进施工沟里有个掉下去的动效。然后人物前后走现在可以转过来。如果左右移动人物也可以左右转。
>
> *("I can't see the excavator or the dump truck — alternatively, spawn them
> randomly on the moving steel plates so they double as obstacles. There's a
> black block on the front of the character, is that a hand? Remove it. Also:
> give the squirrel death a being-carried-off animation, the car death a
> knocked-flying animation, and the trench death a falling-in animation. And
> the character should turn around when walking forward and back, and turn
> left and right when moving sideways.")*

This one produced the best structural change in the project. The machinery had
been parked on the shoulder outside the playable band, where a slightly narrow
window cropped it off entirely. Moving it onto the plates put it permanently in
frame *and* turned it into a mechanic: the two cells a machine occupies cannot
be stood on, so a long plate is no longer automatically a safe plate.

### 6. Art direction pass three — the face, the palette, the landmark

> 转向还是不够清晰，要有明确的脸，脸的颜色区分开来。另外，工程机用黄一点的颜色，现在有点看不出来是工程机。然后如果是钢板上也可以刷橘色三角锥，增加像施工的样子。另外，正常车道上的汽车可以有些身上写着tartan，scotty等关于cmu的车。也可以偶尔刷cmu police警车。在开始那一行左边（画面左下角）做出来cmu经典建筑walking to the sky（其实就是斜着的柱子上面放几个不同颜色长方体代表人，下面再站几个人）
>
> *("The turning still isn't clear enough — there should be an actual face, in
> a colour that separates from the rest of the head. Also make the machinery
> more yellow, right now it doesn't read as construction equipment. You could
> also put orange traffic cones on the steel plates to make it look more like a
> work site. On the normal road lanes, some cars could have TARTANS, SCOTTY and
> other CMU things written on them. And occasionally a CMU Police car. And on
> the left of the starting row (bottom-left of the screen), build the classic
> CMU sculpture Walking to the Sky — basically a leaning pole with a few
> different-coloured rectangles on it for people, plus a few more standing at
> the bottom.")*

"The turning still isn't clear enough" turned out to be a real constraint of
the projection, not a tuning problem: this camera only ever shows a box's top,
front and right faces, so **the left face never appears at all**, and any
marker painted on a side face vanishes when you walk left. The fix was to make
the head two blocks — dark hair and a light face — with the face offset toward
the direction of travel, so the cue lives on the top face where it is always
visible.

### 7. Scope and mechanics

> 车上的刷字只保留TARTANS / SCOTTY，而且不要一整行都是刷字的车，刷字的几率再小一点。然后松鼠吃掉看不来是松鼠，动效可以是一只巨大的松鼠从旁边跑过来把它吃掉。然后咖啡杯顶到7个就直接赢。赢就是安全到教室。
>
> *("Keep only TARTANS / SCOTTY on the vehicles, don't have a whole lane of
> lettered cars, and lower the chance of lettering. The squirrel death doesn't
> read as a squirrel — the animation could be a giant squirrel running in from
> the side and eating you. And seven coffees on your head should just win the
> game. Winning means you made it to class safely.")*

This is the prompt that gave the game a win condition. Up to here it was an
endless runner with no ending; seven coffees turned the collectible from
decoration into the goal, which meant the spawn rate had to go up and the HUD
had to show `n/7` so the goal explains itself.

### 8. Style consistency

> 现在车上的文字包括61C 和 CMU POLICE，TARTANS 和 SCOTTY太出戏了，能不能也用像素风
>
> *("The text on the vehicles — 61C, CMU POLICE, TARTANS and SCOTTY — breaks
> the illusion. Could it be pixel style too?")*

Correct call. The lettering had been Inter drawn with `fillText`: smooth
vector type sitting on a world made entirely of blocks. It became a hand-built
3×5 bitmap font drawn as filled squares. M, N and W needed four columns —
three is not enough room for a diagonal, and the first attempt rendered
TARTANS as something closer to TARTAMS.

### 9. Last fix

> 现在cmu 警车是一排一排出现的，把警车的出现随机一点，可能就是一排车其中一个
>
> *("Right now the CMU police cars come in whole rows. Make them appear more
> randomly — maybe just one car within a line of traffic.")*

The vehicle type had been drawn once per lane, so a police car could never
appear alone; it appeared as a convoy of six. Now each vehicle rolls
separately.

---

## What the process actually looked like

Nine design prompts, plus a handful of deployment prompts (a stuck
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

## Changes I made myself

_TODO — if I tune any values, colours, copy, or add/remove anything, write it
here. One or two lines is enough, but be specific, e.g. "changed the hop
duration from 0.13s to 0.11s, the original felt sticky."_
