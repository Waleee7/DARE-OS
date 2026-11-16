// THE CIRCLE in 3D: a night stadium seen from behind the throwing circle. Loaded by
// js/stage.js after the page is up. The discus flies with js/throw.js (the same
// physics the tests pin), lands beside a project's flag, and a red EDM laser measures
// it back to the rim. Light tier for phones: capped pixel ratio, smaller textures,
// fewer crowd instances, every other frame when idle. Nothing allocates per frame.
import * as THREE from './vendor/three.module.min.js';

const RAD = Math.PI / 180, CHALK = 0xeef1f6, RED = 0xff3e3e;
const DISP = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif', MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
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
function band(r0, r1, s, zc) {
  const sh = new THREE.Shape(oval(r1, s, zc));
  sh.holes.push(new THREE.Path(oval(r0, s, zc).reverse()));
  return sh;
}

export function init(o) {
  const { canvas, flags, tags, physics: P, light, reduce } = o;
  const imp = P.IMPL.discus;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !light, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.Fog(0x0a0e18, 120, 340);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 900);

  /* ---------------- sky, stars, light ---------------- */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(620, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 top = vec3(0.012, 0.018, 0.036); vec3 hor = vec3(0.085, 0.105, 0.16); vec3 haze = vec3(0.16, 0.14, 0.12); vec3 c = mix(hor, top, smoothstep(0.0, 0.42, h)); c = mix(c, haze, (1.0 - smoothstep(0.0, 0.07, h)) * 0.45); gl_FragColor = vec4(c, 1.0); }',
  })));
  {
    const n = light ? 140 : 280, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.2; pos.set([Math.cos(a) * Math.cos(e) * 600, Math.sin(e) * 600, Math.sin(a) * Math.cos(e) * 600], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d2e6, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false })));
  }
  scene.add(new THREE.HemisphereLight(0x9fb2d6, 0x0c160d, 0.7));
  const k1 = new THREE.DirectionalLight(0xfff1dc, 1.7); k1.position.set(-55, 70, 8); scene.add(k1);
  const k2 = new THREE.DirectionalLight(0xffe7c4, 1.2); k2.position.set(58, 64, 92); scene.add(k2);
  const pool = new THREE.SpotLight(0xfff6e8, 2.2, 0, 0.42, 0.7, 0); pool.position.set(0, 20, -8); pool.target.position.set(0, 0, 3); scene.add(pool, pool.target);

  /* ---------------- ground: turf, apron, track ---------------- */
  const grass = canvasTex(8, 256, (g) => {
    g.fillStyle = '#1d3d22'; g.fillRect(0, 0, 8, 128); g.fillStyle = '#255030'; g.fillRect(0, 128, 8, 128);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 8, Math.random() * 256, 1, 1); }
  }).t;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(1, 28); grass.anisotropy = aniso;
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(150, 280).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: grass }));
  turf.position.set(0, 0, 40); scene.add(turf);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x0b0d12 }));
  apron.position.set(0, -0.05, 40); scene.add(apron);
  const S = 84.39, ZC = 40, R0 = 36.5, R1 = 36.5 + 9.76;
  const track = new THREE.Mesh(new THREE.ShapeGeometry(band(R0, R1, S, ZC), 8).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x86302a }));
  track.position.y = 0.01; scene.add(track);
  const lanes = []; for (let k = 0; k <= 8; k++) { const r = R0 + k * 1.22; lanes.push(band(r - 0.05, r + 0.05, S, ZC)); }
  const laneMesh = new THREE.Mesh(new THREE.ShapeGeometry(lanes, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: CHALK, transparent: true, opacity: 0.42 }));
  laneMesh.position.y = 0.02; scene.add(laneMesh);

  /* ---------------- the sector, painted on the grass (68 × 92 m) ---------------- */
  const PX = light ? 7.5 : 15, PW = Math.round(68 * PX), PH = Math.round(92 * PX);
  const paint = canvasTex(PW, PH, (g) => {
    const at = (x, z) => [(34 - x) * PX, (86 - z) * PX];
    const ray = (a, r0, r1) => { const p0 = at(r0 * Math.sin(a * RAD), r0 * Math.cos(a * RAD)), p1 = at(r1 * Math.sin(a * RAD), r1 * Math.cos(a * RAD)); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); };
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(238,241,246,.92)'; g.lineWidth = 0.13 * PX;
    ray(P.HALF, 1.3, 90); ray(-P.HALF, 1.3, 90);
    g.strokeStyle = 'rgba(238,241,246,.34)'; g.lineWidth = 0.08 * PX;
    for (let r = 20; r <= 80; r += 10) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const a = -P.HALF + (2 * P.HALF * i) / 40, p = at(r * Math.sin(a * RAD), r * Math.cos(a * RAD)); if (i) g.lineTo(...p); else g.moveTo(...p); }
      g.stroke();
    }
    g.fillStyle = 'rgba(238,241,246,.5)'; g.font = `900 ${2.6 * PX}px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = 20; r <= 80; r += 10) { const a = P.HALF + 3.2, p = at(r * Math.sin(a * RAD), r * Math.cos(a * RAD)); g.fillText(String(r), ...p); }
  });
  paint.t.anisotropy = aniso;
  const paintMesh = new THREE.Mesh(new THREE.PlaneGeometry(68, 92).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshLambertMaterial({ map: paint.t, transparent: true, depthWrite: false }));
  paintMesh.position.set(0, 0.03, 40); scene.add(paintMesh);
  const redrawPaint = () => { const g = paint.g; g.clearRect(0, 0, PW, PH); };
  void redrawPaint;

  /* ---------------- stands, crowd, floodlights ---------------- */
  const box = new THREE.BoxGeometry(1, 1, 1), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  const tiers = [];
  for (const s of [-1, 1]) for (let k = 0; k < 10; k++) tiers.push([s * (52 + k * 1.6), k * 0.9 + 0.45, 40, 1.6, 0.9 + k * 0.0, 132]);
  for (let k = 0; k < 10; k++) tiers.push([0, k * 0.9 + 0.45, 128 + k * 1.6, 112, 0.9, 1.6]);
  const stands = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0x141824 }), tiers.length);
  tiers.forEach(([x, y, z, w, h, d], i) => { M.compose(V.set(x, y, z), Q.identity(), Sc.set(w, h, d)); stands.setMatrixAt(i, M); });
  scene.add(stands);
  {
    const step = light ? 1.5 : 0.75, seats = [];
    for (const s of [-1, 1]) for (let k = 0; k < 10; k++) for (let z = -20; z < 100; z += step) if (Math.random() < 0.5) seats.push([s * (52 + k * 1.6 + s * 0.2), k * 0.9 + 1.18, z + Math.random() * 0.3]);
    for (let k = 0; k < 10; k++) for (let x = -52; x < 52; x += step) if (Math.random() < 0.45) seats.push([x, k * 0.9 + 1.18, 128 + k * 1.6]);
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.56, 0.3), new THREE.MeshLambertMaterial(), seats.length);
    const pal = [0x2a3040, 0x3a3f4c, 0x1d2230, 0x4d5363, 0x6b7180, 0x8c2c2c, 0xc9ccd4, 0x23293a], C = new THREE.Color();
    seats.forEach(([x, y, z], i) => { M.compose(V.set(x, y, z), Q.identity(), Sc.set(1, 0.85 + Math.random() * 0.3, 1)); crowd.setMatrixAt(i, M); crowd.setColorAt(i, C.setHex(pal[(Math.random() * pal.length) | 0])); });
    scene.add(crowd);
  }
  const TOWERS = [[-62, 2], [62, 2], [-62, 84], [62, 84]];
  const masts = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0x1a1f2b }), 4);
  const lamp = canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#2a2e38'; g.fillRect(0, 0, w, h); for (let y = 3; y < h; y += 7) for (let x = 3; x < w; x += 7) { g.fillStyle = '#fff6e4'; g.fillRect(x, y, 4, 4); } }).t;
  const heads = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ map: lamp, toneMapped: false }), 4);
  TOWERS.forEach(([x, z], i) => {
    M.compose(V.set(x, 21, z), Q.identity(), Sc.set(1, 42, 1)); masts.setMatrixAt(i, M);
    Q.setFromEuler(new THREE.Euler(-0.32, Math.atan2(-x, 40 - z), 0, 'YXZ'));
    M.compose(V.set(x, 43, z), Q, Sc.set(10, 5, 0.6)); heads.setMatrixAt(i, M);
  });
  scene.add(masts, heads);
  const glowTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,246,228,1)'); r.addColorStop(0.18, 'rgba(255,236,200,.5)'); r.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }).t;
  {
    const pos = new Float32Array(TOWERS.flatMap(([x, z]) => [x, 43, z]));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size: 70, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })));
  }

  /* ---------------- the jumbotron ---------------- */
  const JW = light ? 512 : 1024, JH = JW / 2, jk = JW / 1024;
  const jumboTex = canvasTex(JW, JH, () => {});
  const frame = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x10141d }));
  frame.scale.set(41, 21.5, 1.4); frame.position.set(0, 21, 152); scene.add(frame);
  for (const x of [-12, 12]) { const leg = new THREE.Mesh(box, frame.material); leg.scale.set(1.4, 12, 1.4); leg.position.set(x, 6, 152.5); scene.add(leg); }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(38, 19).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: jumboTex.t, toneMapped: false, fog: false }));
  screen.position.set(0, 21, 151.2); scene.add(screen);
  let J = { mode: 'idle', live: null };
  function fit(g, text, font, size, max) { g.font = `${font.replace('$', size)}`; let s = size; while (g.measureText(text).width > max && s > 10) { s -= 4; g.font = font.replace('$', s); } return s; }
  function drawJumbo() {
    const g = jumboTex.g, W = JW, H = JH;
    g.fillStyle = '#04060b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff3e3e'; g.fillRect(0, 0, W, 7 * jk);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = '#9aa3b5';
    g.font = `700 ${22 * jk}px ${MONO}`; g.fillText('THE CIRCLE · DARE-OS', 40 * jk, 52 * jk);
    g.textAlign = 'right'; g.fillText(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase(), W - 40 * jk, 52 * jk);
    g.textAlign = 'left';
    if (J.mode === 'idle' || !J.name) {
      g.fillStyle = '#eef1f6'; fit(g, 'JOSHUA DARE', `900 $px ${DISP}`, 170 * jk, W - 80 * jk); g.fillText('JOSHUA DARE', 40 * jk, 250 * jk);
      g.fillStyle = '#c3cad6'; g.font = `700 ${26 * jk}px ${MONO}`; g.fillText('SOFTWARE ENGINEER · DISCUS & HAMMER', 44 * jk, 306 * jk);
      g.fillStyle = '#ff7b7b'; fit(g, "IF IT ISN'T MEASURED, IT DIDN'T COUNT.", `800 $px ${DISP}`, 56 * jk, W - 80 * jk); g.fillText("IF IT ISN'T MEASURED, IT DIDN'T COUNT.", 40 * jk, 440 * jk);
    } else {
      g.fillStyle = '#eef1f6'; fit(g, J.name.toUpperCase(), `800 $px ${DISP}`, 72 * jk, W - 80 * jk); g.fillText(J.name.toUpperCase(), 40 * jk, 128 * jk);
      const bigSize = fit(g, J.big, `900 $px ${DISP}`, (J.word ? 150 : 230) * jk, W * 0.62);
      g.fillText(J.big, 36 * jk, (J.word ? 300 : 330) * jk);
      const bw = g.measureText(J.big).width;
      if (J.unit) { g.fillStyle = '#ff7b7b'; g.font = `800 ${Math.min(96 * jk, bigSize * 0.42)}px ${DISP}`; g.fillText(J.unit.toUpperCase(), 36 * jk + bw + 18 * jk, 330 * jk); }
      g.fillStyle = '#c3cad6'; fit(g, (J.what || '').toUpperCase(), `700 $px ${MONO}`, 26 * jk, W - 80 * jk); g.fillText((J.what || '').toUpperCase(), 40 * jk, 392 * jk);
      g.fillStyle = J.mark && J.mark.foul ? '#ff7b7b' : '#eef1f6'; g.font = `700 ${24 * jk}px ${MONO}`;
      if (J.mark) g.fillText(J.mark.foul ? 'FOUL' : `MARK ${J.mark.mark.toFixed(2)} M · FAIR`, 40 * jk, 466 * jk);
      g.textAlign = 'right'; g.fillStyle = '#9aa3b5'; g.fillText((J.when || '').toUpperCase(), W - 40 * jk, 466 * jk); g.textAlign = 'left';
    }
    g.fillStyle = 'rgba(0,0,0,.32)';
    const st = Math.max(3, 4 * jk); for (let y = 0; y < H; y += st) g.fillRect(0, y, W, 1); for (let x = 0; x < W; x += st) g.fillRect(x, 0, 1, H);
    jumboTex.t.needsUpdate = true;
  }
  drawJumbo();
  if (document.fonts) document.fonts.ready.then(() => { drawJumbo(); });

  /* ---------------- the circle and the cage ---------------- */
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.04, 48), new THREE.MeshLambertMaterial({ color: 0x6a6f78 }));
  pad.position.y = 0.02; scene.add(pad);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.34, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: CHALK }));
  rim.position.y = 0.045; scene.add(rim);
  const winPts = [], WR0 = 0.98, WR1 = 1.14;
  for (let i = 0; i <= 24; i++) { const ph = (P.AT - P.WIN + (2 * P.WIN * i) / 24) * RAD; for (const r of [WR0, WR1]) winPts.push(r * Math.sin(ph), 0.05, r * Math.cos(ph)); }
  const winIdx = []; for (let i = 0; i < 24; i++) { const a = i * 2; winIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const winGeo = new THREE.BufferGeometry(); winGeo.setAttribute('position', new THREE.Float32BufferAttribute(winPts, 3)); winGeo.setIndex(winIdx);
  // arm angle phi (throw.js, x forward / y left) → world (X = y, Z = x)
  const winMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
  const winMesh = new THREE.Mesh(winGeo, winMat); scene.add(winMesh);
  {
    const CAGE = 3.4, a0 = P.HALF + 26, a1 = 360 - P.HALF - 26, n = 9;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.055, 5.2, 6), new THREE.MeshLambertMaterial({ color: 0x3b414e }), n);
    for (let i = 0; i < n; i++) { const a = (a0 + ((a1 - a0) * i) / (n - 1)) * RAD; M.compose(V.set(CAGE * Math.sin(a), 2.6, CAGE * Math.cos(a)), Q.identity(), Sc.set(1, 1, 1)); posts.setMatrixAt(i, M); }
    scene.add(posts);
    const net = canvasTex(32, 32, (g) => { g.strokeStyle = 'rgba(210,218,232,.7)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 32, 32); }).t;
    net.wrapS = net.wrapT = THREE.RepeatWrapping; net.repeat.set(70, 18);
    const netMesh = new THREE.Mesh(new THREE.CylinderGeometry(CAGE, CAGE, 5, 48, 1, true, a0 * RAD, (a1 - a0) * RAD), new THREE.MeshBasicMaterial({ map: net, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    netMesh.position.y = 2.6; scene.add(netMesh);
  }

  /* ---------------- flags ---------------- */
  const FN = flags.length, FX = new Float32Array(FN), FZ = new Float32Array(FN);
  flags.forEach((f, i) => { FX[i] = f.d * Math.sin(f.a * RAD); FZ[i] = f.d * Math.cos(f.a * RAD); });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6), new THREE.MeshLambertMaterial({ color: CHALK }), FN);
  const cloth = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.68).translate(0.55, 0, 0), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), FN);
  const cWhite = new THREE.Color(0xdfe4ec), cRed = new THREE.Color(RED);
  for (let i = 0; i < FN; i++) {
    M.compose(V.set(FX[i], 1.05, FZ[i]), Q.identity(), Sc.set(1, 1, 1)); poles.setMatrixAt(i, M);
    Q.setFromAxisAngle(V.set(0, 1, 0), Math.PI / 2 + (Math.random() - 0.5) * 0.6);
    M.compose(V.set(FX[i], 1.74, FZ[i]), Q, Sc.set(1, 1, 1)); cloth.setMatrixAt(i, M); cloth.setColorAt(i, cWhite);
  }
  scene.add(poles, cloth);
  let litFlag = -1;
  function lightFlag(i) {
    if (litFlag >= 0) cloth.setColorAt(litFlag, cWhite);
    litFlag = i; if (i >= 0) cloth.setColorAt(i, cRed);
    cloth.instanceColor.needsUpdate = true;
  }

  /* ---------------- discus, trail, landing mark, laser ---------------- */
  const prof = [[0, 0.022], [0.03, 0.022], [0.09, 0.012], [0.11, 0.004], [0.11, -0.004], [0.09, -0.012], [0.03, -0.022], [0, -0.022]].map(([x, y]) => new THREE.Vector2(x, y));
  const discus = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshPhongMaterial({ color: 0x2a2e38, specular: 0xffffff, shininess: 70 }));
  const discRim = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.007, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8ecf2 }));
  discus.add(discRim); discus.scale.setScalar(1.6); scene.add(discus);
  const TRAIL = 48, trailPos = new Float32Array(TRAIL * 3), trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.85, toneMapped: false }));
  trail.frustumCulled = false; scene.add(trail);
  let trailN = 0;
  const pushTrail = (p) => { trailPos.copyWithin(3, 0, (TRAIL - 1) * 3); trailPos[0] = p.x; trailPos[1] = p.y; trailPos[2] = p.z; trailN = Math.min(TRAIL, trailN + 1); trailGeo.setDrawRange(0, trailN); trailGeo.attributes.position.needsUpdate = true; };
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  mark.visible = false; scene.add(mark);
  const laserGeo = new THREE.BoxGeometry(0.06, 0.06, 1).translate(0, 0, 0.5);
  const laser = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: 0xff5050, toneMapped: false, fog: false }));
  const laserGlow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 1).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  laser.add(laserGlow); laser.visible = false; scene.add(laser);
  const laserTo = new THREE.Vector3(); let laserLen = 0, laserK = 0;
  function aimLaser(x, z) {
    const r = Math.hypot(x, z), ux = x / r, uz = z / r;
    laser.position.set(ux * 1.29, 0.09, uz * 1.29);
    laserTo.set(x, 0.09, z); laser.lookAt(laserTo);
    laserLen = Math.max(0.1, r - 1.29); laserK = reduce ? 1 : 0;
    laser.scale.set(1, 1, Math.max(0.001, laserLen * laserK)); laser.visible = true;
  }

  /* ---------------- camera rig ---------------- */
  const cam = new THREE.Vector3(0, 3.05, -3.25), look = new THREE.Vector3(0, 0.4, 34);
  const wantPos = new THREE.Vector3().copy(cam), wantLook = new THREE.Vector3().copy(look), tmp = new THREE.Vector3();
  camera.position.copy(cam); camera.lookAt(look);
  let tall = false, mode = 'hero', t0 = 0, phi = 90, held = 0, spinV = imp.vmin, shot = null, flightT = 0, auto = null, enterK = 0, ready = false, throws = 0, focusX = 0, focusZ = 40;
  const discPos = new THREE.Vector3(), L0 = new THREE.Vector3(), L1 = new THREE.Vector3();
  const armAt = (deg, out) => out.set(0.95 * Math.sin(deg * RAD), 1.15, 0.95 * Math.cos(deg * RAD));
  function setWant(now) {
    if (mode === 'enter') { wantPos.set(0, 9, 26); wantLook.set(0, 16, 150); return; }
    if (mode === 'spin' || mode === 'auto') { wantPos.set(0.3, 2.75, -2.75); wantLook.set(0, 0.7, 26); return; }
    if (mode === 'flight') { wantPos.set(discPos.x * 0.6 - 1.2, Math.max(3.2, discPos.y + 2.6), Math.max(-3, discPos.z - 10)); wantLook.set(discPos.x, discPos.y * 0.4, discPos.z + 16); return; }
    if (mode === 'measure') { wantPos.set(focusX * 0.3, 15, -10); wantLook.set(focusX * 0.7, 0, focusZ * 0.72); return; }
    const d = reduce ? 0 : 1;
    wantPos.set(Math.sin(now * 0.00017) * 0.32 * d, 3.05 + Math.sin(now * 0.00011) * 0.14 * d, -3.25); wantLook.set(0, tall ? -9 : 0.4, 34);
  }
  function placeDiscusIdle() { armAt(phi, discPos); discus.position.copy(discPos); discus.rotation.set(0.25, 0, 0); }
  placeDiscusIdle();

  /* ---------------- throws ---------------- */
  function release(r, at) {
    shot = r; flightT = 0; trailN = 0; trailGeo.setDrawRange(0, 0);
    armAt(at, L0);
    const reach = r.cage ? P.RIM + 2 : r.mark + P.RIM, a = r.dir * RAD;
    L1.set(reach * Math.sin(a), 0.03, reach * Math.cos(a));
    if (r.cage) shot.time = 0.35;
    mark.visible = false; laser.visible = false; winMat.opacity = 0;
    mode = 'flight'; throws++;
    if (reduce) land();
  }
  function land() {
    discus.position.copy(L1); discus.position.y = 0.04; discus.rotation.set(0, 0, 0.1);
    mode = shot.foul ? 'hero' : 'measure';
    if (!shot.foul) {
      focusX = L1.x; focusZ = L1.z;
      mark.position.set(L1.x, 0.05, L1.z); mark.visible = true; aimLaser(L1.x, L1.z);
    }
    o.onLand(shot);
  }
  function startSpin(now) { if (mode === 'flight' || mode === 'auto' || mode === 'enter') return; mode = 'spin'; t0 = now; phi = 90; laser.visible = false; mark.visible = false; o.onSpin(true); }
  function letGo(now) {
    if (mode !== 'spin') return;
    const v = imp.vmin + (imp.vmax - imp.vmin) * P.speedAt(imp, (now - t0) / 1000);
    release(P.release(imp, phi, v), phi);
  }
  canvas.addEventListener('pointerdown', (e) => { if (e.button) return; try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ } startSpin(performance.now()); });
  canvas.addEventListener('pointerup', () => letGo(performance.now()));
  canvas.addEventListener('pointercancel', () => { if (mode === 'spin') { mode = 'hero'; winMat.opacity = 0; o.onSpin(false); } });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- per-frame ---------------- */
  const V2 = new THREE.Vector3();
  function placeTags() {
    const w = canvas.clientWidth, h = canvas.clientHeight, all = mode === 'measure';
    for (let i = 0; i < FN; i++) {
      const el = tags[i] && tags[i].el; if (!el) continue;
      V2.set(FX[i], 2.3, FZ[i]).project(camera);
      // from behind the circle the flags stack up on the horizon: name them all only in the broadcast view
      const off = (!all && i !== litFlag) || V2.z > 1 || V2.x < -1.05 || V2.x > 1.05 || V2.y < -1 || V2.y > 1;
      if (off) { if (!el.hasAttribute('data-off')) el.setAttribute('data-off', ''); continue; }
      if (el.hasAttribute('data-off')) el.removeAttribute('data-off');
      el.style.transform = `translate3d(${((V2.x + 1) / 2) * w | 0}px, ${((1 - V2.y) / 2) * h - 22 | 0}px, 0)`;
    }
  }
  let raf = 0, last = 0, on = false, odd = false;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const busy = mode !== 'hero';
    if (!busy && (light || reduce) && (odd = !odd)) return;
    if (mode === 'spin') {
      held = (now - t0) / 1000;
      const sp = P.speedAt(imp, held); spinV = imp.vmin + (imp.vmax - imp.vmin) * sp;
      phi += 360 * (imp.w0 + (imp.w1 - imp.w0) * sp) * dt;
      winMat.opacity = Math.abs(P.wrap(phi - P.AT)) <= P.WIN ? 0.95 : 0.35;
      armAt(phi, discPos); discus.position.copy(discPos); discus.rotation.set(0.2, -phi * RAD, 0);
      if (held > 10) letGo(now);
    } else if (mode === 'auto') {
      const k = Math.min(1, (now - auto.t0) / 1100), e = 1 - (1 - k) * (1 - k);
      phi = auto.end - (1 - e) * 540;
      winMat.opacity = Math.abs(P.wrap(phi - P.AT)) <= P.WIN ? 0.95 : 0.35;
      armAt(phi, discPos); discus.position.copy(discPos); discus.rotation.set(0.2, -phi * RAD, 0);
      if (k >= 1) release(auto.r, auto.end);
    } else if (mode === 'flight') {
      flightT += dt * 1.55;
      const t = Math.min(flightT, shot.time), k = t / shot.time;
      discPos.lerpVectors(L0, L1, k);
      discPos.y = shot.cage ? 1.2 * (1 - k) + 0.1 : Math.max(0.04, imp.h + shot.vy * t - 0.5 * P.G * t * t);
      discus.position.copy(discPos); discus.rotation.y += dt * 20;
      pushTrail(discPos);
      if (flightT >= shot.time) land();
    }
    if (laser.visible && laserK < 1) { laserK = Math.min(1, laserK + dt / 0.7); laser.scale.z = Math.max(0.001, laserLen * (1 - (1 - laserK) ** 3)); }
    setWant(now);
    const kk = reduce ? 1 : 1 - Math.exp(-dt * (mode === 'flight' ? 5 : mode === 'enter' ? 6 : 2.6));
    cam.lerp(wantPos, kk); look.lerp(wantLook, kk);
    camera.position.copy(cam); camera.lookAt(look);
    placeTags();
    renderer.render(scene, camera);
    if (!ready) { ready = true; o.onReady(); }
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; tall = w / h < 0.8; camera.fov = tall ? 64 : w / h < 1.2 ? 54 : 44; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); on = false; o.onLost(); });

  return {
    active(v) { if (v === on) return; on = v; if (v) { last = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); },
    throwShot(r, at) { if (mode === 'flight' || mode === 'auto') return; laser.visible = false; mark.visible = false; auto = { r, end: at, t0: performance.now() }; mode = 'auto'; if (reduce) release(r, at); },
    measure(i) {
      if (mode === 'flight' || mode === 'auto' || mode === 'spin') return;
      lightFlag(i); focusX = FX[i]; focusZ = FZ[i]; mark.visible = false;
      aimLaser(FX[i], FZ[i]); mode = 'measure';
    },
    jumbo(d) {
      if (d.mode !== 'keep') J = { ...J, ...d };
      if (d.mode === 'flag') lightFlag(flags.findIndex((f) => f.name === d.name));
      drawJumbo();
    },
    enter() { mode = 'enter'; },
    state: () => ({ ready, mode, throws, laser: laser.visible ? Math.round(laserK * 100) / 100 : 0, dpr: renderer.getPixelRatio(), light: !!light, running: on, calls: renderer.info.render.calls }),
  };
}
