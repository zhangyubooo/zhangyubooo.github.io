// packing.js — the finale. Once all sixteen rods are in the box, they are packed
// the way the real set travels: laid side by side on the tray, the tray stood
// up and slid into its case, and the lid slid shut along its groove.
//
// The tray, case and lid are Yubo's own CAD model of the set (Fusion → .3mf →
// models/rod-box.json). The rods are plain boxes at the model's real size,
// 5.3 × 5.3 × 53.3 mm. Everything is in millimetres with z pointing up, like
// the CAD file.
//
// The animation is a pure function of time: pose(t) puts every part where it
// should be at t seconds. That makes it easy to replay, skip to the end
// (reduced motion), or reason about one step at a time.

import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, BoxGeometry, PlaneGeometry,
  BufferGeometry, BufferAttribute, MeshStandardMaterial, ShadowMaterial,
  HemisphereLight, DirectionalLight, Vector3, MathUtils,
  PCFSoftShadowMap, SRGBColorSpace, ACESFilmicToneMapping, OrbitControls, CanvasTexture,
} from "../vendor/three-napier.min.js";
import { CARDS } from "./cards.js";

// ---------------------------------------------------------------------------
// 1. Measurements taken from the CAD model (mm)
// ---------------------------------------------------------------------------
const ROD = { w: 5.3, len: 53.3 };
const ROD_COUNT = 16;
const ROD_PITCH = 5.57;          // 16 rods share the tray's 89.1 mm floor, leaving hairline gaps
const ROD_FIRST_X = -38.76;      // centre of the first rod, relative to the tray's centre
const ROD_Y = 1.88;              // rods sit beside the tray's end lip
const ROD_Z = 0.8;               // resting on the tray floor (1.8 mm thick)

const CASE_AT = new Vector3(130, 60, 32.55);                    // where the case stands in the scene
const TRAY_START = new Vector3(0, 0, 3.75);                     // tray lying flat on the table
const TRAY_PACKED = CASE_AT.clone().add(new Vector3(0.3, 0.27, -0.78));  // standing in the case's cavity
const TRAY_ABOVE = TRAY_PACKED.clone().add(new Vector3(0, 0, 62));     // just above the opening
const LID_CLOSED = CASE_AT.clone().add(new Vector3(2.24, 0.17, 29.9));  // in the groove at the top
const LID_OPEN = LID_CLOSED.clone().add(new Vector3(105, 0, 0));       // slid out to the right

// ---------------------------------------------------------------------------
// 2. The timeline (seconds)
// ---------------------------------------------------------------------------
const T = {
  rodStagger: 0.17, rodFall: 0.9,      // rods tip over and drop onto the tray, one after another
  standUp: [4.1, 5.3],                 // tray rotates upright
  carry: [5.3, 6.7],                   // tray moves above the case
  slideIn: [6.7, 8.0],                 // tray slides down into the case
  lid: [8.2, 9.5],                     // lid slides shut
};
const END = T.lid[1];

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);   // easeInOutCubic
/** 0 before `range[0]`, 1 after `range[1]`, eased in between. */
const progress = (t, [a, b]) => ease(MathUtils.clamp((t - a) / (b - a), 0, 1));

// ---------------------------------------------------------------------------
// 3. Building the scene
// ---------------------------------------------------------------------------
function meshFromPart(part, material) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(part.positions), 3));
  geometry.setIndex(part.indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The face of one rod: bone-coloured, with its Roman numeral stacked letter
 * over letter at the top end — the same marking as the rods in the box.
 * Drawn on a canvas 1:10 like the rod itself, then used as a texture.
 */
function numeralTexture(numeral) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#efe4c9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#3a2a18";
  ctx.font = '88px "IM Fell English SC", "IM Fell English", Georgia, serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  [...numeral].forEach((letter, i) => ctx.fillText(letter, canvas.width / 2, 28 + i * 76));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function buildScene(model) {
  const scene = new Scene();

  // Light: soft sky + one warm key light that casts shadows onto the table.
  scene.add(new HemisphereLight(0xfff2dc, 0x2a1d12, 1.1));
  const key = new DirectionalLight(0xffe2b8, 2.6);
  key.position.set(170, -230, 260);    // front-right, so the falling rods' shadows miss the case
  key.target.position.set(65, 30, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 700 });
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);

  const table = new Mesh(new PlaneGeometry(1200, 1200), new ShadowMaterial({ opacity: 0.35 }));
  table.receiveShadow = true;
  scene.add(table);

  const wood = (color) => new MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, flatShading: true });
  const bone = new MeshStandardMaterial({ color: 0xefe4c9, roughness: 0.55 });

  const caseMesh = meshFromPart(model.parts.case, wood(0x9a6a3e));
  caseMesh.position.copy(CASE_AT);
  const lid = meshFromPart(model.parts.lid, wood(0xa8763f));

  // The tray and its rods move together, so the rods are children of a group.
  const trayGroup = new Group();
  trayGroup.add(meshFromPart(model.parts.tray, wood(0xb08050)));
  const rodGeometry = new BoxGeometry(ROD.w, ROD.len, ROD.w);   // long side along y, like the CAD rods
  const rods = [];
  for (let i = 0; i < ROD_COUNT; i += 1) {
    // A box has six faces (+x, −x, +y, −y, +z, −z). The +z face is the one that
    // faces up on the tray and faces the visitor once the tray stands, so it
    // gets the numeral; the other five stay plain bone.
    const face = new MeshStandardMaterial({ map: numeralTexture(CARDS[i].numeral), roughness: 0.55 });
    const rod = new Mesh(rodGeometry, [bone, bone, bone, bone, face, bone]);
    rod.castShadow = true;
    rod.receiveShadow = true;
    trayGroup.add(rod);
    rods.push(rod);
  }

  scene.add(caseMesh, lid, trayGroup);
  return { scene, trayGroup, rods, lid };
}

