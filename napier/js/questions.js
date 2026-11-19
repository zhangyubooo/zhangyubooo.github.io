// The six question rods beside the portrait: a visitor points at one to ask it.
// (`key` 1–6 is for testing on a computer without a camera.)
// Ids must match the "portrait" zone in the backend's zones.json. `fallback` is
// Napier's answer when the live portrait can't be reached (written from the
// backend's facts.md); `keywords` match a typed question to the nearest fallback.

export const QUESTIONS = [
  { id: "q1", keywords: ["rod", "bone", "multipl", "times"],
    key: "1", question: "Why did you make the rods?",
    fallback: "Long multiplication is slow and full of slips, a misery for astronomers, surveyors and merchants alike. With my rods it becomes reading a row and adding along the diagonals. I published them in 1617, the year I died." },
  { id: "q2", keywords: ["promptuar", "storehouse", "madrid", "strip"],
    key: "2", question: "Why didn't the promptuary catch on?",
    fallback: "I confess it asked too much: a box of strips and perforated plates, and laying them out took nearly as long as pen and paper. It spares you the partial sums, but few ever built one. Only one survives, I am told, in a cabinet in Madrid." },
  { id: "q3", keywords: ["chess", "binary", "board", "location", "0 and 1"],
    key: "3", question: "Is your chessboard really binary?",
    fallback: "So I am told. Each square is worth twice the last, so thirteen is acd, which your century writes 1101. A gentleman named Leibniz wrote of 0 and 1 in 1703, long after me, and your machines are said to count no other way." },
  { id: "q4", keywords: ["proud", "logarithm", "briggs", "best"],
    key: "4", question: "What are you proudest of?",
    fallback: "My logarithms, some twenty years of labour, which turn multiplying and dividing into adding and subtracting. Henry Briggs came to Edinburgh in 1615 to meet me, and by one account we stared at each other in silence for a quarter of an hour." },
  { id: "q5", keywords: ["warlock", "magic", "witch", "rooster", "wizard", "spirit"],
    key: "5", question: "Are you really a warlock?",
    fallback: "My neighbours thought so. They tell of a black rooster that would crow for a thieving servant; it was dusted with soot, and the clean hands belonged to the one too afraid to touch it. A little cunning, good visitor, not magic." },
  { id: "q6", keywords: ["century", "computer", "today", "future", "phone", "machine"],
    key: "6", question: "What would you make of my century?",
    fallback: "Machines of reckoning in every pocket, I am told, counting in nothing but 0 and 1, like my chessboard. I should want to open one up. I suspect it still reads tables, adds and doubles, only very much faster than I could." },
];

export const GREETING =
  "Good visitor, you have seen my rods, my storehouse and my chessboard. Point to one of my rods, or raise your hand and ask me aloud, and I shall answer.";

export const RESTING =
  "Forgive me, good visitor: the paint is still drying and I cannot answer that just now. Point to one of my rods, or ask me again.";
