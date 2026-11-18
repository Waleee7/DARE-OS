// CINEMA in 3D: one night meet, five shots. js/scenes.js loads this after the page is up,
// builds the world in small steps (so no single task blocks the page), then fades it in
// over the poster, which is a still of this same world.
//
// SHOT LIST (written before the build: every move has a reason and an end state)
// 01 THE CIRCLE    arrival. Establishing wide from high behind the south end, then a crane
//                  down into the cage: the thrower's view down the sector. Concrete ring and a
//                  resting discus in front, officials waiting in the field, the board glowing
//                  AKINWALE DARE at the far end. 40° lens, low and level. Hold, breathing.
// 02 THE SECTOR    the work. Rise out of the cage to a broadcast high angle over the sector.
//                  The officials walk to their marks, kneel, plant a marker and lift the
//                  prism pole. Then down to the current mark: the EDM beside the circle fires
//                  its laser at the prism, and the plaque reads the number. 42° / 38°.
// 03 THE BOARD     the proof. Track up the infield to a low angle under the scoreboard, which
//                  reads the live numbers one at a time. 40°.
// 04 THE PRESS BOX about. Arc up and pull back through the press-box window; end inside,
//                  looking out over the lit field past the desk and a microphone. 50°.
// 05 THE TUNNEL    contact. Drop to the track, turn to the field and pull back into the
//                  players' tunnel: strip lights run out to the bright opening. 46°.
// Moves: 1.6–3.4 s, ease in-out, never a cut. Reduced motion: cuts and static poses.
// Colour in the world: night neutrals, chalk white, Laser orange only on what measures
// (laser, markers, the plaque's bar), Floodlight steel on the officials' polos.
import * as THREE from './vendor/three.module.min.js';

const RAD = Math.PI / 180;
const MAIN = 0xff5a1f, ALT = 0x9fb8d0, CHALK = 0xeeeae2;
const DISP = '"Barlow Condensed", "Arial Narrow", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
// a seeded random: the crowd and the stars land in the same places on every load, so the
// poster (a still of this world) and the live picture match when one fades into the other
let seed = 20261116;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pause = () => new Promise((r) => { const s = globalThis.scheduler; if (s && s.yield) s.yield().then(r); else setTimeout(r, 0); });
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (draw) draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { t, c, g };
}
// a stadium-shaped ring (two straights joined by half circles), flat on the ground
function oval(r, s, zc, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI; pts.push(new THREE.Vector2(r * Math.cos(t), -(zc + s / 2 + r * Math.sin(t)))); }
  for (let i = 0; i <= n; i++) { const t = Math.PI + (i / n) * Math.PI; pts.push(new THREE.Vector2(r * Math.cos(t), -(zc - s / 2 + r * Math.sin(t)))); }
  return pts;
}
function band(r0, r1, s, zc) { const sh = new THREE.Shape(oval(r1, s, zc)); sh.holes.push(new THREE.Path(oval(r0, s, zc).reverse())); return sh; }
// fit a line of text into a width by stepping the size down
function fit(g, text, font, size, max) { let s = size; g.font = font.replace('$', s); while (g.measureText(text).width > max && s > 8) { s -= 2; g.font = font.replace('$', s); } return s; }

/* ---------------- the five shots: where the camera rests, wide and tall ---------------- */
const SHOTS = [
  { id: 'circle', pos: [-0.6, 1.7, -2.2], look: [0.8, -0.2, 18], fov: 50, shift: 0.08, via: [1.2, 8.5, -7.5], dolly: [-0.5, 1.1],
    tall: { pos: [-0.35, 1.75, -2.3], look: [0.3, 0.55, 20], fov: 56 } },
  { id: 'sector', pos: [-37, 17, 11], look: [3, 0, 47], fov: 42, shift: 0.12, dolly: [-5, 9],
    tall: { pos: [-28, 26, 2], look: [4, 0, 46], fov: 60 } },
  { id: 'board', pos: [8, 5, 75], look: [-4, 17.5, 138], fov: 44, shift: 0.2, dolly: [-5, 9],
    tall: { pos: [-1, 3.2, 72], look: [0, 18.5, 138], fov: 50 } },
  { id: 'press', pos: [-71.4, 14.0, 31.5], look: [-32, 2, 62], fov: 52, shift: 0.04, via: [-60, 13.8, 33], dolly: [-0.3, 1.4],
    tall: { pos: [-71.4, 14.0, 31.8], look: [-34, 1.5, 60], fov: 62 } },
  { id: 'tunnel', pos: [-70.6, 1.62, 40], look: [-30, 1.75, 40], fov: 44, shift: 0.1, via: [-43, 2.2, 40], dolly: [-0.6, 5],
    tall: { pos: [-70.6, 1.6, 40], look: [-30, 1.8, 40], fov: 56 } },
];
const ARRIVE = { pos: [15, 33, -58], look: [-3, 3, 52], fov: 44 };
// the mark close-up: beside the official, a little toward the circle
const MARK_FOV = 38;

