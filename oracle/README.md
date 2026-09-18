# World Oracle

**15-113 HW3 — Explore an API**
Yubo Zhang · Carnegie Mellon University, School of Design

Live: <https://zhangyubooo.github.io/oracle/>

Ask a question and an I Ching hexagram is cast for you. The hexagram is not
drawn from a random number — it is drawn from the state of the planet at the
moment you ask, read live from three public APIs.

---

## How the APIs are called

All three sources are fetched from the browser with the built-in `fetch()`
API — no library, no build step, no server. Each request is wrapped in an
`AbortController` so a hung connection fails after 8 seconds instead of
leaving the page waiting. The three calls go out in parallel via
`Promise.all()` and each returns JSON.

| Source | Endpoint | Key parameters | What comes back |
|---|---|---|---|
| **USGS Earthquake Hazards Program** | `earthquake.usgs.gov/.../summary/all_hour.geojson` | none — it is a fixed feed of the last hour | GeoJSON `FeatureCollection`. I read `features[0].properties.mag` (number), `.time` (Unix ms integer), and `geometry.coordinates`, which is `[longitude, latitude, depth]` — **longitude first**, which is the opposite of how people usually say it |
| **SunriseSunset.io** | `api.sunrisesunset.io/json` | `lat`, `lng` | JSON object under `results`; `day_length` and `solar_noon` arrive as **clock strings** (`"12:23:45"`, `"1:07:44 PM"`), not numbers, so they are parsed to seconds before use; `moon_illumination` is a percentage |
| **Open-Meteo** | `api.open-meteo.com/v1/forecast` | `latitude`, `longitude`, `current=` (a comma-separated list of variables) | JSON with a `current` object of numbers — `pressure_msl` (hPa), `cloud_cover` (%), `wind_direction_10m` (degrees), `temperature_2m` (°C) — plus a matching `current_units` object |

### API keys

**There are none, and that was a selection criterion rather than luck.**

This page is static and runs entirely in the visitor's browser on GitHub
Pages. Any key placed in front-end JavaScript is readable by anyone who opens
DevTools, no matter how it is stored — so the requirement "must work live on
my portfolio" and the requirement "must not leak a key" together mean
*keyless APIs only*. All three above are free and unauthenticated, so this
repository contains no key, no `.env`, and nothing excluded via `.gitignore`
for secrecy reasons.

Rate limits are respected by design: exactly three requests are made per
cast, and only when the visitor presses the button.

---

## The idea, and why it is not a random number generator

A hexagram is traditionally cast with yarrow stalks or three coins. Those are
not mystical objects — they are physical processes nobody can predict. The
substitution this project makes is to replace them with **live readings of
the planet**: where the earth last moved, how long today's daylight lasts,
what the air pressure is doing.

`Math.random()` does not appear anywhere in this repository.

The flow is:

```
question text  ─┐
                ├─→ FNV-1a hash ─→ 32-bit seed ─→ mulberry32 ─→ 18 coin throws ─→ 6 lines
live readings  ─┘
```

Two properties follow from building it this way, and both are the point:

1. **It is reproducible.** The same question, asked while the world is in the
   same state, produces the same hexagram. The seed is printed at the bottom
   of every reading, and so are the raw numbers that produced it. Every
   divination tool is a black box; this one opens.
2. **It moves because the world moves.** Ask again tomorrow and the answer
   differs — not because a die was rolled, but because there was a different
   earthquake and the day got shorter.

The randomness lives in the seed, which comes from outside. `mulberry32` only
*expands* that seed deterministically into the eighteen coin throws a cast
needs. That distinction is the honest description of what the program does.

### The one thing this page refuses to do

If all three sources fail — no network, every API down — the page **does not
cast a hexagram**. It says the world is unreachable and stops. Falling back to
a local random number would produce output indistinguishable from a real
reading while being a completely different thing, and the entire claim of the
project is that the numbers are real. A partial failure is handled the same
way but softer: a source that cannot be reached is shown as unreachable and
excluded from the seed, and the cast proceeds on the sources that answered.

---

## Architectural decision: the hexagram texts are local, not an API

Free I Ching APIs exist but are individual side projects or paid services,
and none is reliable enough to build on. More importantly the sixty-four
hexagrams are a **fixed, public-domain, 24 KB** body of text that has not
changed in three thousand years — fetching it over a network every time would
be pure fragility for no benefit.

So the division of labour is:

- **`hexagrams.json` (local)** — the content. Always available, versioned with
  the repo, editable as data.
- **The three APIs (remote)** — the entropy. The one thing that genuinely has
  to come from outside, because it has to be unpredictable.

