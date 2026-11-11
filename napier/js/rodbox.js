// rodbox.js — the rods page with Yubo's 3D model of the set (from Napier's Rod Box).
//
//   packed      the case stands closed and slowly turns; drag to look around
//   double-tap  unpack: the lid slides out and lies down, the tray is lifted out and
//               laid flat, and the sixteen rods are spread out on the table
//   unpacked    drag any piece (case, lid, tray, each rod) across the table;
//               drag empty space to turn the view; double-tap again to pack it all up
//
// The tray, case and lid are Yubo's CAD model (Fusion → .3mf → models/rod-box.json).
// The rods are boxes at the model's real size, 5.3 × 5.3 × 53.3 mm, with Napier's
// rod faces drawn on them. Millimetres, z up, like the CAD file.
//
// Packing reuses the Rod Box finale's timeline: pose(t) puts every part where it is
// t seconds into packing, so unpacking is the same timeline played backwards.

import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, BoxGeometry, PlaneGeometry,
  BufferGeometry, BufferAttribute, MeshStandardMaterial, ShadowMaterial, HemisphereLight, DirectionalLight,
  Vector2, Vector3, Quaternion, Plane, Raycaster, MathUtils, PCFShadowMap, SRGBColorSpace,
  ACESFilmicToneMapping, OrbitControls, CanvasTexture,
} from "../vendor/three-napier.min.js";

// ---------------------------------------------------------------------------
// 1. Measurements from the CAD model (mm) — as in the Rod Box finale
// ---------------------------------------------------------------------------
const ROD = { w: 5.3, len: 53.3 };
const ROD_COUNT = 16;
const ROD_PITCH = 5.57;
const ROD_FIRST_X = -38.76;
const ROD_Y = 1.88;
const ROD_Z = 0.8;
// A set of sixteen rods: digits 0–9, then a second 1–6 (opposite faces add to 9).
const ROD_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6];

const CASE_AT = new Vector3(130, 60, 32.55);
const TRAY_START = new Vector3(0, 0, 3.75);
const TRAY_PACKED = CASE_AT.clone().add(new Vector3(0.3, 0.27, -0.78));
const TRAY_ABOVE = TRAY_PACKED.clone().add(new Vector3(0, 0, 62));
const LID_CLOSED = CASE_AT.clone().add(new Vector3(2.24, 0.17, 29.9));
const LID_OPEN = LID_CLOSED.clone().add(new Vector3(105, 0, 0));
const LID_ON_TABLE = new Vector3(250, 5, 1.65);

// Packing timeline (s). Rods lie in the tray from RODS_IN on; the case is shut at END.
const T = { standUp: [4.1, 5.3], carry: [5.3, 6.7], slideIn: [6.7, 8.0], lidLift: [8.1, 9.2], lid: [9.3, 10.6] };
const RODS_IN = 3.9;
const END = T.lid[1];
const SPEED = 1.7;                // unpacking/packing plays faster than the Rod Box finale
const SPREAD_S = 1.6;             // rods lifting off the tray onto the table
const GATHER_S = 1.0;             // pieces returning before packing
const TABLE = { x: [-110, 320], y: [-140, 120] };   // where pieces may be dragged

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const progress = (t, [a, b]) => ease(MathUtils.clamp((t - a) / (b - a), 0, 1));

