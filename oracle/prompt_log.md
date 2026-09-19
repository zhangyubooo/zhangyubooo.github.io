# Prompt log — World Oracle

**Model / tool:** Claude (Opus 5), via the Claude desktop app with access to my
local repo folder.

This is not the whole transcript. These are the exchanges that actually changed
what got built — mostly the ones where the answer I got was wrong and had to be
pushed on. I work with Claude in Chinese, so the prompts below are translations
of what I actually typed.

---

### 1. Opening the search — and immediately hitting a trap

> *"What APIs would suit this assignment, and what project directions? It has
> to be a free API, ideally nothing that burns AI tokens, and ideally something
> people can interact with in real time rather than data that only updates once
> a day."*

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

> *"I like the one where you pick a colour and it filters a museum collection —
> but besides collections, what else could the colour drive?"*

This produced the most useful conceptual note in the whole conversation:
colour → artwork is **tautological**. The user picks blue and gets blue
pictures; they know what they will see before they see it. Interesting
mappings are **cross-domain** — colour in, something non-visual out.

I kept that test and applied it to everything afterwards.

---

### 3. The prompt that actually mattered

When I was pitched an Iconify project — "search a word, see how 200 icon sets
each draw it" — I pushed back:

> *"Say more about this. In what sense is that a design tool?"*

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

> *"Is there an API like the Book of Answers?"*

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

> *"Generate hexagrams.json by deriving the binary from the upper and lower
> trigram combinations, so there is no chance of a transcription error."*

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

---

### 8. The line statements — and refusing to type them from memory

> *"Is there a free LLM API that could connect the user's question to the
> hexagram that came up, and give a more direct answer?"*

The answer I got was no — not because free ones don't exist (Pollinations runs
without a key), but because adding one would have contradicted the thing this
project is actually arguing:

- the README says the interface cannot interpret, so juxtaposition *is* the
  design work — an LLM makes that sentence false
- same seed → same hexagram is guaranteed and printed; LLM output is not
  reproducible, so the provenance panel would break at the last step
- the I Ching's mechanism is that **you** do the interpreting

And the real answer: the specificity I wanted was already in the source
material and I hadn't used it. 384 line statements, and a rule from the twelfth
century for which one applies.

Then the part I care about most:

> *"I am not going to type 384 lines of classical Chinese from memory."*

384 lines of classical Chinese is exactly what comes out looking plausible and
being wrong. They were fetched from Chinese Wikisource instead, and checked
against the trigram-derived binary through the line-position names themselves —
every line statement is labelled with the word for *nine* or the word for
*six*, which mean a yang line and a yin line respectively, so the classical
text encodes the same six bits the generator derives independently from the
trigram table. Two sources agreeing on 384 values is a far stronger guarantee
than either one alone, and the build refuses to write its output if a single
label disagrees.

The validator earned itself immediately, on two faults no amount of proofreading
would have caught:

- **Hexagram 12** separates each position label from its text with a full-width
  comma, where every other chapter in the book uses a full-width colon — so the
  parser silently produced six empty strings for it.
- **Hexagram 32's** Wikisource page is filed under a variant form of its name,
  not the form in my own character table, so the URL built from that table
  returned a 404 for that one hexagram.

---

### 9. The refusal did not actually refuse

Found while rehearsing the demo video, not while writing code. I turned the
wifi off, asked a question, and expected the page to refuse — and the second
column answered anyway.

Nothing was wrong with the error handling. The browser was serving that
response out of its own HTTP cache: sunrise and sunset for a fixed latitude
are identical all day, so the API sends a long `max-age`, and `fetch()` will
happily satisfy a request from disk while offline. The page was casting from a
reading of a world it could no longer see — which is the exact substitution the
README says it will never make. The refusal case had been tested by watching
the message appear, and the message had been appearing for a reason I had not
checked.

The fix is one option on three calls: `cache: "no-store"`. The lesson is the
one the assignment keeps pointing at from a different angle — *the code looked
right and the output looked right, and it was still lying.* I would not have
found this by reading it, only by unplugging something and watching what
refused to break.
