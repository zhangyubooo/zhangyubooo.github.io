# Prompt log — World Oracle

**Model / tool:** Claude (Opus 5), via the Claude desktop app with access to my
local repo folder.

This is not the whole transcript. These are the exchanges that actually changed
what got built — mostly the ones where the answer I got was wrong and had to be
pushed on.

---

### 1. Opening the search — and immediately hitting a trap

> *"翻译这份作业，并说说有什么 API 适合做这个，以及项目方向，要用免费 API，项目里尽量不要用消耗 AI token 的，然后尽量是可以让人实时交互不是那种每天的"*

Useful output: a distinction I used for the rest of the project — the
assignment allows two ways of "not returning the same data every time",
**live data** or **user-parameterised queries**, and most candidate APIs
only manage one.

The first concrete warning that saved me time: **NewsAPI.org is useless here.**
Free tier has a 24-hour article delay, CORS enabled for localhost only, and
forbids production use. It is the first result anyone searching "news API"
finds, and it fails the assignment on two counts.

---

### 2. Rejecting the obvious version

> *"我挺喜欢那个选颜色然后有藏品筛选，但是除了馆藏，还可以调啥"*

This produced the most useful conceptual note in the whole conversation:
colour → artwork is **tautological**. The user picks blue and gets blue
pictures; they know what they will see before they see it. Interesting
mappings are **cross-domain** — colour in, something non-visual out.

I kept that test and applied it to everything afterwards.

---

### 3. The prompt that actually mattered

When I was pitched an Iconify project — "search a word, see how 200 icon sets
each draw it" — I pushed back:

> *"把这个详细说说？这怎么就是设计工具了"*

The answer conceded the point: as described it was **a search results page,
not a tool**, and Iconify's own site already does it better. Out of that came
a definition I ended up using to judge every remaining idea:

> A **display** lets you look. A **tool** lets you take something away — a
> decision, a file, a fact you could not otherwise get. The test: after the
> user closes the tab, is anything different?

That question is why this project has a provenance panel and a refusal case
instead of just a pretty animation.

---

### 4. The pivot

> *"有没有那种答案之书的 api"*

The honest answer was that Advice Slip, yesno.wtf and friends all fail the
assignment: **random selection from a fixed pool is not live data and is not
parameterised** — it is a third thing that the brief does not list. The pool
is dead; it returns the same universe of answers forever.

But the follow-up reframed it, and this became the project:

> Don't use a random number. Use the state of the world. Yarrow stalks and
> coins were never mystical — they were just physical processes nobody could
> predict. Replace them with live planetary readings and the divination
> becomes literally true: the world *is* answering.

That one move converts a disqualified idea into one that satisfies both
conditions at once — live *and* parameterised.

---

### 5. Architecture

> *(on where the hexagram texts should come from)*

I asked whether to fetch the 64 hexagrams from an I Ching API. The answer was
no, and the reasoning is now in the README:

> **API's role is the entropy source, not the content source.**

The 64 judgments are fixed public-domain text that hasn't changed in three
thousand years; putting them behind a network call is fragility with no
benefit. The one thing that genuinely must come from outside is the part that
must be unpredictable.

---

### 6. Correctness, not vibes

> *"生成 hexagrams.json：用上下卦组合推导二进制以避免手抄错误"*

Each hexagram's six lines are fully determined by its two trigrams, so the
binary is derived rather than typed, and then checked — 64 unique patterns,
plus spot-checks against hexagrams whose shape is common knowledge. Three of
my assumptions were verified by running them rather than trusting them:

- the three-coin method's 1:3:3:1 distribution — measured **12.53 / 37.58 /
  37.51 / 12.38%** over 240,000 simulated lines
- all 64 hexagrams reachable — **64/64** over 200,000 casts, 0 unresolved
- probability of a cast with no changing line — measured **17.8%**, theory
  (6/8)⁶ = **17.8%**

---

### 7. What I had to verify myself, because the model couldn't

Several APIs were recommended with an explicit "I could not test this, you
must". That turned out to matter:

- **Wikidata's P465** was pitched hard for an earlier idea; the query service
  was unreachable from the model's sandbox, so the data volume was never
  confirmed.
- The `public-apis` README is too large to read in one pass — it truncated at
  the letter F every time, so half the catalogue was invisible and had to be
  reached through a mirror.
- Two APIs listed as "no auth" in that repo (**ADS-B Exchange**, **Trefle**)
  are, as far as I can tell, no longer free or no longer running. **The list
  goes stale silently.**

The assignment warns that AI invents plausible endpoints. The lesson I
actually came away with is broader: *every* second-hand source about an API —
model, curated list, blog post — needs one `fetch()` in the console before
you design anything on top of it.

---

*Entries below this line are mine, added as I revised the code and rewrote
the sixty-four readings.*
