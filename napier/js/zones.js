// The three sets of exhibit screens, following the screen UI package
// (Rhino model `posner center latest.3dm`, 2026-11-11). All drawing coordinates
// are in design units: 1500 wide; the square screen is 1500 × 1500, the tall
// screens 1500 × 3176 (17″ × 36″).
//
//   rods        Set 1 · Rods 2–7 Touch & Learn — six square screens, one page each
//               by default (?page=1…6), visitors can page through all of them;
//               page 7 is the 3D model of the set (unpack it, drag the pieces)
//   promptuary  Set 2 · Rod 15 Promptuarium — tall screen, chat always on screen
//   location    Set 3 · Rod 16 Location Arithmetic — tall screen, chat always on screen
//
// `seed` is a starting conversation shown in the chat (written for the screen, not by
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
    kicker: "PROMPTUARIUM  ·  AT THE WALL",
    pages: [
      { art: "promptSteps", title: "Using the wall", footer: "Try it at the wall →" },
    ],
    section: "STUCK?  ASK NAPIER",
    seed: [
      ["Which plate do I take?", "The one with your multiplier on it. For ×7, take plate 7 — its holes show only the digits you need."],
      ["Then what?", "Read each diagonal from right to left and add the digits. Carry the 1 when a sum passes 9."],
    ],
    presets: [
      { id: "p1", question: "What is a promptuary?",
        fallback: "Promptuarium means a storehouse. It is strips of numbers, like my rods, with perforated plates laid across them, and a box whose lid is the board you work upon." },
      { id: "p2", question: "Why do only some squares light up?",
        fallback: "Each plate is cut with little triangular holes, so only the digits that matter show through. Add what you see along each diagonal: 98765 × 7 = 691,355." },
      { id: "p3", question: "Is it better than the rods?",
        fallback: "It multiplies a long number by a long number without writing down the partial sums. I confess it needs a great many pieces, and laying them out takes nearly as long as pen and paper." },
      { id: "p4", question: "Does a real one still exist?",
        fallback: "Only one is known, I am told: a small cabinet of wood inlaid with bone, in Madrid. My rods sit above, and its drawers hold 200 plain strips and 100 perforated ones." },
    ],
  },

  location: {
    id: "location",
    shape: "tall",
    kicker: "LOCATION ARITHMETIC  ·  ON THE FLOOR",
    pages: [
      { art: "locSteps", title: "How to play", footer: "Step onto the floor grid →" },
    ],
    section: "STUCK?  ASK NAPIER",
    seed: [
      ["How do I pick a number?", "Stand still on a square for 5 seconds. The squares you light add up: 8 and 1 make 9."],
      ["How do I see the answer?", "Step onto START. The wall lights up the squares that add up to 9 × 12 = 108."],
    ],
    presets: [
      { id: "l1", question: "How can a chessboard count?",
        fallback: "Give each square a value twice the last: 1, 2, 4, 8, and so on. Any number is then the squares that add to it. Nine is 8 and 1." },
      { id: "l2", question: "How does standing on squares multiply?",
        fallback: "Move a counter one square and its worth doubles; two on the same square make one on the next. So multiplying becomes doubling and adding, and the wall finds 9 × 12 = 108." },
      { id: "l3", question: "Is this the same as binary?",
        fallback: "So I am told. Thirteen in my letters is acd, which your century writes 1101. A gentleman named Leibniz wrote of 0 and 1 in 1703, long after me." },
      { id: "l4", question: "Why did no one use it?",
        fallback: "I thought it more of a lark than a labour. But turning numbers into letters and back again was more trouble than most would take, so it was kept as a curiosity." },
    ],
  },
};

export const ZONE_ORDER = ["rods", "promptuary", "location"];

// Design sizes, in design units
export const SHAPES = {
  square: { w: 1500, h: 1500 },
  tall: { w: 1500, h: 3176 },
};