`hexagrams.json` is generated by `tools/build_hexagrams.py` rather than typed
by hand. Each hexagram's six lines are fully determined by which two trigrams
sit below and above it, so the binary is *derived* from the trigram table and
then verified: 64 entries, 64 unique line patterns, and spot-checks against
hexagrams whose shape is common knowledge (䷀ all-yang, ䷁ all-yin, ䷊ and ䷋
the mirror pair, ䷾ and ䷿ the two alternating ones). Typing 384 binary digits
by hand is how one silently wrong hexagram survives for months.

---

## Running it

It is a static page with no dependencies and no build step.

```bash
git clone https://github.com/zhangyubooo/zhangyubooo.github.io.git
cd zhangyubooo.github.io/oracle
python3 -m http.server 8000
# then open http://localhost:8000
```

**Do not open `index.html` by double-clicking it.** `fetch()` cannot read a
`file://` URL, so `hexagrams.json` will not load. The page detects this case
and says so rather than failing silently, but a local server is the fix.

To regenerate the data file:

```bash
python3 tools/build_hexagrams.py     # standard library only, no pip install
```

---

## Things that were tested by trying to break it

| Test | Behaviour |
|---|---|
| Empty question | Inline message, focus returns to the field. **No request is made at all** (verified by recording network traffic). |
| Wi-Fi off | All three sources report "could not be reached" within 8s; **no hexagram is drawn**; the form comes back with the question still in it. |
| One source down | That column says why it could not be reached and stays on screen saying it for the rest of the reading; it is excluded from the seed and the cast proceeds on the other two. |
| A source returns 200 but with unexpected fields | Treated as a failure (`no usable fields in response`) rather than seeding the cast with an empty array. |
| One source much slower than the others | Its row sits visibly in a `reading…` state while the others fill. There is no blank screen at any point. |
| Opened over `file://` | Explicit message pointing at the README, and the Cast button is disabled. |
| Button pressed repeatedly mid-cast | Ignored — the button disables for the duration of a cast. |
| A quiet hour with zero earthquakes | Not an error: a count of zero is itself a reading of the world. |
| 390 / 768 / 1280px wide | No horizontal overflow at any of them, and the fixed back-link never lands on top of the reading (it rejoins the normal flow below 48rem). |
| `prefers-reduced-motion` | The staggered build is skipped and the scrolling switches from smooth to instant; the finished figure appears at once. |

### How the page manages attention

A first version of this page put the question in a field at the top, the
readings and the six lines in the middle, and the answer at the bottom under
the hexagram's number, romanisation and trigrams. Three things were wrong with
it, and all three were about attention rather than code:

1. **Nothing to look at while the sources were in flight.** The three rows were
   only drawn once all three requests had returned, so a slow source meant up
   to eight seconds of blank page. Now all three rows are drawn the instant the
   button is pressed and each fills itself when its own source answers.
2. **The six lines built below the fold.** On a laptop the one part of the page
   worth watching was off-screen. The first fix was to fold the three readings
   away once the cast began, which bought the height but gave up the evidence —
   and the readings *are* the evidence for everything this page claims. So they
   were laid out abreast instead: three columns rather than three stacked rows,
   154px instead of about 280px, nothing hidden. With the intro collapsed and
   the page anchored on the question, the question sits at 28px and the answer
   ends at 762px of an 820px window — one screen, measured, not estimated.
3. **The hexagram's name was louder than the answer.** The Chinese name was set
   at 40px and the sentence written to the visitor at 17px, below the classical
   judgment. The order is now name → answer → rule → apparatus. Everything
   above the rule is addressed to you; everything below it is reference.

The third one matters most, because the interface cannot help interpret. The
I Ching never answers a question directly, and nothing here generates text —
so the only bridge between a question and an image is **where they sit on the
page relative to each other**. Putting them in the same frame *is* the design
work.

---

## Files

```
oracle/
├── index.html              the page
├── oracle.css              all styling; tokens copied from the site's style.css
├── oracle.js               entropy sources, casting engine, the ritual
├── hexagrams.json          64 hexagrams — generated, do not edit by hand
├── tools/
│   └── build_hexagrams.py  generates and validates hexagrams.json
├── prompt_log.md           the AI prompts that shaped this
└── README.md               this file
```

---

## Credits and provenance

The classical judgments (卦辭) are ancient public-domain text. The one-line
modern readings are mine. The trigram and King Wen tables were cross-checked
against the standard sequence.

AI disclosure: Claude wrote the first working version of `oracle.js`,
`oracle.css` and the generator, and then walked me through it section by
section; the concept, the refusal-to-fake-it behaviour, the pacing values,
the copy and the sixty-four modern readings are my decisions. See
`prompt_log.md`.