// ---------------------------------------------------------------------------
// 4. pose(t): where everything is at time t
// ---------------------------------------------------------------------------
function pose(parts, t) {
  const { trayGroup, rods, lid } = parts;

  // Rods: each starts standing upright above its place, tips over and drops.
  rods.forEach((rod, i) => {
    const start = 0.2 + i * T.rodStagger;
    const p = progress(t, [start, start + T.rodFall]);
    rod.position.set(ROD_FIRST_X + i * ROD_PITCH, ROD_Y, MathUtils.lerp(ROD_Z + 70, ROD_Z, p));
    rod.rotation.x = MathUtils.lerp(Math.PI / 2, 0, p);   // upright → lying along the tray
    rod.visible = t >= start - 0.15;                       // appear just before their turn
  });

  // Tray: stand up (+90° about x turns the rods to face the visitor), carry, slide in.
  const up = progress(t, T.standUp);
  const carry = progress(t, T.carry);
  const slide = progress(t, T.slideIn);
  trayGroup.rotation.x = Math.PI / 2 * up;
  const standing = TRAY_START.clone().add(new Vector3(0, 0, 28.8 * up));   // lift so it clears the table
  const pos = standing.lerp(TRAY_ABOVE, carry);
  pos.z += Math.sin(carry * Math.PI) * 18;                                  // a little arc while carried
  trayGroup.position.copy(pos.lerp(TRAY_PACKED, slide));

  // Lid: slides along its groove from the right.
  lid.position.copy(LID_OPEN.clone().lerp(LID_CLOSED, progress(t, T.lid)));
}

// ---------------------------------------------------------------------------
// 5. Public: start the animation inside `container`
// ---------------------------------------------------------------------------
export async function startPacking(container, { reducedMotion = false, onDone = () => {} } = {}) {
  await document.fonts.ready;   // the numerals are drawn with the page's typeface
  const response = await fetch("models/rod-box.json");
  if (!response.ok) throw new Error("The model of the case could not be loaded.");
  const model = await response.json();

  const parts = buildScene(model);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  container.replaceChildren(renderer.domElement);

  const camera = new PerspectiveCamera(26, 1, 1, 3000);
  camera.up.set(0, 0, 1);                                    // z is up, as in the CAD model
  const target = new Vector3(76, 34, 48);
  camera.position.copy(target).add(new Vector3(-145, -390, 205));

  // Visitors can drag to turn the set; it slowly turns by itself once packed.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 180;
  controls.maxDistance = 700;
  controls.maxPolarAngle = Math.PI * 0.48;                   // never below the table
  controls.autoRotateSpeed = 0.6;

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let startTime = performance.now() - (reducedMotion ? END * 1000 : 0);
  let finished = false;
  let frame = 0;

  function tick(now) {
    const t = (now - startTime) / 1000;
    pose(parts, t);
    if (!finished && t >= END) {
      finished = true;
      controls.autoRotate = !reducedMotion;
      onDone();
    }
    // Once packed, ease the view's centre onto the closed case so it turns in place.
    controls.target.lerp(t >= END ? CASE_AT : target, 0.04);
    controls.update();
    renderer.render(parts.scene, camera);
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    /** Jump to t seconds (used for testing, and for screenshots of single steps). */
    seek(t) {
      startTime = performance.now() - t * 1000;
      finished = t >= END;
    },
    replay() {
      startTime = performance.now();
      finished = false;
      controls.autoRotate = false;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
