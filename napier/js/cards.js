// The sixteen rods. Each rod is one question a visitor can present to Napier.
// The backend has its own copy (napier-backend/cards.json) with extra notes for
// the AI; the two lists must keep the same ids and questions.

export const CARDS = [
  { id: 1,  numeral: "I",    group: "The Rods",    title: "Of Bone",        question: "What are these rods made of?" },
  { id: 2,  numeral: "II",   group: "The Rods",    title: "Why Machines",   question: "Why make a machine for multiplying?" },
  { id: 3,  numeral: "III",  group: "The Rods",    title: "Reading Rods",   question: "How do I read the rods?" },
  { id: 4,  numeral: "IV",   group: "The Rods",    title: "Three Engines",  question: "What else hides in your Rabdologia?" },
  { id: 5,  numeral: "V",    group: "The Rods",    title: "The Point",      question: "Why is there a dot in your numbers?" },
  { id: 6,  numeral: "VI",   group: "The Man",     title: "Twenty Years",   question: "How long did the logarithms take you?" },
  { id: 7,  numeral: "VII",  group: "The Man",     title: "The Visitor",    question: "Who came to visit you in 1615?" },
  { id: 8,  numeral: "VIII", group: "The Man",     title: "Salt & Mirrors", question: "Were you only a mathematician?" },
  { id: 9,  numeral: "IX",   group: "The Man",     title: "Merchiston",     question: "Where did you live?" },
  { id: 10, numeral: "X",    group: "The Legends", title: "Warlock",        question: "Are you a warlock?" },
  { id: 11, numeral: "XI",   group: "The Legends", title: "The Rooster",    question: "Tell me about the black rooster." },
  { id: 12, numeral: "XII",  group: "The Legends", title: "The Pigeons",    question: "What happened to your neighbour's pigeons?" },
  { id: 13, numeral: "XIII", group: "The Legends", title: "The End",        question: "When will the world end?" },
  { id: 14, numeral: "XIV",  group: "For You",     title: "Your Century",   question: "What would you make of my century?" },
  { id: 15, numeral: "XV",   group: "For You",     title: "Spending Time",  question: "What should I do with my time?" },
  { id: 16, numeral: "XVI",  group: "For You",     title: "Memory",         question: "What do you remember of me?" },
];

// Card XVI ("What do you remember of me?") is locked until the other fifteen
// are in the box, so it is always the last rod presented.
export const MEMORY_CARD = 16;

export const cardById = (id) => CARDS.find((card) => card.id === id);
