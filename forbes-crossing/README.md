# Forbes Crossing

Play it: **https://zhangyubooo.github.io/forbes-crossing/**

---

## What it is

> **⚠️ 这两句必须你自己写，不要让 AI 写（作业明确要求）。**
> 要求：一到两句，说明这个游戏是什么、和原版 Crossy Road 有什么不同。
> 可以参考的事实（用你自己的话重写）：场景换成了 CMU 校园；
> "过河踩原木" 换成了 "过施工沟踩钢板"；多了一条 61C 公交专用道，
> 车来之前会先闪红灯；站着不动太久会被校园松鼠叼走；
> 美术是黑白灰 + 一个 CMU 红，和我 portfolio 用的是同一套设计系统。
>
> _写完把这段引用块整个删掉。_

## How to play

**Controls**

| | |
|---|---|
| Move | `↑` `↓` `←` `→` or `W` `A` `S` `D` |
| Touch | swipe in any direction · tap to hop forward |
| Restart | `Space` / `Enter`, or the **Again** button |
| Sound | the ♪ button, bottom right (remembered between visits) |

**Scoring**

Your score is the number of blocks you have moved *forward*, counted from
where you started. Going sideways or backwards is free but earns nothing, and
you can never go more than 4 blocks back from your furthest point.

Coffee cups sit on some of the safe lanes. They are pure collectible — they
count on the game-over screen but do not affect the score. Every cup you pick
up stacks on top of your head; the visible tower stops at six so it does not
block your view of the lanes ahead, but the counter keeps going.

Your best score is kept in the browser (`localStorage`), so it survives a
reload but is per-device.

**How you lose** — five ways:

1. A car or a facilities truck hits you on a road.
2. The 61C hits you on the bus lane. It flashes red lights before it comes;
   the faster they blink, the closer it is.
3. You land in a construction trench with no steel plate under you.
4. A steel plate carries you off the edge of the site.
5. You stand still for about 14 seconds and a campus squirrel gets you.
   A shadow appears over your head a few seconds before that happens.

**Difficulty** ramps with distance: roads get faster and more crowded, gaps
between steel plates get wider, and the bus lane shows up more often. The
first 8 rows never contain a trench or a bus lane, so there is time to learn
the basic rule first.

## Built with

- **Claude Opus 5** (`claude-opus-5`), used through the **Claude desktop app
  (Cowork mode)**, connected directly to this repo folder on my laptop — so
  the model edited the files in place instead of me copying code out of a chat
  window.
- **Kiro** — used for the 30-minute in-class sprint only. _(TODO: 如果课上
  用的是别的模型/工具，改成实际用的。)_

**Strategy** _(TODO: 确认或改成你自己的说法)_ — for the in-class sprint I let
the tool attempt the whole game in one shot. At home I restarted from scratch
rather than building on the sprint code, and worked in the opposite order:
first fix the projection and the game loop, then add one hazard type at a
time, then spend the remaining time on how the thing actually reads on screen.
Most of the back-and-forth at home was about legibility, not features.

No build step, no framework, no dependencies. One `index.html`, one `game.css`,
one `game.js`, canvas 2D. It runs as a static page on GitHub Pages.

## How it works, briefly

The 2.5D look is one function. `P(col, row)` maps a world grid cell to a
screen point: moving one row further away moves you *up* the screen and
slightly *left*. Everything else — cars, trees, steel plates, the player — is
the same `box()` call, which draws three flat parallelograms (top, front,
right side) and shades the two sides darker. Rows are drawn from farthest to
nearest, so nearer things paint over further ones. That is the entire depth
system; there is no z-buffer and no 3D library.

Lanes are generated one row at a time and cached in a `Map`, so the world is
endless without ever holding more than a screenful of state.

## Known issues / unfinished

- The steel-plate lanes are the hardest part of the game and probably still
  too punishing compared to the roads.
- There is no pause. Switching tabs is safe (the loop clamps the time step so
  traffic cannot teleport into you), but there is no way to stop mid-run.
- The character does not visibly turn when moving sideways — only the backpack
  flips to the correct side when walking back toward the camera.
- The excavators and dump trucks parked along the trenches are decoration only.
  On a narrow phone screen their bodies get cropped off the edge; the arm and
  bucket stay visible, which is the part that identifies them.
- Colour only; no high-contrast mode. The game is fully keyboard-driven but
  is not usable with a screen reader.
- The squirrel is a rule, not an animation. You get a shadow and a game-over
  line, not an actual squirrel.