export async function init(o) {
  seed = 20261116;
  const { canvas, marks, physics: P, light, reduce } = o;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !light, powerPreference: 'high-performance', stencil: false });
  let dpr = Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const aniso = Math.min(light ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080c);
  scene.fog = new THREE.FogExp2(0x121722, 0.0042);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1400);
  const texs = [];
  const T = (w, h, draw) => { const r = canvasTex(w, h, draw); texs.push(r.t); return r; };
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const still = (m, y) => { if (y != null) m.position.y = y; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); return m; };
  function boxes(list, mat) {
    const m = new THREE.InstancedMesh(BOX, mat, list.length);
    list.forEach((b, i) => { Q.setFromAxisAngle(UP, b[6] || 0); M.compose(V.set(b[0], b[1], b[2]), Q, Sc.set(b[3], b[4], b[5])); m.setMatrixAt(i, M); });
    m.computeBoundingSphere();
    return still(m);
  }
  // [cx, cy, cz, sx, sy, sz] from two corners
  const span = (x0, y0, z0, x1, y1, z1) => [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)];

  /* ================= sky, stars, light ================= */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 top = vec3(0.010, 0.014, 0.026); vec3 hor = vec3(0.075, 0.085, 0.115); vec3 haze = vec3(0.20, 0.17, 0.125); vec3 c = mix(hor, top, smoothstep(0.0, 0.32, h)); c = mix(c, haze, (1.0 - smoothstep(0.0, 0.085, h)) * 0.6); gl_FragColor = vec4(c, 1.0); }',
  })));
  {
    const n = light ? 110 : 220, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, e = 0.16 + rnd() * 1.2; pos.set([Math.cos(a) * Math.cos(e) * 800, Math.sin(e) * 800, Math.sin(a) * Math.cos(e) * 800], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d2e6, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.45, fog: false })));
  }
  scene.add(new THREE.HemisphereLight(0xa3b6d6, 0x1c2a1e, 1.05));
  const k1 = new THREE.DirectionalLight(0xffe6c2, 2.7); k1.position.set(-60, 70, 14); scene.add(k1);
  const k2 = new THREE.DirectionalLight(0xfff0dc, 1.9); k2.position.set(62, 58, 96); scene.add(k2);
  await pause();

  /* ================= ground: apron, turf, track, the sector ================= */
  const TR = { S: 84.39, ZC: 40, R0: 36.5, R1: 36.5 + 9.76 };
  still(new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x0b0d11 })), -0.04);
  {
    const grass = T(8, 256, (g) => {
      g.fillStyle = '#1f4a2c'; g.fillRect(0, 0, 8, 128); g.fillStyle = '#255434'; g.fillRect(0, 128, 8, 128);
      for (let i = 0; i < 380; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.14})`; g.fillRect(rnd() * 8, rnd() * 256, 1, 1); }
    }).t;
    // the infield is the shape inside the track (shape UVs are metres: one stripe pair every 12 m)
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(1 / 8, 1 / 12); grass.anisotropy = aniso;
    still(new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(oval(TR.R0 + 0.05, TR.S, TR.ZC)), 12).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: grass })), 0.004);
    // between the track and the stands: dark asphalt
    still(new THREE.Mesh(new THREE.PlaneGeometry(100, 172).rotateX(-Math.PI / 2).translate(0, 0, 44), new THREE.MeshLambertMaterial({ color: 0x24272c })), -0.01);
    const track = new THREE.Mesh(new THREE.ShapeGeometry(band(TR.R0, TR.R1, TR.S, TR.ZC), 10).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6e2d24 }));
    track.position.y = 0.012; still(track);
    const lanes = []; for (let k = 0; k <= 8; k++) { const r = TR.R0 + k * 1.22; lanes.push(band(r - 0.05, r + 0.05, TR.S, TR.ZC)); }
    const laneMesh = new THREE.Mesh(new THREE.ShapeGeometry(lanes, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: CHALK, transparent: true, opacity: 0.32 }));
    laneMesh.position.y = 0.022; still(laneMesh);
  }
  await pause();
  {
    // the sector, painted on the grass (68 × 92 m): two bright lines, arcs every 10 m
    const PX = light ? 7 : 13, PW = Math.round(68 * PX), PH = Math.round(92 * PX);
    const paint = T(PW, PH, (g) => {
      const at = (x, z) => [(34 - x) * PX, (86 - z) * PX];
            g.lineCap = 'round';
      g.strokeStyle = 'rgba(238,234,226,.3)'; g.lineWidth = 0.07 * PX;
      for (let r = 20; r <= 80; r += 10) {
        g.beginPath();
        for (let i = 0; i <= 40; i++) { const a = -P.HALF + (2 * P.HALF * i) / 40, p = at(r * Math.sin(a * RAD), r * Math.cos(a * RAD)); if (i) g.lineTo(...p); else g.moveTo(...p); }
        g.stroke();
      }
      g.fillStyle = 'rgba(238,234,226,.42)'; g.font = `600 ${2.4 * PX}px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let r = 20; r <= 80; r += 10) { const a = P.HALF + 3.4, p = at(r * Math.sin(a * RAD), r * Math.cos(a * RAD)); g.fillText(String(r), ...p); }
    });
    paint.t.anisotropy = aniso;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(68, 92).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshLambertMaterial({ map: paint.t, transparent: true, depthWrite: false }));
    m.position.set(0, 0.03, 40); still(m);
    // the two sector lines as geometry, so they stay crisp next to the circle
    const lg = new THREE.PlaneGeometry(0.075, 88.7).rotateX(-Math.PI / 2).translate(0, 0, 1.3 + 88.7 / 2), lm = new THREE.MeshBasicMaterial({ color: CHALK });
    for (const sd of [1, -1]) { const l = new THREE.Mesh(lg, lm); l.rotation.y = sd * P.HALF * RAD; l.position.y = 0.036; still(l); }
  }
  await pause();

  /* ================= the circle, the cage, a resting discus ================= */
  const concrete = T(128, 128, (g, w, h) => { g.fillStyle = '#7a7d84'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = (rnd() * 60) | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${0.05 + rnd() * 0.12})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }).t;
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(2, 2);
  still(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.03, 48), new THREE.MeshLambertMaterial({ color: 0x5a5d64, map: concrete })), 0.015);
  still(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 56), new THREE.MeshLambertMaterial({ color: 0x8c8f95, map: concrete })), 0.03);
  still(new THREE.Mesh(new THREE.RingGeometry(1.25, 1.33, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: CHALK })), 0.058);
  {
    const prof = [[0, 0.022], [0.03, 0.022], [0.09, 0.012], [0.11, 0.004], [0.11, -0.004], [0.09, -0.012], [0.03, -0.022], [0, -0.022]].map(([x, y]) => new THREE.Vector2(x, y));
    const disc = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), new THREE.MeshLambertMaterial({ color: 0x2b2f38 }));
    disc.add(new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.006, 6, 32).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd9dde4 })));
    disc.position.set(0.36, 0.08, 0.98); disc.rotation.set(0.08, 0, -0.06); still(disc);
    const CAGE = 3.6, a0 = P.HALF + 26, a1 = 360 - P.HALF - 26, n = 10;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.038, 0.038, 5.6, 6), new THREE.MeshLambertMaterial({ color: 0x59606c }), n);
    for (let i = 0; i < n; i++) { const a = (a0 + ((a1 - a0) * i) / (n - 1)) * RAD; M.compose(V.set(CAGE * Math.sin(a), 2.8, CAGE * Math.cos(a)), Q.identity(), Sc.set(1, 1, 1)); posts.setMatrixAt(i, M); }
    posts.computeBoundingSphere(); still(posts);
    // the net: a fine dark mesh (about 9 cm), which reads as netting and fades to a haze with distance
    const net = T(32, 32, (g) => { g.strokeStyle = 'rgba(150,158,172,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(32, 0); g.lineTo(0, 32); g.stroke(); }).t;
    net.wrapS = net.wrapT = THREE.RepeatWrapping; net.repeat.set(190, 60); net.anisotropy = aniso;
    const netMesh = new THREE.Mesh(new THREE.CylinderGeometry(CAGE, CAGE, 5.4, 56, 1, true, a0 * RAD, (a1 - a0) * RAD), new THREE.MeshLambertMaterial({ map: net, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    netMesh.position.y = 2.75; still(netMesh);
  }
  await pause();

  /* ================= the stands: the main grandstand (west) with its tunnel, bleachers (east) ================= */
  const TUN = { z0: 37.5, z1: 42.5, h: 3.4 };
  const PRESS = { x0: -68.5, x1: -75.5, y0: 12.0, y1: 15.8, z0: 26, z1: 54 };
  {
    const WB = [], EB = [], seats = [];
    const FRONT = 1.4;
    for (let k = 0; k < 14; k++) {
      const xa = -49 - k * 1.5, xb = xa - 1.5, h = FRONT + (k + 1) * 0.75, cx = (xa + xb) / 2;
      WB.push([cx, h / 2, (-22 + TUN.z0) / 2, 1.5, h, TUN.z0 + 22]);
      WB.push([cx, h / 2, (TUN.z1 + 102) / 2, 1.5, h, 102 - TUN.z1]);
      if (h > TUN.h) WB.push([cx, (h + TUN.h) / 2, 40, 1.5, h - TUN.h, TUN.z1 - TUN.z0]);
      const step = light ? 1.4 : 0.7;
      for (let z = -21; z < 101; z += step) {
        if (z > TUN.z0 - 1 && z < TUN.z1 + 1 && k < 4) continue;
        if (k >= 12 && z > PRESS.z0 - 1 && z < PRESS.z1 + 1) continue;
        if (rnd() < 0.3) seats.push([cx - 0.2, h + 0.3, z + rnd() * 0.25]);
      }
    }
    for (let k = 0; k < 8; k++) {
      const xa = 49 + k * 1.6, xb = xa + 1.6, h = 1.2 + (k + 1) * 0.8, cx = (xa + xb) / 2;
      EB.push([cx, h / 2, 40, 1.6, h, 100]);
      const step = light ? 1.4 : 0.7;
      for (let z = -9; z < 89; z += step) if (rnd() < 0.26) seats.push([cx + 0.2, h + 0.3, z + rnd() * 0.25]);
    }
    // the far ends: a low wall behind the board, a fence behind the cage
    EB.push(span(-60, 0, 131, 60, 1.6, 132), span(-46, 0, -44, 46, 2.2, -43.6));
    boxes(WB, new THREE.MeshLambertMaterial({ color: 0x262a33 }));
    boxes(EB, new THREE.MeshLambertMaterial({ color: 0x20242c }));
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.58, 0.32), new THREE.MeshLambertMaterial(), seats.length);
    const pal = [0x262b38, 0x343a48, 0x1d212c, 0x454b5a, 0x5d6371, 0x7a3428, 0xaab0bb, 0x222a3a], C = new THREE.Color();
    seats.forEach(([x, y, z], i) => { M.compose(V.set(x, y, z), Q.identity(), Sc.set(1, 0.85 + rnd() * 0.3, 1)); crowd.setMatrixAt(i, M); crowd.setColorAt(i, C.setHex(pal[(rnd() * pal.length) | 0])); });
    crowd.computeBoundingSphere(); still(crowd);
  }
  await pause();

  /* ================= floodlights ================= */
  {
    const TOWERS = [[-84, 6], [84, 6], [-62, 128], [62, 128]], H = 40;
    const masts = [], heads = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ map: T(64, 32, (g, w, h) => { g.fillStyle = '#23262e'; g.fillRect(0, 0, w, h); for (let y = 3; y < h; y += 7) for (let x = 3; x < w; x += 7) { g.fillStyle = '#fff4e2'; g.fillRect(x, y, 4, 4); } }).t, toneMapped: false }), TOWERS.length);
    TOWERS.forEach(([x, z], i) => {
      masts.push([x, H / 2, z, 1.1, H, 1.1]);
      Q.setFromEuler(new THREE.Euler(-0.36, Math.atan2(-x, 44 - z), 0, 'YXZ'));
      M.compose(V.set(x, H, z), Q, Sc.set(11, 5.4, 0.7)); heads.setMatrixAt(i, M);
    });
    boxes(masts, new THREE.MeshLambertMaterial({ color: 0x191c24 }));
    heads.computeBoundingSphere(); still(heads);
    const glow = T(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,246,228,1)'); r.addColorStop(0.16, 'rgba(255,236,204,.45)'); r.addColorStop(1, 'rgba(255,236,204,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }).t;
    const pos = new Float32Array(TOWERS.flatMap(([x, z]) => [x, H, z]));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ map: glow, size: 56, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })));
  }
  await pause();

  /* ================= the scoreboard (north end, facing the circle) ================= */
  const BW = light ? 512 : 1024, BH = BW / 2, bk = BW / 1024;
  const boardTex = T(BW, BH);
  {
    const frame = new THREE.MeshLambertMaterial({ color: 0x101319 });
    boxes([[0, 20, 139, 42, 22, 1.4], [-13, 6, 139.6, 1.4, 12, 1.4], [13, 6, 139.6, 1.4, 12, 1.4]], frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(39, 19.5).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: boardTex.t, toneMapped: false, fog: false }));
    screen.position.set(0, 20, 138.2); still(screen);
  }
  let BD = { mode: 'title' };
  function drawBoard() {
    const g = boardTex.g, W = BW, H = BH, pad = 44 * bk;
    g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff5a1f'; g.fillRect(0, 0, W, 6 * bk);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = '#8b97a8';
    g.font = `600 ${21 * bk}px ${MONO}`;
    g.fillText(BD.mode === 'stats' ? 'THE BOARD · LIVE' : 'NIGHT SESSION · DISCUS', pad, 52 * bk);
    if (BD.mode === 'stats') { g.textAlign = 'right'; g.fillText(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase(), W - pad, 52 * bk); }
    g.textAlign = 'left';
    if (BD.mode !== 'stats' || !BD.rows) {
      g.fillStyle = '#f2efe8'; fit(g, 'AKINWALE DARE', `600 $px ${DISP}`, 200 * bk, W - pad * 2); g.fillText('AKINWALE DARE', pad, 300 * bk);
      g.fillStyle = '#9fb8d0'; g.font = `600 ${27 * bk}px ${MONO}`; g.fillText('DEVELOPER · BUILDER · ELITE THROWER', pad + 4 * bk, 372 * bk);
      g.fillStyle = '#ff5a1f'; g.fillRect(pad + 4 * bk, 420 * bk, 120 * bk, 5 * bk);
    } else {
      // one number at a time, full width: the label, the number, what it counts, where it comes from,
      // and a tick per row along the bottom (the panel beside the film lists them all)
      const n = BD.rows.length, k = BD.k % n, r = BD.rows[k];
      g.fillStyle = '#9fb8d0'; g.font = `600 ${26 * bk}px ${MONO}`; g.fillText(r.label.toUpperCase(), pad, 128 * bk);
      g.fillStyle = '#f2efe8'; const s = fit(g, r.big, `600 $px ${DISP}`, 250 * bk, W * 0.62); g.fillText(r.big, pad - 6 * bk, 338 * bk);
      const bw = g.measureText(r.big).width;
      if (r.unit) { g.fillStyle = '#ff5a1f'; g.font = `600 ${Math.min(96 * bk, s * 0.4)}px ${DISP}`; g.fillText(r.unit.toUpperCase(), pad + bw + 12 * bk, 338 * bk); }
      g.fillStyle = '#d9d5cc'; fit(g, r.what.toUpperCase(), `500 $px ${MONO}`, 27 * bk, W - pad * 2); g.fillText(r.what.toUpperCase(), pad, 398 * bk);
      g.fillStyle = '#8b97a8'; fit(g, r.src.toUpperCase(), `500 $px ${MONO}`, 20 * bk, W - pad * 2); g.fillText(r.src.toUpperCase(), pad, 440 * bk);
      const tw = (W - pad * 2 - (n - 1) * 10 * bk) / n;
      for (let j = 0; j < n; j++) { g.fillStyle = j === k ? '#ff5a1f' : '#2a2e37'; g.fillRect(pad + j * (tw + 10 * bk), 470 * bk, tw, 5 * bk); }
    }
    // the LED grid, so it reads as a board and not a poster
    g.fillStyle = 'rgba(0,0,0,.3)'; const st = Math.max(3, 4 * bk);
    for (let y = 0; y < H; y += st) g.fillRect(0, y, W, 1);
    for (let x = 0; x < W; x += st) g.fillRect(x, 0, 1, H);
    boardTex.t.needsUpdate = true;
  }
  drawBoard();
  await pause();

  /* ================= the press box, on top of the grandstand ================= */
  {
    const shell = new THREE.MeshLambertMaterial({ color: 0x15181f });
    const inner = new THREE.MeshLambertMaterial({ color: 0x3a342b, emissive: 0x3a2a16 });
    const { x0, x1, y0, y1, z0, z1 } = PRESS;
    boxes([
      span(x1, y0 - 0.25, z0, x0 + 0.3, y0, z1),            // floor slab
      span(x1, y1, z0, x0 + 0.3, y1 + 0.35, z1),            // roof
      span(x0 - 0.1, y0, z0, x0 + 0.3, y0 + 0.95, z1),      // the wall under the window
      span(x0 - 0.1, y1 - 0.55, z0, x0 + 0.3, y1, z1),      // the header over it
    ], shell);
    // the desk top, light enough to read as a desk in the foreground
    boxes([span(x0 - 1.0, y0 + 0.88, z0, x0 - 0.1, y0 + 0.95, z1)], new THREE.MeshLambertMaterial({ color: 0x4a443b }));
    boxes([
      span(x1 - 0.2, y0, z0, x1, y1, z1),                    // back wall (lit)
      span(x1, y0, z0 - 0.2, x0, y1, z0),                    // side walls
      span(x1, y0, z1, x0, y1, z1 + 0.2),
      span(x1, y1 - 0.06, z0, x0, y1, z1),                   // ceiling
    ], inner);
    // one wide pane of glass: posts only at the two ends, so nothing crosses the view of the board
    boxes([span(x0 + 0.02, y0 + 0.95, z0 + 0.2, x0 + 0.16, y1 - 0.55, z0 + 0.32), span(x0 + 0.02, y0 + 0.95, z1 - 0.32, x0 + 0.16, y1 - 0.55, z1 - 0.2)], shell);
    // ceiling lights, two monitors facing the seats, a microphone
    boxes([30, 37, 44, 51].map((z) => span(x1 + 2.2, y1 - 0.09, z - 0.6, x0 - 2.2, y1 - 0.07, z + 0.6)), new THREE.MeshBasicMaterial({ color: 0xe8dcc6 }));
    boxes([span(x0 - 0.75, y0 + 0.95, 35.2, x0 - 0.68, y0 + 1.42, 36.1), span(x0 - 0.75, y0 + 0.95, 44.2, x0 - 0.68, y0 + 1.42, 45.1)], new THREE.MeshBasicMaterial({ color: 0x1f2a36 }));
    boxes([span(x0 - 0.62, y0 + 0.95, 33.4, x0 - 0.58, y0 + 1.25, 33.44), span(x0 - 0.66, y0 + 1.25, 33.36, x0 - 0.54, y0 + 1.36, 33.48)], new THREE.MeshLambertMaterial({ color: 0x0c0d10 }));
  }
  await pause();

  /* ================= the players' tunnel, under the grandstand ================= */
  {
    const wallTex = T(256, 64, (g, w, h) => {
      g.fillStyle = '#24272d'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) { const k = Math.max(0, 1 - Math.abs(y - 4) / 40); g.fillStyle = `rgba(255,232,200,${0.22 * k})`; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, 0, 2, h); }
    }).t;
    wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(6, 1);
    const wall = new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.DoubleSide });
    for (const z of [TUN.z0 + 0.06, TUN.z1 - 0.06]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(23, TUN.h), wall); m.position.set(-60.5, TUN.h / 2, z); still(m); }
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(20, TUN.z1 - TUN.z0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x15161a }));
    roof.position.set(-62, TUN.h - 0.04, 40); still(roof);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(23, TUN.z1 - TUN.z0).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1b1c20 }));
    floor.position.set(-60.5, 0.02, 40); still(floor);
    // ceiling light panels across the tunnel (short along it), so they read as fittings, not a painted line
    const strips = []; for (let x = -53.5; x > -64; x -= 3.2) strips.push(span(x - 0.32, TUN.h - 0.1, 38.7, x + 0.32, TUN.h - 0.06, 41.3));
    boxes(strips, new THREE.MeshBasicMaterial({ color: 0xf3e7d4, toneMapped: false }));
    boxes([span(-72.2, 0, TUN.z0, -72, TUN.h, TUN.z1)], new THREE.MeshBasicMaterial({ color: 0x0d0e11 }));
    boxes([span(-72.0, 0.2, 39.1, -71.95, 2.4, 40.9)], new THREE.MeshBasicMaterial({ color: 0x6b5a44 }));
  }
  await pause();

  /* ================= the officials: one at every mark, plus the EDM operator ================= */
  const N = marks.length, NO = N + 1;
  const SKIN = [0x4a2c1d, 0x8d5a3b, 0xe2b48c, 0x6b4127, 0xc68e63, 0x3b2418, 0xf0c9a4, 0xa8714c, 0x7a4a33];
  const HAIR = { 2: 'afro', 7: 'bun', 12: 'short' };
  const MX = new Float32Array(N), MZ = new Float32Array(N);
  marks.forEach((m, i) => { MX[i] = m.d * Math.sin(m.a * RAD); MZ[i] = m.d * Math.cos(m.a * RAD); });
  const EDM = { x: -7.5, z: -1.2 };
  // each official: where they stand, where they wait, how they look
  const off = [];
  for (let i = 0; i < NO; i++) {
    const edm = i === N;
    const mx = edm ? EDM.x : MX[i], mz = edm ? EDM.z : MZ[i], r = Math.hypot(mx, mz) || 1, ux = mx / r, uz = mz / r;
    const face = Math.atan2(-mx, -mz);   // toward the circle
    const side = i % 2 ? 1 : -1;
    const o = {
      i, edm, mx, mz, face,
      sx: mx + ux * 0.38, sz: mz + uz * 0.38,                                          // stand: just behind the mark
      wx: mx + ux * 4.4 + uz * 1.6 * side, wz: mz + uz * 4.4 - ux * 1.6 * side,       // wait: out beyond it
      s: 0.94 + ((i * 37) % 12) / 100, build: 0.96 + ((i * 53) % 10) / 100,
      skin: SKIN[(i * 4) % SKIN.length], hair: HAIR[i] || null,
      x: 0, z: 0, h: face, mode: edm ? 'edm' : 'wait', t: 0, delay: 0, phase: rnd() * 6, planted: false,
      cur: null, tgt: new Float32Array(18),
    };
    if (edm) { o.x = EDM.x - 0.62 * Math.sin(face + 0.3); o.z = EDM.z - 0.62 * Math.cos(face + 0.3); o.h = face + 0.3; }
    else { o.x = o.wx; o.z = o.wz; }
    off.push(o);
  }
  // poses: [hipY, lean, nod, lThigh, lKnee, rThigh, rKnee, lShF, lShOut, lElb, rShF, rShOut, rElb, poleX, poleY, poleZ, poleTilt, sway]
  const POSE = {
    rest: [0.95, 0.02, 0.05, 0.02, 0.02, -0.01, 0.02, 0.05, 0.1, 0.16, 0.36, 0.24, 0.6, -0.33, 0, 0.27, 0, 0],
    stand: [0.95, 0.03, 0.06, 0.0, 0.02, 0.0, 0.02, 0.05, 0.1, 0.16, 0.36, 0.24, 0.6, -0.33, 0, 0.27, 0, 0],
    kneel: [0.5, 0.88, 0.3, 1.45, 1.45, -0.12, 1.72, 1.02, 0.14, 0.62, 1.28, 0.06, 0.12, -0.46, 0, 0.1, 0, 0],
    hold: [0.95, 0.05, 0.1, 0.03, 0.03, -0.03, 0.03, 0.42, -0.14, 1.12, 0.66, -0.2, 1.28, 0, 0, 0.36, 0, 0],
    edm: [0.95, 0.24, 0.42, 0.06, 0.05, 0.04, 0.05, 0.66, 0.05, 0.66, 0.66, 0.05, 0.66, 0, -9, 0, 0, 0],
  };
  for (const o2 of off) o2.cur = Float32Array.from(o2.edm ? POSE.edm : POSE.rest);

  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const PART = (geo, mat, count) => { const m = new THREE.InstancedMesh(geo, mat, count); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); return m; };
  const cap = (r, h) => new THREE.CapsuleGeometry(r, Math.max(0.001, h - 2 * r), 3, 8);
  const G = {
    head: new THREE.SphereGeometry(0.104, 16, 12).scale(0.92, 1.1, 1).translate(0, 0.115, 0.008),
    neck: new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8).translate(0, 0.04, 0),
    torso: cap(0.15, 0.56).scale(1.22, 1, 0.66).translate(0, 0.27, 0),
    pelvis: cap(0.13, 0.3).rotateZ(Math.PI / 2).scale(1, 0.7, 0.72),
    upper: cap(0.05, 0.31).translate(0, -0.135, 0),
    fore: cap(0.04, 0.29).translate(0, -0.125, 0),
    hand: new THREE.SphereGeometry(0.045, 8, 6),
    thigh: cap(0.072, 0.47).translate(0, -0.2, 0),
    shin: cap(0.056, 0.45).translate(0, -0.2, 0),
    shoe: new THREE.BoxGeometry(0.1, 0.075, 0.26).translate(0, -0.03, 0.055),
    crown: new THREE.SphereGeometry(0.113, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.96, 0.9, 1.04).translate(0, 0.13, 0),
    brim: new THREE.BoxGeometry(0.17, 0.012, 0.11).rotateX(0.16).translate(0, 0.145, 0.135),
    afro: new THREE.SphereGeometry(0.15, 12, 9).scale(1.05, 0.9, 1.0).translate(0, 0.16, -0.01),
    bun: new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.17, -0.1),
    short: new THREE.SphereGeometry(0.11, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.97, 0.75, 1.03).translate(0, 0.14, -0.004),
    badge: new THREE.BoxGeometry(0.07, 0.095, 0.012),
    strap: new THREE.BoxGeometry(0.012, 0.22, 0.008),
    pole: new THREE.CylinderGeometry(0.016, 0.016, 1.95, 6).translate(0, 0.975, 0),
    band: new THREE.CylinderGeometry(0.019, 0.019, 0.16, 6).translate(0, 1.5, 0),
    prism: new THREE.CylinderGeometry(0.055, 0.055, 0.07, 10).rotateX(Math.PI / 2).translate(0, 1.99, 0),
  };
  const skinM = lam(0xffffff), polo = lam(ALT), pants = lam(0x1d2028), shoeM = lam(0x111216), capM = lam(0x1b2433), hairM = lam(0x17120f);
  const P_ = {
    head: PART(G.head, skinM, NO), neck: PART(G.neck, skinM, NO), torso: PART(G.torso, polo, NO), pelvis: PART(G.pelvis, pants, NO),
    upper: PART(G.upper, polo, NO * 2), fore: PART(G.fore, skinM, NO * 2), hand: PART(G.hand, skinM, NO * 2),
    thigh: PART(G.thigh, pants, NO * 2), shin: PART(G.shin, pants, NO * 2), shoe: PART(G.shoe, shoeM, NO * 2),
    crown: PART(G.crown, capM, NO), brim: PART(G.brim, capM, NO),
    afro: PART(G.afro, hairM, NO), bun: PART(G.bun, hairM, NO), short: PART(G.short, hairM, NO),
    badge: PART(G.badge, lam(0xf2efe8), NO), strap: PART(G.strap, new THREE.MeshBasicMaterial({ color: MAIN }), NO * 2),
    pole: PART(G.pole, lam(0xe9e6df), NO), band: PART(G.band, new THREE.MeshBasicMaterial({ color: MAIN }), NO), prism: PART(G.prism, lam(0x5a606b), NO),
  };
  {
    const C = new THREE.Color();
    for (const o2 of off) {
      C.setHex(o2.skin);
      for (const k of ['head', 'neck']) P_[k].setColorAt(o2.i, C);
      for (const k of ['fore', 'hand']) { P_[k].setColorAt(o2.i * 2, C); P_[k].setColorAt(o2.i * 2 + 1, C); }
    }
    for (const k of ['head', 'neck', 'fore', 'hand']) P_[k].instanceColor.needsUpdate = true;
  }
  // contact shadows under everyone who stands on the field
  const blobTex = T(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }).t;
  const blobs = PART(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }), NO + 2);
  // markers: a pin with a small orange flag, planted by the official
  const pins = PART(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 5).translate(0, 0.17, 0), lam(0xd8d4cc), N);
  const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.14, -0.045), new THREE.Vector2(0, -0.09)]);
  const flags = PART(new THREE.ShapeGeometry(flagShape).translate(0, 0.34, 0), new THREE.MeshBasicMaterial({ color: MAIN, side: THREE.DoubleSide }), N);
  const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < N; i++) { pins.setMatrixAt(i, HIDE); flags.setMatrixAt(i, HIDE); }

  // the EDM on its tripod beside the circle
  const edmHead = new THREE.Group();
  {
    const legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 1.48, 5).translate(0, 0.74, 0), lam(0x3b3f48), 3);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; Q.setFromEuler(new THREE.Euler(0.2 * Math.cos(a), 0, 0.2 * Math.sin(a))); M.compose(V.set(EDM.x + 0.28 * Math.sin(a), 0, EDM.z + 0.28 * Math.cos(a)), Q, Sc.set(1, 1, 1)); legs.setMatrixAt(k, M); }
    legs.computeBoundingSphere(); still(legs);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.17), lam(0xd9d6cf)); body.position.y = 0.12;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.2, 12).rotateX(Math.PI / 2), lam(0x22252c)); lens.position.set(0, 0.17, 0.14);
    edmHead.add(body, lens); edmHead.position.set(EDM.x, 1.42, EDM.z); scene.add(edmHead);
  }
  await pause();

  /* ================= the laser, the plaque ================= */
  const laser = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 1).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: MAIN, toneMapped: false, fog: false }));
  const laserGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 1).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: MAIN, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  laser.add(laserGlow); laser.visible = false; scene.add(laser);
  const hitTex = T(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,200,170,1)'); r.addColorStop(0.25, 'rgba(255,90,31,.55)'); r.addColorStop(1, 'rgba(255,90,31,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }).t;
  const hit = new THREE.Sprite(new THREE.SpriteMaterial({ map: hitTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, transparent: true }));
  hit.scale.setScalar(0.7); hit.visible = false; scene.add(hit);

  const PW = light ? 512 : 1024, PH = PW / 2, pk = PW / 1024;
  const plaqueTex = T(PW, PH);
  const plaque = new THREE.Group();
  {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.15), new THREE.MeshBasicMaterial({ map: plaqueTex.t, toneMapped: false, transparent: true }));
    face.position.y = 1.78;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.36, 1.21, 0.05), lam(0x101319)); back.position.set(0, 1.78, -0.03);
    const legsP = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), lam(0x2a2e36)); legsP.position.set(-0.85, 0.6, -0.03);
    const legsQ = legsP.clone(); legsQ.position.x = 0.85;
    plaque.add(face, back, legsP, legsQ);
  }
  plaque.visible = false; scene.add(plaque);
  function drawPlaque(f) {
    const g = plaqueTex.g, W = PW, H = PH, pad = 52 * pk;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0b0c10'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff5a1f'; g.fillRect(0, 0, W, 10 * pk);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = '#9fb8d0'; g.font = `600 ${26 * pk}px ${MONO}`; g.fillText(`MARK ${String(f.n).padStart(2, '0')} · ${f.cat.toUpperCase()}`, pad, 70 * pk);
    g.fillStyle = '#f2efe8'; fit(g, f.name.toUpperCase(), `600 $px ${DISP}`, 96 * pk, W - pad * 2); g.fillText(f.name.toUpperCase(), pad, 166 * pk);
    const s = fit(g, f.big, `600 $px ${DISP}`, 230 * pk, W * 0.6); g.fillText(f.big, pad - 4 * pk, 386 * pk);
    const bw = g.measureText(f.big).width;
    if (f.unit) { g.fillStyle = '#ff5a1f'; g.font = `600 ${Math.min(96 * pk, s * 0.42)}px ${DISP}`; g.fillText(f.unit.toUpperCase(), pad + bw + 10 * pk, 386 * pk); }
    g.fillStyle = '#b9b6ae'; fit(g, f.what.toUpperCase(), `500 $px ${MONO}`, 24 * pk, W - pad * 2); g.fillText(f.what.toUpperCase(), pad, 452 * pk);
    plaqueTex.t.needsUpdate = true;
  }
  await pause();

  /* ================= camera rig: shots, flights, a bounded free look ================= */
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  let tall = false, W = 1, H = 1;
  const pose = (s) => (tall && s.tall ? { pos: s.tall.pos, look: s.tall.look, fov: s.tall.fov, shift: 0 } : { pos: s.pos, look: s.look, fov: s.fov, shift: s.shift || 0 });
  const base = { pos: v3(ARRIVE.pos), look: v3(ARRIVE.look), fov: ARRIVE.fov, shift: 0.05 };
  let shot = -1, markOn = -1, markShown = false, fly = null, anim = true;
  const look = { yaw: 0, pitch: 0, dolly: 0, vy: 0, vp: 0, vd: 0, held: false, quiet: 0 };
  const dollyRange = () => { const s = SHOTS[Math.max(0, shot)]; return markOn >= 0 && shot === 1 ? [-3, 3.5] : s.dolly; };

  // the mark close-up: side-on to the mark, looking across the sector (whichever side has more
  // room), so the official stands left of frame, the plaque further out, and the laser comes in from the circle
  const markShot = [];
  for (let i = 0; i < N; i++) {
    const r = Math.hypot(MX[i], MZ[i]), ux = MX[i] / r, uz = MZ[i] / r, lx = uz, lz = -ux;
    let best = null;
    for (const sd of [-1, 1]) {
      const cx = MX[i] + sd * 7.2 * lx - 1.6 * ux, cz = MZ[i] + sd * 7.2 * lz - 1.6 * uz;
      let room = Infinity; for (let j = 0; j < N; j++) if (j !== i) room = Math.min(room, Math.hypot(off[j].wx - cx, off[j].wz - cz), Math.hypot(off[j].sx - cx, off[j].sz - cz));
      if (!best || room > best.room) best = { room, sd, cx, cz };
    }
    const px = MX[i] + ux * 2.3 - best.sd * 0.5 * lx, pz = MZ[i] + uz * 2.3 - best.sd * 0.5 * lz;
    markShot.push({
      pos: [best.cx, 3.1, best.cz], look: [MX[i] + ux * 1.25, 1.05, MZ[i] + uz * 1.25], fov: MARK_FOV, shift: 0.16,
      tall: { pos: [MX[i] + best.sd * 8.6 * lx - 2.4 * ux, 2.3, MZ[i] + best.sd * 8.6 * lz - 2.4 * uz], look: [MX[i] + ux * 1.1, 1.3, MZ[i] + uz * 1.1], fov: 46 },
      plaque: [px, pz, Math.atan2(best.cx - px, best.cz - pz)],
    });
  }
  const restPose = () => (shot === 1 && markOn >= 0 && markShown ? pose(markShot[markOn]) : pose(SHOTS[shot]));
  const snapTo = (d) => { fly = null; base.pos.set(...d.pos); base.look.set(...d.look); base.fov = d.fov; base.shift = d.shift; };
  function flyTo(dest, dur, via) {
    const pts = [base.pos.clone()];
    if (via) for (const p of via) pts.push(p.clone());
    pts.push(v3(dest.pos));
    if (pts.length === 2) { const mid = pts[0].clone().lerp(pts[1], 0.5); mid.y += Math.min(14, pts[0].distanceTo(pts[1]) * 0.12); pts.splice(1, 0, mid); }
    fly = { t0: performance.now(), dur, curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), l0: base.look.clone(), l1: v3(dest.look), f0: base.fov, f1: dest.fov, s0: base.shift, s1: dest.shift };
  }
  // go to a shot. For the sector, o2.mark names the mark to show; o2.delay holds the
  // camera on the wide while the officials walk out (the first visit only).
  function go(i, o2 = {}) {
    if (i === shot && !o2.force) return;
    const from = shot; shot = i;
    if (i !== 1) { markOn = -1; markShown = false; laserOff(); plaque.visible = false; }
    else { startSector(); if (o2.mark != null) setMark(o2.mark, o2.delay || 0); }
    const dest = restPose();
    if (reduce || o2.instant) snapTo(dest);
    else {
      const via = [];
      const a = from >= 0 ? SHOTS[from] : null, b = SHOTS[i];
      if (a && a.via) via.push(v3(a.via));
      if (from === 3 && i === 4) via.push(v3([-50, 9, 38]));
      if (b.via) via.push(v3(b.via));
      const len = base.pos.distanceTo(v3(dest.pos));
      flyTo(dest, from < 0 ? 4200 : clamp(1700 + len * 14, 1700, 3400), via);
    }
    BD.mode = i === 2 ? 'stats' : 'title'; drawBoard();
  }

  /* ================= the officials at work ================= */
  let sectorStarted = false, measureAt = 0;
  function startSector() {
    if (sectorStarted) return;
    sectorStarted = true;
    off.forEach((o2) => {
      if (o2.edm) return;
      if (reduce) { o2.x = o2.sx; o2.z = o2.sz; o2.h = o2.face; plant(o2); o2.mode = 'rest'; o2.cur.set(POSE.rest); return; }
      o2.mode = 'walk'; o2.t = 0; o2.delay = 0.15 + ((o2.i * 7) % N) * 0.11;
    });
  }
  function plant(o2) { o2.planted = true; M.makeTranslation(o2.mx, 0, o2.mz); pins.setMatrixAt(o2.i, M); M.multiply(new THREE.Matrix4().makeRotationY(o2.face + Math.PI / 2)); flags.setMatrixAt(o2.i, M); pins.instanceMatrix.needsUpdate = true; flags.instanceMatrix.needsUpdate = true; }
  const P0 = POSE.stand;
  function target(o2, dt, now) {
    const t = o2.tgt;
    switch (o2.mode) {
      case 'walk': {
        if (o2.delay > 0) { o2.delay -= dt; t.set(POSE.rest); return 10; }
        const dx = o2.sx - o2.x, dz = o2.sz - o2.z, d = Math.hypot(dx, dz);
        if (d < 0.04) { o2.x = o2.sx; o2.z = o2.sz; o2.mode = 'turn'; o2.t = 0; t.set(P0); return 8; }
        const step = Math.min(d, 1.35 * dt); o2.x += (dx / d) * step; o2.z += (dz / d) * step;
        o2.h += wrap(Math.atan2(dx, dz) - o2.h) * (1 - Math.exp(-dt * 7));
        o2.phase += dt * Math.PI * 2 * 0.98;
        const s = Math.sin(o2.phase);
        t.set(P0);
        t[0] = 0.95 - 0.022 * Math.cos(o2.phase * 2); t[1] = 0.07;
        t[3] = 0.42 * s; t[5] = -0.42 * s;
        t[4] = 0.1 + 0.55 * Math.max(0, Math.sin(o2.phase + 1.3)); t[6] = 0.1 + 0.55 * Math.max(0, Math.sin(o2.phase + 1.3 + Math.PI));
        t[7] = -0.34 * s; t[9] = 0.3; t[10] = 0.42 + 0.06 * s; t[12] = 0.75;
        t[13] = -0.3; t[14] = 0.12; t[15] = 0.34; t[16] = 0.22; t[17] = 0.012 * s;
        return 16;
      }
      case 'turn':
        o2.t += dt; o2.h += wrap(o2.face - o2.h) * (1 - Math.exp(-dt * 8)); t.set(P0);
        if (o2.t > 0.45) { o2.mode = 'kneel'; o2.t = 0; }
        return 9;
      case 'kneel':
        o2.t += dt; t.set(POSE.kneel);
        if (o2.t > 0.75 && !o2.planted) plant(o2);
        if (o2.t > 1.15) { o2.mode = 'rise'; o2.t = 0; }
        return 6;
      case 'rise':
        o2.t += dt; t.set(P0);
        if (o2.t > 0.55) { o2.mode = 'hold'; o2.t = 0; }
        return 6;
      case 'hold':
        o2.t += dt; t.set(POSE.hold);
        if (o2.t > 1.5 && o2.i !== markOn) { o2.mode = 'rest'; o2.t = 0; }
        return 6;
      case 'rest':
        t.set(POSE.rest);
        if (o2.i === markOn) { o2.mode = 'hold'; o2.t = 0; }
        return 6;
      case 'edm': t.set(POSE.edm); return 6;
      default: t.set(POSE.rest); return 6;
    }
  }

  // forward kinematics: every body part is one instance, placed from the pose
  const R = new THREE.Matrix4(), Hp = new THREE.Matrix4(), To = new THREE.Matrix4(), Hd = new THREE.Matrix4(), A1 = new THREE.Matrix4(), A2 = new THREE.Matrix4(), tmp = new THREE.Matrix4(), S3 = new THREE.Vector3();
  const tr = (m, x, y, z) => m.multiply(tmp.makeTranslation(x, y, z));
  const rx = (m, a) => m.multiply(tmp.makeRotationX(a));
  const rz = (m, a) => m.multiply(tmp.makeRotationZ(a));
  function place(o2) {
    const p = o2.cur, i = o2.i, s = o2.s, w = o2.build;
    R.makeRotationY(o2.h); R.scale(S3.set(s, s, s)); R.setPosition(o2.x, 0, o2.z);
    Hp.copy(R); tr(Hp, p[17], p[0], 0);
    P_.pelvis.setMatrixAt(i, Hp);
    To.copy(Hp); rx(To, p[1]);
    P_.torso.setMatrixAt(i, To);
    A1.copy(To); tr(A1, 0, 0.5, 0); P_.neck.setMatrixAt(i, A1);
    Hd.copy(To); tr(Hd, 0, 0.555, 0); rx(Hd, p[2]);
    P_.head.setMatrixAt(i, Hd);
    const hat = !o2.hair;
    P_.crown.setMatrixAt(i, hat ? Hd : HIDE); P_.brim.setMatrixAt(i, hat ? Hd : HIDE);
    P_.afro.setMatrixAt(i, o2.hair === 'afro' ? Hd : HIDE);
    P_.bun.setMatrixAt(i, o2.hair === 'bun' ? Hd : HIDE);
    P_.short.setMatrixAt(i, o2.hair === 'short' || o2.hair === 'bun' ? Hd : HIDE);
    A1.copy(To); tr(A1, 0, 0.33, 0.104); P_.badge.setMatrixAt(i, A1);
    for (const sd of [1, -1]) {
      A1.copy(To); tr(A1, 0.045 * sd, 0.44, 0.1); rz(A1, -0.36 * sd); P_.strap.setMatrixAt(i * 2 + (sd > 0 ? 0 : 1), A1);
    }
    // arms (left = +x, right = -x)
    for (const sd of [1, -1]) {
      const k = i * 2 + (sd > 0 ? 0 : 1), f = sd > 0 ? p[7] : p[10], out = sd > 0 ? p[8] : p[11], el = sd > 0 ? p[9] : p[12];
      A1.copy(To); tr(A1, 0.19 * sd * w, 0.445, 0); rz(A1, out * sd); rx(A1, -f);
      P_.upper.setMatrixAt(k, A1);
      A2.copy(A1); tr(A2, 0, -0.28, 0); rx(A2, -el);
      P_.fore.setMatrixAt(k, A2);
      tr(A2, 0, -0.27, 0); P_.hand.setMatrixAt(k, A2);
    }
    // legs
    for (const sd of [1, -1]) {
      const k = i * 2 + (sd > 0 ? 0 : 1), th = sd > 0 ? p[3] : p[5], kn = sd > 0 ? p[4] : p[6];
      A1.copy(R); tr(A1, 0.095 * sd + p[17], p[0] - 0.03, 0); rx(A1, -th);
      P_.thigh.setMatrixAt(k, A1);
      tr(A1, 0, -0.44, 0); rx(A1, kn);
      P_.shin.setMatrixAt(k, A1);
      tr(A1, 0, -0.42, 0); rx(A1, th - kn);
      P_.shoe.setMatrixAt(k, A1);
    }
    // the prism pole
    A1.copy(R); tr(A1, p[13], p[14], p[15]); rx(A1, p[16]);
    P_.pole.setMatrixAt(i, A1); P_.band.setMatrixAt(i, A1); P_.prism.setMatrixAt(i, A1);
    M.makeTranslation(o2.x, 0.035, o2.z); M.scale(S3.set(0.9, 1, 0.9)); blobs.setMatrixAt(i, M);
  }
  const PARTS = Object.values(P_);
  function officials(dt, now) {
    anim = false;
    for (const o2 of off) {
      const rate = target(o2, dt, now);
      if (o2.mode !== 'rest' && o2.mode !== 'edm' && o2.mode !== 'wait' && o2.mode !== 'hold') anim = true;
      const t = o2.tgt, c = o2.cur, k = reduce ? 1 : 1 - Math.exp(-dt * rate);
      for (let j = 0; j < 18; j++) c[j] += (t[j] - c[j]) * k;
      if (!reduce && o2.mode !== 'walk') { c[1] = t[1] + Math.sin(now * 0.0013 + o2.i) * 0.012; }
      place(o2);
    }
    for (const m of PARTS) m.instanceMatrix.needsUpdate = true;
    blobs.instanceMatrix.needsUpdate = true;
  }
  // the plaque and the EDM's shadow, placed once
  M.makeTranslation(EDM.x, 0.035, EDM.z); M.scale(S3.set(1.1, 1, 1.1)); blobs.setMatrixAt(NO, M);
  M.copy(HIDE); blobs.setMatrixAt(NO + 1, M);
  officials(0, 0);

  /* ================= measuring: the laser from the EDM to the prism ================= */
  const L0 = new THREE.Vector3(), L1 = new THREE.Vector3();
  let laserK = 0, laserLen = 0, laserWait = false;
  function laserOff() { laser.visible = false; hit.visible = false; laserK = 0; laserWait = false; }
  function aimLaser(i) {
    const o2 = off[i];
    L0.set(EDM.x, 1.59, EDM.z); L1.set(o2.mx, 1.99 * o2.s, o2.mz);
    edmHead.lookAt(L1.x, edmHead.position.y, L1.z);
    laser.position.copy(L0); laser.lookAt(L1); laserLen = L0.distanceTo(L1);
    laserK = reduce ? 1 : 0; laser.scale.set(1, 1, Math.max(0.001, laserLen * laserK)); laser.visible = true;
    hit.position.copy(L1); hit.visible = laserK >= 1;
  }
  // choose the mark: the plaque is drawn and placed now; the camera goes there now, or after `delay`
  function setMark(i, delay) {
    if (markOn >= 0 && markOn !== i && off[markOn].mode === 'hold') off[markOn].mode = 'rest';
    markOn = i; laserOff(); plaque.visible = false;
    markShown = delay <= 0 || reduce;
    drawPlaque({ ...marks[i], n: i + 1 });
    const ps = markShot[i].plaque;
    plaque.position.set(ps[0], 0, ps[1]); plaque.rotation.y = ps[2]; plaque.updateMatrixWorld();
    M.makeTranslation(ps[0], 0.035, ps[1]); M.scale(S3.set(2.6, 1, 0.9)); blobs.setMatrixAt(NO + 1, M);
    laserWait = true; measureAt = performance.now() + Math.max(0, delay);
  }
  const flyToMark = () => flyTo(pose(markShot[markOn]), clamp(1300 + base.pos.distanceTo(v3(pose(markShot[markOn]).pos)) * 16, 1300, 2600));
  // pick another mark while in the sector (from anywhere else, go() takes the long way round)
  function mark(i, o2 = {}) {
    if (i < 0 || i >= N) return;
    if (shot !== 1) { go(1, { mark: i }); return; }
    setMark(i, 0);
    if (reduce || o2.instant) snapTo(pose(markShot[i])); else flyToMark();
  }
  function measuring(dt, now) {
    if (markOn < 0) return;
    const o2 = off[markOn];
    if (!markShown && now >= measureAt) { markShown = true; flyToMark(); }
    if (laserWait) {
      if (now < measureAt || fly || o2.mode !== 'hold' || o2.t < 0.45) return;
      laserWait = false; aimLaser(markOn);
      if (reduce) plaque.visible = true;
    }
    if (laser.visible && laserK < 1) {
      laserK = Math.min(1, laserK + dt / 0.55); laser.scale.z = Math.max(0.001, laserLen * (1 - (1 - laserK) ** 3));
      if (laserK >= 1) { hit.visible = true; plaque.visible = true; }
    }
    if (hit.visible) { const p = 0.62 + Math.sin(now * 0.006) * 0.08; hit.scale.setScalar(p); laserGlow.material.opacity = 0.26 + Math.sin(now * 0.006) * 0.06; }
  }

  /* ================= free look: drag, dolly, nudges; it always springs back ================= */
  const LIM = { yaw: 25 * RAD, pitch: 10 * RAD };
  const soft = (v, lim) => (Math.abs(v) <= lim ? v : Math.sign(v) * (lim + (Math.abs(v) - lim) * 0.25));
  const api = {
    drag(dx, dy) { look.held = true; look.quiet = performance.now(); const k = (camera.fov * RAD) / Math.max(1, H); look.yaw = clamp(look.yaw + dx * k * 0.9, -LIM.yaw * 1.12, LIM.yaw * 1.12); look.pitch = clamp(look.pitch + dy * k * 0.9, -LIM.pitch * 1.15, LIM.pitch * 1.15); },
    release() { look.held = false; look.quiet = performance.now(); },
    dolly(d) { const [a, b] = dollyRange(); const before = look.dolly; look.dolly = clamp(look.dolly + d, a, b); look.quiet = performance.now(); return d - (look.dolly - before); },
    // scroll: 700 units cross this shot's whole dolly range; returns the units that didn't fit
    wheel(u) { if (fly) return 0; const [a, b] = dollyRange(), k = (b - a) / 700; return api.dolly(u * k) / k; },
    nudge(yaw, pitch, units) { look.quiet = performance.now(); look.vy += yaw; look.vp += pitch; if (units) api.wheel(units); },
  };
  function springs(dt, now) {
    if (look.vy || look.vp) { look.yaw = clamp(look.yaw + look.vy * dt, -LIM.yaw, LIM.yaw); look.pitch = clamp(look.pitch + look.vp * dt, -LIM.pitch, LIM.pitch); look.vy *= Math.exp(-dt * 6); look.vp *= Math.exp(-dt * 6); if (Math.abs(look.vy) < 0.001) look.vy = 0; if (Math.abs(look.vp) < 0.001) look.vp = 0; }
    const idle = !look.held && now - look.quiet > (reduce ? 0 : 900);
    if (idle || fly) {
      const k = reduce ? 1 : 1 - Math.exp(-dt * (fly ? 4 : 2.4));
      look.yaw -= look.yaw * k; look.pitch -= look.pitch * k; look.dolly -= look.dolly * k;
      if (Math.abs(look.yaw) < 1e-4) look.yaw = 0; if (Math.abs(look.pitch) < 1e-4) look.pitch = 0; if (Math.abs(look.dolly) < 1e-3) look.dolly = 0;
    }
  }

  /* ================= per frame ================= */
  const dir = new THREE.Vector3(), right = new THREE.Vector3(), camPos = new THREE.Vector3(), camAt = new THREE.Vector3(), lookTmp = new THREE.Vector3();
  function placeCamera(now, dt) {
    if (fly) {
      // rAF's frame time can sit a hair before a performance.now() taken in a task, so clamp both ends
      const k = clamp((now - fly.t0) / fly.dur, 0, 1), e = ease(k), el = ease(Math.min(1, k * 1.35));
      fly.curve.getPoint(e, base.pos); base.look.lerpVectors(fly.l0, fly.l1, el);
      base.fov = fly.f0 + (fly.f1 - fly.f0) * e; base.shift = fly.s0 + (fly.s1 - fly.s0) * e;
      if (k >= 1) fly = null;
    }
    camPos.copy(base.pos);
    if (!reduce && !fly) { camPos.x += Math.sin(now * 0.00021) * 0.06; camPos.y += Math.sin(now * 0.00017 + 1) * 0.04; }
    dir.subVectors(base.look, base.pos).normalize();
    camPos.addScaledVector(dir, look.dolly);
    dir.applyAxisAngle(UP, -soft(look.yaw, LIM.yaw));
    right.crossVectors(dir, UP).normalize();
    dir.applyAxisAngle(right, -soft(look.pitch, LIM.pitch));
    camera.position.copy(camPos);
    camAt.copy(camPos).add(lookTmp.copy(dir).multiplyScalar(20));
    camera.lookAt(camAt);
    if (Math.abs(camera.fov - base.fov) > 1e-3 || camera.userData.shift !== base.shift) {
      camera.fov = base.fov; camera.userData.shift = base.shift;
      if (base.shift) camera.setViewOffset(W, H, -W * base.shift, 0, W, H); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
  }
  let raf = 0, last = 0, on = false, odd = false, ready = false, frames = 0, slow = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const busy = fly || anim || look.held || look.yaw || look.pitch || look.dolly || (laser.visible && laserK < 1);
    if (!busy && (light || reduce) && (odd = !odd)) return;
    springs(dt, now);
    officials(dt, now);
    measuring(dt, now);
    placeCamera(now, dt);
    renderer.render(scene, camera);
    // a slow first second on this device: drop the pixel ratio a step
    if (++frames < 90 && frames > 20) { if (dt > 0.026) slow++; if (slow > 25 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); resize(); slow = 0; } }
    if (!ready) { ready = true; o.onReady(); }
  }
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    const wasTall = tall; tall = o.split ? o.split() : W / H < 0.95;
    camera.aspect = W / H;
    camera.userData.shift = null;
    if (wasTall !== tall && shot >= 0) { const d = restPose(); if (!fly) { base.pos.set(...d.pos); base.look.set(...d.look); base.fov = d.fov; base.shift = d.shift; } }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); on = false; o.onLost(); });

  // which mark is under this point of the canvas (marks are small: pick the nearest on screen)
  const PV = new THREE.Vector3();
  function pickAt(x, y) {
    let best = -1, bd = 46;
    for (let i = 0; i < N; i++) {
      PV.set(off[i].x, 1.0, off[i].z).project(camera);
      if (PV.z > 1) continue;
      const sx = ((PV.x + 1) / 2) * W, sy = ((1 - PV.y) / 2) * H, d = Math.hypot(sx - x, sy - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // the start: the arrival frame (the poster is this same frame), textures up, shaders compiled
  if (reduce) snapTo(pose(SHOTS[0]));
  placeCamera(0, 0);
  for (const t of texs) { renderer.initTexture(t); }
  await pause();
  await renderer.compileAsync(scene, camera);
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { drawBoard(); if (markOn >= 0) drawPlaque({ ...marks[markOn], n: markOn + 1 }); });

  if (/[?&]debug\b/.test(location.search)) window.__cine = { THREE, scene, camera, renderer };
  return Object.assign(api, {
    active(v) { if (v === on) return; on = v; if (v) { last = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); },
    go, mark, pickAt,
    arrive() { if (shot < 0) go(0); },
    board(d) { BD = { ...BD, ...d }; if (shot === 2) BD.mode = 'stats'; drawBoard(); },
    tick() { drawBoard(); },
    pose: () => ({ pos: base.pos.toArray(), look: base.look.toArray() }),
    state: () => ({
      ready, shot: shot >= 0 ? SHOTS[shot].id : null, flying: !!fly, mark: markOn, laser: laser.visible ? Math.round(laserK * 100) / 100 : 0,
      plaque: plaque.visible && markOn >= 0 ? marks[markOn].name : null, planted: off.filter((x) => x.planted).length,
      officials: NO, tones: new Set(off.map((x) => x.skin)).size, modes: off.map((x) => x.mode).join(','),
      yaw: Math.round((look.yaw / RAD) * 10) / 10, pitch: Math.round((look.pitch / RAD) * 10) / 10, dolly: Math.round(look.dolly * 100) / 100,
      dpr: renderer.getPixelRatio(), light: !!light, running: on, calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    }),
  });
}