// ---------------------------------------------------------------------------
// 2. Building the scene
// ---------------------------------------------------------------------------
function meshFromPart(part, material) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(part.positions), 3));
  geometry.setIndex(part.indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** One face of a rod, drawn 1:10 like the rod: the digit, then its nine multiples. */
function rodFace(d) {
  const c = document.createElement("canvas");
  c.width = 100; c.height = 1000;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#efe4c9"; ctx.fillRect(0, 0, 100, 1000);
  ctx.strokeStyle = "#3a2a18"; ctx.fillStyle = "#3a2a18"; ctx.lineWidth = 3;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '62px Georgia, Gelasio, serif';
  ctx.fillText(String(d), 50, 52);
  for (let r = 1; r <= 9; r++) {
    const y = r * 100;
    ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(96, y); ctx.stroke();          // square
    ctx.beginPath(); ctx.moveTo(6, y + 96); ctx.lineTo(94, y + 4); ctx.stroke();  // diagonal
    const p = d * r, tens = Math.floor(p / 10), units = p % 10;
    ctx.font = '36px Georgia, Gelasio, serif';
    if (tens) ctx.fillText(String(tens), 28, y + 30);
    ctx.fillText(String(units), 72, y + 70);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildScene(model) {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xfff2dc, 0x2a2018, 1.15));
  const key = new DirectionalLight(0xffe2b8, 2.6);
  key.position.set(170, -230, 260);
  key.target.position.set(90, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 800 });
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);

  // The table itself is invisible: only the pieces' shadows show on the screen's dark ground.
  const shadow = new Mesh(new PlaneGeometry(1400, 1400), new ShadowMaterial({ opacity: 0.45 }));
  shadow.receiveShadow = true;
  scene.add(shadow);

  const wood = (color) => new MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
  const bone = new MeshStandardMaterial({ color: 0xefe4c9, roughness: 0.55 });

  const caseMesh = meshFromPart(model.parts.case, wood(0x9a6a3e));
  const lid = meshFromPart(model.parts.lid, wood(0xa8763f));
  const tray = new Group();
  tray.add(meshFromPart(model.parts.tray, wood(0xb08050)));

  const rodGeometry = new BoxGeometry(ROD.w, ROD.len, ROD.w);
  const rods = ROD_DIGITS.map((d) => {
    const up = new MeshStandardMaterial({ map: rodFace(d), roughness: 0.55 });
    const down = new MeshStandardMaterial({ map: rodFace(9 - d), roughness: 0.55 });
    const rod = new Mesh(rodGeometry, [bone, bone, bone, bone, up, down]);
    rod.castShadow = rod.receiveShadow = true;
    tray.add(rod);
    return rod;
  });

  for (const piece of [caseMesh, lid, tray, ...rods]) piece.userData.piece = true;
  scene.add(caseMesh, lid, tray);
  return { scene, caseMesh, lid, tray, rods };
}

/** Packing pose at t seconds (rods already lying in the tray for t ≥ RODS_IN). */
function pose({ caseMesh, tray, rods, lid }, t) {
  caseMesh.position.copy(CASE_AT);
  caseMesh.quaternion.identity();
  rods.forEach((rod, i) => {
    rod.position.set(ROD_FIRST_X + i * ROD_PITCH, ROD_Y, ROD_Z);
    rod.rotation.set(0, 0, 0);
  });
  const up = progress(t, T.standUp), carry = progress(t, T.carry), slide = progress(t, T.slideIn);
  tray.rotation.set(Math.PI / 2 * up, 0, 0);
  const pos = TRAY_START.clone().add(new Vector3(0, 0, 28.8 * up)).lerp(TRAY_ABOVE, carry);
  pos.z += Math.sin(carry * Math.PI) * 18;
  tray.position.copy(pos.lerp(TRAY_PACKED, slide));
  const [a, b] = T.lidLift;
  const lifted = new Vector3(
    MathUtils.lerp(LID_ON_TABLE.x, LID_OPEN.x, progress(t, [a + 0.3, b])),
    MathUtils.lerp(LID_ON_TABLE.y, LID_OPEN.y, progress(t, [a + 0.3, b])),
    MathUtils.lerp(LID_ON_TABLE.z, LID_OPEN.z, progress(t, [a, b])),
  );
  lid.position.copy(lifted.lerp(LID_CLOSED, progress(t, T.lid)));
  lid.quaternion.identity();
}

