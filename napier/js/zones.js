// The three sets of exhibit screens, following the screen UI package
// (Rhino model `posner center latest.3dm`, 2026-11-11). All drawing coordinates
// are in design units: 1500 wide; the square screen is 1500 × 1500, the tall
// screens 1500 × 3176 (17″ × 36″).
//
//   rods        Set 1 · Rods 2–7 Touch & Learn — six square screens, one page each
//               by default (?page=1…6), visitors can page through all of them;
//               page 7 is the 3D model of the set (unpack it, drag the pieces)
//   promptuary  Set 2 · Rod 15 Promptuarium — tall screen, 7 pages (handoff v2, 11-12)
//   location    Set 3 · Rod 16 Location Arithmetic — tall screen, 8 pages
//               On the tall screens the chat is a popup: the avatar or the page's
//               hint bubble opens it (the bubble also asks its question).
//
// `seed` is a starting conversation, already in the chat when it is opened (written for the screen, not by
// the AI): [question, answer, preset id it already answers (optional)]. Preset ids and questions must match the backend's zones.json; `fallback`
// is shown only if the backend can't be reached.

export const ZONES = {
  rods: {
    id: "rods",
    shape: "square",
    kicker: "NAPIER’S RODS  ·  1617",
    pages: [
      { art: "rodsIntro", title: "Napier’s Rods", footer: "John Napier, Scotland" },
      { art: "oneRod", title: "One rod, one table", footer: "each rod = one digit",
        seed: [["Why are they called “bones”?",
                "Fine sets were carved from bone or ivory — so people called them Napier’s bones.", "r1"]] },
      { art: "lineUp", title: "Line up the number", footer: "place rods side by side" },
      { art: "findRow", title: "Find the row", footer: "read across" },
      { art: "diagonals", title: "Add the diagonals", footer: "425 × 6",
        seed: [["Why add along the slants?",
                "Each slant gathers one place — ones, tens, hundreds. Add them, carry, and the answer appears.", "r2"]] },
      { art: "yourTurn", title: "Your turn", footer: "pick a rod ↓" },
      // Yubo's 3D model of the set (from Napier's Rod Box): double-tap to unpack, drag the pieces
      { art: "blank", widget: "rodBox", title: "The set in its box", footer: "a real set, modelled 1 : 1" },
    ],
    presets: [
      { id: "r1", question: "Why are they called bones?",
        fallback: "Because the finest sets were cut from bone or ivory, though boxwood served well enough. Each face carries the multiples of one digit, in squares split by a diagonal." },
      { id: "r2", question: "How do the diagonals work?",
        fallback: "Each square keeps the tens above the line and the units below. For 425 × 6, row six reads 24, 12 and 30; add along the slants from the right, carrying as you go, and you have 2550." },
      { id: "r3", question: "Can the rods multiply two big numbers?",
        fallback: "One reading multiplies a long number by a single digit. For a longer multiplier, take one reading for each of its digits, shift each by its place, and add them." },
      { id: "r4", question: "Why did you make them?",
        fallback: "Long multiplication is slow and full of slips, a misery for astronomers, surveyors and merchants alike. With the rods it becomes reading and adding. I published them in 1617, the year I died." },
      { id: "r5", question: "Did people really use them?",
        fallback: "I am told they did, for decades after me, in boxwood and later in brass. In 1628 a Jesuit named Giacomo Rho carried my rods into Chinese, in a book called Chou Suan." },
    ],
  },

  promptuary: {
    id: "promptuary",
    shape: "tall",
    kicker: "ALGORITHM 2  ·  PROMPTUARIUM",
    // pages exported from the tall-screen generator (source_scripts) as SVG
    pages: [
      { svg: "art/promptuary-p1.svg", title: "The Promptuarium", ask: "ph1" },
      { svg: "art/promptuary-p2.svg", title: "Meet the wall", ask: "ph2" },
      { svg: "art/promptuary-p3.svg", title: "Step 1 · Pick a plate", ask: "ph3" },
      { svg: "art/promptuary-p4.svg", title: "Step 2 · Hang it across", ask: "ph4" },
      { svg: "art/promptuary-p5.svg", title: "Step 3 · Add the slants", ask: "ph5" },
      { svg: "art/promptuary-p6.svg", title: "Two plates, bigger numbers", ask: "ph6" },
      { svg: "art/promptuary-p7.svg", title: "Your turn", ask: "ph7" },
    ],
    // the hint bubble's question on each page (tapping the bubble asks it)
    presets: [
      { id: "ph1", question: "What does ‘promptuarium’ mean?",
        fallback: "Promptuarium is Latin for a storehouse. Mine stores every times table on one board, and the black plates show only the answers you need." },
      { id: "ph2", question: "Why two windows in every square?",
        fallback: "Every answer has two digits. One window shows the tens above the slant, the other the units below it." },
      { id: "ph3", question: "Which plate do I take for × 7?",
        fallback: "Plate 7. Its digit is on the end tab; lift it off the rail by its edges." },
      { id: "ph4", question: "Which row should I hang it in?",
        fallback: "Any row works for one plate; the top row is easiest. With more plates, start at the top and fill the rows in order." },
      { id: "ph5", question: "What do I do with a carry?",
        fallback: "Write the last digit of the sum and carry the 1 into the next band to the left, as with 4 + 9 = 13." },
      { id: "ph6", question: "Why do the slants line up across rows?",
        fallback: "I put every answer in the same place in every square, so the slanted bands run straight through all the rows. Add each band as before." },
      { id: "ph7", question: "Can you check my answer?",
        fallback: "Gladly, but the answers are printed upside down on this page. Turn your head, and if they differ, tell me which digits you see." },
    ],
    // "TRY ASKING" in the chat popup
    chips: [
      { id: "pc1", question: "What does ‘promptuarium’ mean?",
        fallback: "Promptuarium is Latin for a storehouse. Mine stores every times table on one board, and the black plates show only the answers you need." },
      { id: "pc2", question: "How is this different from the rods?",
        fallback: "With my rods you write down a partial product for every digit. Here the plates line the answers up for you, and you only add small digits." },
      { id: "pc3", question: "Is 691,355 right?",
        fallback: "It is. 98765 is just under 100,000, so × 7 lands just under 700,000: 691,355." },
    ],
  },

  location: {
    id: "location",
    shape: "tall",
    kicker: "ALGORITHM 3  ·  LOCATION ARITHMETIC",
    // pages exported from the tall-screen generator (source_scripts) as SVG
    pages: [
      { svg: "art/location-p1.svg", title: "Location Arithmetic", ask: "lh1" },
      { svg: "art/location-p2.svg", title: "How the squares count", ask: "lh2" },
      { svg: "art/location-p3.svg", title: "Meet the floor", ask: "lh3" },
      { svg: "art/location-p4.svg", title: "Step 1 · First number", ask: "lh4" },
      { svg: "art/location-p5.svg", title: "Step 2 · Second number", ask: "lh5" },
      { svg: "art/location-p6.svg", title: "Step 3 · Stand on START", ask: "lh6" },
      { svg: "art/location-p7.svg", title: "Watching the wall", ask: "lh7" },
      { svg: "art/location-p8.svg", title: "Your turn", ask: "lh8" },
    ],
    // the hint bubble's question on each page (tapping the bubble asks it)
    presets: [
      { id: "lh1", question: "Why does every square double?",
        fallback: "Two of the same square make one of the next: 1 + 1 = 2, 2 + 2 = 4. So you never need a square twice." },
      { id: "lh2", question: "How do I make 11?",
        fallback: "Light 8, 2 and 1. 8 + 2 + 1 = 11." },
      { id: "lh3", question: "Which strip is my first number?",
        fallback: "The near strip, worth 8 4 2 1, is your first number. The strip toward the wall is your second." },
      { id: "lh4", question: "How do I switch a square off?",
        fallback: "Step off, then stand on that square again for 3 seconds. It switches off." },
      { id: "lh5", question: "Can two people play together?",
        fallback: "Indeed. Take one strip each, then one of you steps onto START." },
      { id: "lh6", question: "Where does the answer appear?",
        fallback: "The wall does the working, then the answer flies back down to the floor sum: 9 × 12 = 108." },
      { id: "lh7", question: "Why do the counters slide diagonally?",
        fallback: "One step down halves a square, one step left doubles it. Together they cancel, so a counter keeps its worth all the way to the bottom row." },
      { id: "lh8", question: "What’s the biggest answer?",
        fallback: "Light every square on both strips: 15 × 15 = 225." },
    ],
    // "TRY ASKING" in the chat popup
    chips: [
      { id: "lc1", question: "How do I switch a square off?",
        fallback: "Step off, then stand on that square again for 3 seconds. It switches off." },
      { id: "lc2", question: "What’s the biggest answer?",
        fallback: "Light every square on both strips: 15 × 15 = 225." },
      { id: "lc3", question: "Is this how computers count?",
        fallback: "So I am told. My squares are worth 1, 2, 4, 8 … and your century counts the same way, with 0 and 1." },
    ],
  },
};

export const ZONE_ORDER = ["rods", "promptuary", "location"];

// Design sizes, in design units
export const SHAPES = {
  square: { w: 1500, h: 1500 },
  tall: { w: 1500, h: 3176 },
};
