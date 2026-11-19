// Reading hands: 21 landmarks per hand (MediaPipe) → the two gestures the station knows.
//
//   point  index finger out, the other three curled  → a pointer on the wall; hold it on a rod to ask
//   palm   all four fingers out, hand held upright   → "I have a question": the microphone listens
//          while the hand stays up, and the question is sent when it comes down
//
// Landmarks are normalised to the camera image (x 0–1 left→right, y 0–1 top→bottom).
// The camera image is mirrored, so a hand moving to the visitor's left moves left on the wall.

const WRIST = 0;
const FINGERS = [            // [pip joint, tip] for index, middle, ring, little finger
  [6, 8], [10, 12], [14, 16], [18, 20],
];
const INDEX_TIP = 8, MIDDLE_TIP = 12;

const PALM_HOLD_MS = 450;    // a palm must be held this long before listening starts (no accidents)
export const PALM_LOST_MS = 650;    // ...and be gone this long before listening stops (detection flickers)
const POINT_LOST_MS = 350;   // the pointer survives a dropped frame or two
const SMOOTHING = 0.35;      // pointer: share of each new position (lower = steadier, slower)
// The part of the camera image a comfortable reach covers, stretched to the whole wall.
const REACH = { x0: 0.15, x1: 0.85, y0: 0.12, y1: 0.78 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A finger is out when its tip is clearly farther from the wrist than its middle joint. */
function extended(hand, [pip, tip]) {
  return dist(hand[WRIST], hand[tip]) > dist(hand[WRIST], hand[pip]) * 1.12;
}

/** "palm" | "point" | null for one hand. */
export function classify(hand) {
  if (!hand || hand.length < 21) return null;
  const out = FINGERS.map((f) => extended(hand, f));
  if (out.every(Boolean) && hand[MIDDLE_TIP].y < hand[WRIST].y) return "palm";
  if (out[0] && !out[1] && !out[2] && !out[3]) return "point";
  return null;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Index fingertip → position on the wall, 0–1 in both directions, mirrored like a looking-glass. */
export function aim(hand) {
  const tip = hand[INDEX_TIP];
  return {
    x: clamp01(((1 - tip.x) - REACH.x0) / (REACH.x1 - REACH.x0)),
    y: clamp01((tip.y - REACH.y0) / (REACH.y1 - REACH.y0)),
  };
}

/**
 * Turns a stream of hand frames into events:
 *   onPointer({x, y} | null)   where a pointing finger aims (0–1), or null when nobody points
 *   onRaise()                  a palm has been held up: start listening
 *   onLower()                  the palm came down: stop listening and send
 *   onSeen()                   any hand at all (keeps the station from going idle)
 */
export function createGestureTracker({ onPointer, onRaise, onLower, onSeen }) {
  let palmSince = null, lastPalm = -Infinity, raised = false;
  let lastPoint = -Infinity, pointer = null;

  return {
    get raised() { return raised; },

    /** Feed one camera frame: an array of hands (each 21 landmarks), and the time in ms. */
    feed(hands, now) {
      if (hands.length) onSeen?.();
      const kinds = hands.map(classify);
      const palm = kinds.includes("palm");
      const pointing = hands[kinds.indexOf("point")];

      if (palm) {
        lastPalm = now;
        palmSince ??= now;
        if (!raised && now - palmSince >= PALM_HOLD_MS) { raised = true; onRaise?.(); }
      } else {
        palmSince = null;
        if (raised && now - lastPalm >= PALM_LOST_MS) { raised = false; onLower?.(); }
      }

      if (pointing && !raised) {
        const target = aim(pointing);
        pointer = pointer
          ? { x: pointer.x + (target.x - pointer.x) * SMOOTHING, y: pointer.y + (target.y - pointer.y) * SMOOTHING }
          : target;
        lastPoint = now;
        onPointer?.(pointer);
      } else if (pointer && (raised || now - lastPoint >= POINT_LOST_MS)) {
        pointer = null;
        onPointer?.(null);
      }
    },

    /** Forget everything (start over, or the camera stopped). Does not fire onLower. */
    reset() {
      palmSince = null; raised = false; pointer = null;
      onPointer?.(null);
    },
  };
}
