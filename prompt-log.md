# Prompt Log — Project 1: Personal Portfolio Website

**Yubo Zhang · 15-113 · Fall 2026**
Site: https://zhangyubooo.github.io/
Repo: https://github.com/zhangyubooo/zhangyubooo.github.io

---

## About this log

**Tool used:** Claude (Anthropic), via the Claude desktop app. This was the only
AI tool used on the project.

**A note on format.** The whole session was conducted in Chinese, which is the
language I think fastest in. The prompts below are my own prompts translated into
English; the replies are **summarized**, not pasted verbatim, because the full
exchange runs to tens of thousands of words. I kept the parts that mattered: the
technical explanation, the trade-off, and what I actually decided to do with it.
The complete raw transcript is available on request.

**What I want this log to show.** Not that I asked an AI to build a website —
it didn't. It explained things, proposed options, and wrote code I then read,
questioned, and repeatedly sent back. The entries below are organized around the
decisions, because the decisions are the part that's mine.

---

## Aug 31 — Setup and deployment

### Getting started

> **Prompt:** I'm starting from zero, walk me through it step by step.

**Reply (summary):** Proposed doing deployment *first* — build a one-line
`index.html`, get GitHub Pages serving it, and only then write real content. The
reasoning: writing code and publishing code are two independent chains, and
beginners typically break the second one on the last night. Getting a "walking
skeleton" live first turns debugging from a two-week time bomb into a 30-second
feedback loop.

**My decision:** Adopted. This turned out to be the single most useful piece of
process advice in the project — every later change was verifiable live within a
minute.

### Repository naming

> **Prompt:** (screenshot of the GitHub new-file screen) I can't click commit.

**Reply (summary):** The filename field was empty. Separately, flagged that the
breadcrumb suggested my repo was named `yubozhang`, not `zhangyubooo.github.io`,
which would make it a *project site* served from `/yubozhang/` instead of a
*user site* served from the root.

**My decision:** Renamed the repo. Two reasons — the URL is going on my résumé
and a root-level one reads better, and every relative path in the project stays
one level simpler. Renaming with two files in the repo cost nothing; renaming
after sharing the link would have cost a lot.

### Moving off the GitHub web editor

> **Prompt:** What's the next step?

**Reply (summary):** Recommended GitHub Desktop + VS Code + the Live Preview
extension rather than the browser editor. GitHub Desktop specifically because
GitHub stopped accepting passwords in 2021 and configuring SSH keys or a personal
access token is where beginners lose an evening.

**My decision:** Adopted. Also learned the commit/push distinction here — commit
saves locally, push uploads. I lost a few minutes to "why isn't the live site
updating" before that clicked.

---

## Sep 2–3 — Structure, content, and design decisions

### Planning the projects section

> **Prompt:** Do I need to decide which projects go in first?

**Reply (summary):** Not the final list, but three things that determine layout:
how many project slots the design has to survive (the grid has to still look
right at 8 projects, not just 2), which fields every card carries, and one
consistent image aspect ratio. Warned that mixed aspect ratios are the most
common reason a project grid looks messy.

**My decision:** Locked 3:2 for all covers, and settled the card fields as
title + category line. Later I understood *why* this works: `aspect-ratio` plus
`object-fit: cover` in CSS unifies any source image without me hand-cropping,
and changing one variable changes every cover on the site.

### Aspect ratio, reversed

> **Prompt:** Let's make them all 3:2 horizontal, I've already picked the three
> Lethe covers.

**Reply (summary):** Flagged the cost honestly — runway photography is almost
always shot vertical, and a 3:2 horizontal crop would cut the top and bottom off
a full-length look. Suggested I test-crop before committing.

**My decision:** Kept 3:2. Consistency across the grid mattered more to me than
any single image, and the photos I chose crop acceptably. This is a trade-off I
made with my eyes open rather than a default I inherited.

### Typography direction

> **Prompt:** (reference screenshots) Tighten the gap between cover and text,
> and change the type to match the reference.

**Reply (summary):** Pointed out that the reference isn't using a serif at all —
it's a single grotesk throughout — and that what actually makes it read the way
it does isn't the typeface, it's three structural choices: title and category
line set at the *same* size with hierarchy carried by colour instead of scale;
negative letter-spacing on large type; and cover/title/tags spaced tightly enough
to read as one unit. Was also honest that it couldn't identify the exact
reference typeface, only the family it belongs to.

**My decision:** Dropped the serif, went single-typeface (Inter). The
same-size/different-colour hierarchy was the change that mattered — I'd been
using size for everything, which is the reflex from print layout where you have
more room.

---

## Sep 3 — Debugging: the scroll-snap failure

