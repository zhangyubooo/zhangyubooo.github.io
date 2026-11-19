// The camera: webcam (or the gallery camera) + MediaPipe Hand Landmarker, running in the
// browser. Frames are read on this computer and never sent anywhere.

const MP_VERSION = "1.2.3";
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Bones of the hand, for drawing on the little camera preview.
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/** One getUserMedia call for both camera and microphone, so the browser asks once. */
export async function openCameraAndMicrophone() {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

async function loadLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import(`${MP_URL}/vision_bundle.mjs`);
  const vision = await FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    return HandLandmarker.createFromOptions(vision, options("CPU"));
  }
}

/**
 * Start watching hands. Calls onFrame(hands, now) for every new camera frame,
 * where hands is an array of 21-landmark arrays. Draws what it sees on `bones`.
 * Returns { stop }.
 */
export async function watchHands({ stream, video, bones, onFrame }) {
  video.srcObject = new MediaStream(stream.getVideoTracks());
  await video.play();
  const landmarker = await loadLandmarker();
  const ctx = bones.getContext("2d");
  let lastTime = -1, raf = 0, stopped = false;

  function draw(hands, kinds) {
    ctx.clearRect(0, 0, bones.width, bones.height);
    hands.forEach((hand, i) => {
      const colour = kinds?.[i] ? "#F0A046" : "rgba(240,234,220,.8)";
      const px = (p) => [(1 - p.x) * bones.width, p.y * bones.height];   // mirrored, like the preview video
      ctx.strokeStyle = colour; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b] of BONES) { ctx.moveTo(...px(hand[a])); ctx.lineTo(...px(hand[b])); }
      ctx.stroke();
      ctx.fillStyle = colour;
      for (const p of hand) { const [x, y] = px(p); ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    });
  }

  function loop() {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const now = performance.now();
    const hands = landmarker.detectForVideo(video, now).landmarks || [];
    const kinds = onFrame(hands, now);
    draw(hands, kinds);
  }
  loop();

  return {
    stop() { stopped = true; cancelAnimationFrame(raf); landmarker.close?.(); },
  };
}
