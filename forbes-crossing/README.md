# Forbes Crossing

Play it: **https://zhangyubooo.github.io/forbes-crossing/**

---

## What it is

Forbes Crossing is a browser game in the shape of Crossy Road, relocated to the
Carnegie Mellon campus: instead of a frog crossing rivers on floating logs, it
is a student crossing Forbes Ave and a construction site that never quite
finishes, riding steel road plates over open trenches, watching for the 61C,
and picking up coffee along the way.

The two things that make it not a clone are the setting and the ending. Crossy
Road is endless by design — you only ever lose. Here, seven coffees means you
made it to class, so the game is something you can actually win. Everything on
screen is drawn in the same black / grey / white plus one CMU red that the rest
of this portfolio uses, so the game reads as part of the site rather than as
something dropped into it.

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

**How you win.** Coffee cups sit on some of the safe lanes, about one every
seven or eight rows. Each cup you pick up stacks on top of your head. Get to
**seven cups and you win** — you made it to class. That is the only way the
game ends well; everything else kills you.

Your best score is kept in the browser (`localStorage`), so it survives a
reload but is per-device.

**How you lose** — five ways:

1. A car or a facilities truck hits you on a road.
2. The 61C hits you on the bus lane. It flashes red lights before it comes;
   the faster they blink, the closer it is.
3. You land in a construction trench with no steel plate under you. Some
   plates have an excavator or a dump truck parked on them; those two cells
   are solid, so a long plate is not always a safe plate.
4. A steel plate carries you off the edge of the site.
5. You stand still for about 14 seconds and a campus squirrel — considerably
   larger than you are — runs in from the side and eats you. A shadow appears
   over your head a few seconds before that happens.

**Difficulty** ramps with distance: roads get faster and more crowded, gaps
between steel plates get wider, and the bus lane shows up more often. The
first 8 rows never contain a trench or a bus lane, so there is time to learn
the basic rule first.

## Things to look for

- **Walking to the Sky** stands to the left of the starting row — the leaning
  pole with figures climbing it. It scrolls out of frame once you get going.
- Traffic is CMU traffic: the occasional van lettered TARTANS or SCOTTY, and
  now and then a single **CMU Police** car mixed into a line of ordinary
  traffic, red-and-blue bar flashing on the roof.
- The **61C** is the only thing on the bus lane, and the only vehicle that
  warns you before it arrives.
- Everything on the construction lanes is safety yellow and orange: excavators
  and dump trucks riding the steel plates, traffic cones along the plate edges,
  black-and-white barriers at the sides of the pit.

## Built with

- **Claude Opus 5** (`claude-opus-5`), used through the **Claude desktop app
  (Cowork mode)**, connected directly to this repo folder on my laptop — so
  the model edited the files in place instead of me copying code out of a chat
  window.
- **Kiro** — used for the 30-minute in-class sprint only, on whatever model it
  ships with by default; I did not change that setting.

**Strategy.** In class I used the 30 minutes the way the exercise invites you
to: one large prompt, let the tool attempt the whole game at once, see what
comes back. What came back was a thing that ran, and that was about all I could
say for it — so at home I threw it away and started from an empty folder rather
than trying to repair it. Restarting is cheaper than debugging generated code
you did not design.

At home I inverted the order. Instead of asking for a game, I fixed the two
things everything else sits on top of — the projection function and the game
loop — and got those looking right on a real screen before any hazard existed.
Then one hazard type at a time: roads, then the bus lane, then the construction
trenches. Only when each of those worked in isolation did I let them stack up
into difficulty ramping.

The result is that most of the back-and-forth at home was not about features at
all. It was about legibility: whether you can tell grass from pavement at a
glance, whether the character is findable on a light background, whether a
steel plate with an excavator parked on it reads as solid. A hazard the player
cannot see coming is not difficulty, it is just an unfair death, and that
distinction ate more of my time than writing the collision code did.

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
- The character turns to face the direction you last moved, but the turn is
  instant — there is no rotation, because nothing in this renderer can rotate.
- The four deaths each have their own animation (knocked flying, sinking into
  the trench, carried off by a plate, eaten by a squirrel). They are all
  built from translation and scaling only, for the same reason.
- Colour only; no high-contrast mode. The game is fully keyboard-driven but
  is not usable with a screen reader.
- The lettering on the vehicles is a hand-built 3x5 bitmap font drawn as
  filled squares, on their front faces only, because that is the one face this
  projection keeps horizontal. On a narrow phone the squares drop below two
  pixels and the lettering is left off rather than smeared.
- Seven coffees is a long run — you have to detour for nearly every cup you
  see. I have not tuned how many rows a win actually takes; it may still be
  too far.