This is the entry I'd point a TA at, because it's the one where the first answer
was wrong.

> **Prompt:** Between page one and page two, scrolling shows me half of the
> projects section. I want it to jump straight there — no in-between state.

**Reply (summary):** Change `scroll-snap-type` from `proximity` to `mandatory`,
and add `scroll-snap-stop: always` so a hard flick can't skip a snap point. Also
recommended disabling snap under `prefers-reduced-motion`, since forced snapping
takes scroll control away from the user and can trigger nausea for people with
vestibular disorders.

> **Prompt:** Problem solved, but when I scroll to the email row at the bottom it
> jumps back up to the top of the projects section.

**Reply (summary):** Explained the actual mechanism: `mandatory` requires the
scroll to come to rest *on* a snap point. My page has two. At the very bottom of
the document the viewport doesn't align with either, so the browser drags me back
to the nearest one. The spec has an exception for snap areas taller than the
viewport, but browser implementations differ — especially when the last screenful
of content is shorter than the viewport, which mine is. Proposed replacing the
CSS approach with ~20 lines of JS that intercept *only* the intro → projects
transition and leave scrolling inside the projects section completely alone.

> **Prompt:** Still bouncing after the JS change.

**Reply (summary):** Asked to see the actual files rather than keep guessing. I
connected the repo folder. Two problems: four `scroll-snap` declarations were
still in the CSS and fighting the new JS, and a code sample had been pasted into
the wrong block, leaving `scroll-behavior: smooth` inside the
`prefers-reduced-motion` rule — the exact opposite of the intent.

**What I take from this:** I tried the simple pure-CSS solution first, understood
concretely why it failed at the boundary, and only then took on the extra
complexity of JavaScript. That order is the point. Also: the second bug was mine,
from pasting a snippet into the wrong place, and it was invisible until someone
read the file — which is an argument for reading code before pasting it.

---

## Sep 3 — JavaScript

> **Prompt:** Let's start on JS.

**Reply (summary):** Proposed three features on one API — `IntersectionObserver`:
the nav bar appearing after the intro scrolls away, the multi-image cover
carousels, and playing cover videos only while they're on screen. Explained why
not to use `scroll` events: they fire dozens of times per scroll, and
`getBoundingClientRect()` forces a synchronous layout recalculation
("layout thrashing"). `IntersectionObserver` hands the work to the browser and
notifies you once, when the state actually changes.

**My decisions and changes:**

- Kept `data-*` attributes as the JS hooks (`data-carousel`, `data-autoplay`)
  rather than classes, so that restyling can't accidentally break behaviour. When
  I later added the Play page, its videos worked with **zero** JavaScript
  changes — just the attribute. That convention paid for itself within two days.
- Set the timing values myself in the browser: carousel 3200 ms, nav trigger at
  40% intro visibility, media playback at 30% visibility.
- Kept the `prefers-reduced-motion` guard and the `visibilitychange` pause.
  Neither is visible in a demo; both are the difference between working and
  working *considerately*.

---

## Sep 3–5 — Media processing

> **Prompt:** The Restless Mind cover video isn't made yet, I have a 9-second clip.

**Reply (summary):** Explained why not GIF — a 4-second GIF is ~8–15 MB against
~300–600 KB for the same content as MP4, and GIF is limited to 256 colours, which
visibly bands gradients. Then listed the required `<video>` attributes and why
each is non-optional: `muted` (browsers refuse autoplay without it),
`playsinline` (iOS force-fullscreens without it), `poster` (otherwise the slot is
blank until the video loads), and `faststart` (moves the index to the head of the
file so playback can start before the download finishes).

**Processing done for me, with parameters I understand:** trimmed to 8s, scaled
1620×1080 → 1200×800, 30 → 24 fps, `hqdn3d` denoise, CRF 32, audio stripped.
Result: ~10 Mbps source → 507 KB.

The denoise step is the one worth knowing about. The venue was dim, so the phone
footage carries heavy sensor noise. Noise is random, so the codec can't predict it
and spends most of its bitrate encoding it. Removing it first halves the file at
the same visual quality.

The Play page videos hit a different problem: one was HEVC (H.265). Safari plays
it, Chrome and Firefox frequently don't — the classic "works on my Mac, black box
on my classmate's laptop" bug. Transcoded to H.264. The other was a 4K60 10-second
clip at 56 MB, which is a *capture* format, not a *delivery* format; it compressed
to 205 KB at the size the page actually displays it.

**My judgment:** I used AI for the encoding rather than doing it by hand in
Premiere, because video transcoding isn't what this course is assessing and the
parameters are ones I can now explain. The design decisions — which seconds to
use, whether to crop the frame (I chose not to) — stayed mine.