/** Where rod i lies on the table once unpacked: one row in front of the tray and case. */
function rodOnTable(i) {
  return new Vector3(-42 + i * 11.5, -88, ROD.w / 2);
}

const snap = (obj) => ({ p: obj.position.clone(), q: obj.quaternion.clone() });
function blend(obj, from, to, k) {
  obj.position.lerpVectors(from.p, to.p, k);
  obj.quaternion.slerpQuaternions(from.q, to.q, k);
}

// ---------------------------------------------------------------------------
// 3. Public: mount the viewer in `container`
// ---------------------------------------------------------------------------
export async function mountRodBox(container, { onStateChange = () => {} } = {}) {
  await document.fonts.ready;
  const response = await fetch("models/rod-box.json");
  if (!response.ok) throw new Error("The model of the set could not be loaded.");
  const parts = buildScene(await response.json());
  const { scene, caseMesh, lid, tray, rods } = parts;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  container.replaceChildren(canvas);

  const camera = new PerspectiveCamera(28, 1, 1, 4000);
  camera.up.set(0, 0, 1);
  const VIEW = {
    packed: { target: new Vector3(130, 60, 30), offset: new Vector3(-150, -330, 170) },
    open: { target: new Vector3(100, -32, 0), offset: new Vector3(-60, -390, 440) },
  };
  camera.position.copy(VIEW.packed.target).add(VIEW.packed.offset);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VIEW.packed.target);
  Object.assign(controls, {
    enableDamping: true, enablePan: false, minDistance: 160, maxDistance: 900,
    maxPolarAngle: Math.PI * 0.47, autoRotate: !reduced, autoRotateSpeed: 0.7,
  });

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // ---- state ----------------------------------------------------------------
  let state = "packed";            // packed | unpacking | open | packing
  let anim = null;                 // { start, duration, step(seconds) }
  let touched = false;             // anything moved since the last reset
  let viewGoal = null;             // camera target/offset being eased toward
  pose(parts, END);

  function setState(s) { state = s; onStateChange(s); }
  function play(duration, step, done) {
    const start = performance.now();
    anim = { start, duration: reduced ? 0 : duration, step, done };
  }
  function goView(name) { viewGoal = VIEW[name]; }

  /** Rods leave the tray: re-parent them to the scene, keeping where they are. */
  const releaseRods = () => rods.forEach((rod) => scene.attach(rod));
  const holdRods = () => rods.forEach((rod) => tray.attach(rod));

  function unpack() {
    if (state !== "packed") return;
    setState("unpacking");
    touched = true;
    controls.autoRotate = false;
    goView("open");
    const backwards = (END - RODS_IN) / SPEED;
    play(backwards, (s) => pose(parts, END - s * SPEED), () => {
      // rods lift off the tray and spread out on the table, one after another
      releaseRods();
      const from = rods.map(snap);
      const to = rods.map((_, i) => ({ p: rodOnTable(i), q: new Quaternion() }));
      play(SPREAD_S, (s) => rods.forEach((rod, i) => {
        const k = progress(s, [i * 0.04, i * 0.04 + SPREAD_S - 0.6]);
        blend(rod, from[i], to[i], k);
        rod.position.z += Math.sin(k * Math.PI) * 22;
      }), () => setState("open"));
    });
  }

  function pack() {
    if (state !== "open") return;
    setState("packing");
    touched = true;
    goView("packed");
    // First every piece goes back to where unpacking left it — case home, lid on the
    // table, tray flat, each rod in its slot — then the packing timeline runs on.
    const flat = new Quaternion();
    const goal = new Map([
      [caseMesh, { p: CASE_AT.clone(), q: flat }],
      [lid, { p: LID_ON_TABLE.clone(), q: flat }],
      [tray, { p: TRAY_START.clone(), q: flat }],
      ...rods.map((rod, i) => [rod, { p: TRAY_START.clone().add(new Vector3(ROD_FIRST_X + i * ROD_PITCH, ROD_Y, ROD_Z)), q: flat }]),
    ]);
    const from = new Map([...goal.keys()].map((o) => [o, snap(o)]));
    play(GATHER_S, (s) => {
      const k = ease(Math.min(1, s / GATHER_S));
      for (const [obj, g] of goal) {
        blend(obj, from.get(obj), g, k);
        obj.position.z += Math.sin(k * Math.PI) * 14;
      }
    }, () => {
      holdRods();
      play((END - RODS_IN) / SPEED, (s) => pose(parts, RODS_IN + s * SPEED), () => {
        setState("packed");
        controls.autoRotate = !reduced;
      });
    });
  }

  // ---- pointer: double-tap toggles, drag moves a piece --------------------------
  const ray = new Raycaster(), ndc = new Vector2();
  const floor = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  let drag = null;                 // { obj, offset, z, id }
  let down = null;                 // { x, y, time, moved }
  let lastTap = { time: 0, x: 0, y: 0 };

  function toNdc(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function pieceUnder(e) {
    toNdc(e);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects([caseMesh, lid, tray, ...rods], true)) {
      let o = h.object;                         // the tray's mesh belongs to the tray group
      while (o && !o.userData.piece) o = o.parent;
      if (o) return { obj: o, point: h.point };
    }
    return null;
  }

  // capture phase: runs before OrbitControls' own pointerdown on the same canvas
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, time: performance.now(), moved: false };
    if (state !== "open") return;
    const found = pieceUnder(e);
    if (!found) return;
    const obj = found.obj;
    floor.constant = -found.point.z;
    ray.ray.intersectPlane(floor, hit);
    drag = { obj, offset: obj.position.clone().sub(hit), z: obj.position.z, id: e.pointerId };
    obj.position.z = drag.z + 6;              // lift a little while held
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    touched = true;
  }, { capture: true });

  canvas.addEventListener("pointermove", (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
    if (!drag) {
      if (state === "open" && e.pointerType === "mouse") canvas.style.cursor = pieceUnder(e) ? "grab" : "";
      return;
    }
    toNdc(e);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(floor, hit)) return;
    const p = hit.add(drag.offset);
    drag.obj.position.x = MathUtils.clamp(p.x, TABLE.x[0], TABLE.x[1]);
    drag.obj.position.y = MathUtils.clamp(p.y, TABLE.y[0], TABLE.y[1]);
  });

  function endPointer(e) {
    if (drag) {
      drag.obj.position.z = drag.z;
      if (canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
      drag = null;
      controls.enabled = true;
      canvas.style.cursor = "";
    }
    if (!down || e.type === "pointercancel") { down = null; return; }
    const quick = !down.moved && performance.now() - down.time < 400;
    const now = performance.now();
    if (quick && now - lastTap.time < 450 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
      lastTap.time = 0;
      if (state === "packed") unpack();
      else if (state === "open") pack();
    } else if (quick) {
      lastTap = { time: now, x: e.clientX, y: e.clientY };
    }
    down = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("dblclick", (e) => e.preventDefault());

  // ---- render loop ------------------------------------------------------------
  let frame = 0;
  const offset = new Vector3();
  function tick(now) {
    if (anim) {
      const s = (now - anim.start) / 1000;
      const a = anim;
      a.step(Math.min(s, a.duration));
      if (s >= a.duration) { anim = null; a.done?.(); }
    }
    if (viewGoal) {
      controls.target.lerp(viewGoal.target, 0.05);
      offset.copy(camera.position).sub(controls.target).lerp(viewGoal.offset, 0.04);
      camera.position.copy(controls.target).add(offset);
      if (controls.target.distanceTo(viewGoal.target) < 0.5 && offset.distanceTo(viewGoal.offset) < 1) viewGoal = null;
    }
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    get state() { return state; },
    get dirty() { return touched; },
    unpack, pack,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