---

## Sep 3–5 — Page structure changes

> **Prompt:** I talked to a TA — the website itself doesn't need to be in the
> projects section, the GitHub link can go at the bottom of About.

**Reply (summary):** Agreed the TA's placement is better: a link to the site's own
source is metadata *about* the site, not a portfolio project. Noted that the
design term for that block is a colophon, and that many designer portfolios put it
exactly there.

**My decision:** Moved it. Also noticed the knock-on effect — removing it left
three projects in a two-column grid, i.e. an orphan in the last row. I later
resolved that by adding Monarch Migration, which brought the count back to four.

> **Prompt:** Rename Info to About, and add a Play page for experiments — no
> captions, don't crop anything, newest first.

**Reply (summary):** Renamed the file and the CSS classes together rather than
leaving `.info__*` class names on a page labelled About, on the grounds that a
name that no longer matches its subject is where "unreadable code" starts. For
the gallery, used CSS multi-column rather than grid: with uncropped media every
item is a different height, and multi-column is built for exactly that — no
JavaScript masonry library needed. Was explicit about the cost: multi-column fills
column one before column two, so the reading order is columnar rather than
strictly newest-first.

**My decision:** Accepted the trade-off. For a gallery with no captions, exact
chronological reading order isn't information the viewer needs.

---

## What I learned

**HTML describes meaning, not appearance.** `<h1>` isn't "big bold text", it's
"the most important heading on this page" — and screen readers navigate by that
structure. `alt` text was the concrete version of this lesson: I first wrote
`Full Line Photoshoot`, which is a caption, not a description. Someone who can't
see the image learns nothing from it. Rewrote all of them to describe what's
actually in frame.

**A design system in code is the same object as a design system in Figma.** CSS
custom properties for colour, type scale and spacing are Figma Styles with
different syntax. `--cover-ratio: 3 / 2` controls every cover on the site from one
line. This was the idea that made CSS stop feeling like a pile of unrelated rules.

**Layout tools have different jobs.** Flex aligns everything on one axis at once,
which is why "greeting pinned to the top, body text centred in the space below"
is impossible with it — that needs Grid, which lets you split space into rows and
align each independently. Multi-column is for a third case again: content of
uneven heights flowing into tracks.

**Constraints beat breakpoints.** `clamp()` and
`repeat(auto-fit, minmax(190px, 1fr))` replaced whole blocks of media queries.
Instead of enumerating screen sizes I state the constraint — never narrower than
this, never wider than that — and let the browser resolve it continuously.

**Accessibility is a design constraint, not a compliance checkbox.**
`prefers-reduced-motion`, visible keyboard focus, honest `alt` text, contrast
ratios: this is the web equivalent of designing for wheelchair access or glare in
a physical space. It doesn't make the design worse; it makes it true for more
people.

**Deployment is its own system.** Case-sensitive filenames (`.JPG` works on my
Mac and 404s on GitHub's Linux servers), relative paths, browser caching, git
history permanently retaining every large file you ever committed. None of this
is visible from the design side, and all of it can break a working site.

---

## How I used AI, and where I drew the line

**What AI did:** explained mechanisms I didn't know; proposed implementations;
named trade-offs I couldn't have known to look for; wrote first-draft code with
comments; handled video transcoding; found two bugs by reading my actual files
after I'd stopped being able to guess.

**What I did:** every content decision and all the writing; the visual direction
and the reference research; the aspect ratio, layout, ordering and typography
calls; all the numeric tuning, done by looking at the browser; deciding when a
proposal was wrong for my case; and the decision, more than once, to take the
simpler option and accept its limits.

**What I'd flag honestly:** I don't understand every line of the JavaScript at
the level of being able to write it unaided from memory. I do understand what
each block does, why it's structured that way, and what would break if I removed
it. When a suggestion arrived that I couldn't justify, I asked why before pasting
it — and twice that produced a better answer than the first one.

**The habit that mattered most:** asking "why this rather than the obvious
alternative?" nearly every time. That's where the scroll-snap trade-off, the
`IntersectionObserver`-vs-`scroll` argument, and the GIF-vs-MP4 comparison came
from. None of them were in the original answers; they came out of pushing on them.

---

## Credits

- Visual references: proper-code.com (centred single-screen intro) and a
  two-column student portfolio grid. Layout ideas were referenced and
  reimplemented from scratch; no template code was used.
- Typeface: Inter, via Google Fonts.
- Project photography credits appear on the individual project detail pages.
- All site code was written for this project. AI usage is documented in comments
  at the top of `style.css` and `script.js` and in this log.
