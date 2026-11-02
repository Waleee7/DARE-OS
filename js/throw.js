// THE CIRCLE: take a throw. Hold to spin, let go while the implement crosses the
// red window. The mark is projectile physics from a real release height. The
// discus adds lift, tuned so a 25.33 m/s release at 36° lands at 75.56 m: SECTOR's
// reconstruction of Mykolas Alekna's world record.
(function (root) {
  const G = 9.81, RAD = Math.PI / 180;
  const HALF = 34.92 / 2;   // sector half-angle, degrees
  const WIN = 36;           // degrees of spin either side of the release point that still land fair
  const AT = -90;           // spin angle where the implement's path points down the centreline
  const CAGE = 3.4;         // metres from the centre to the net
  const IMPL = {
    discus: { vmin: 13, vmax: 25.33, opt: 36, h: 1.8, lift: 0.17, ramp: 1.35, keep: 0.9, w0: 0.8, w1: 1.9, arm: 17 },
    hammer: { vmin: 15, vmax: 29, opt: 40, h: 1.5, lift: 0, ramp: 1.9, keep: 1.0, w0: 1.0, w1: 2.3, arm: 32 },
  };

  // Vacuum flight from release height h, plus lift that fades away from the optimum angle.
  function flight(imp, v, deg) {
    const a = deg * RAD, vx = v * Math.cos(a), vy = v * Math.sin(a);
    const time = (vy + Math.sqrt(vy * vy + 2 * G * imp.h)) / G;
    const k = Math.max(0, 1 - ((deg - imp.opt) / 22) ** 2);
    return { mark: vx * time * (1 + imp.lift * k), time, vy };
  }
  // Share of top speed after holding for t seconds: builds, holds, then fades.
  function speedAt(imp, t) {
    if (t < imp.ramp) return 1 - (1 - t / imp.ramp) ** 3;
    const over = t - imp.ramp - imp.keep;
    return over > 0 ? Math.max(0.35, 1 - over * 0.35) : 1;
  }
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  // A release at spin angle phi: the fair window maps onto the sector, and dead
  // centre gives the optimum angle. Anything past a quarter turn goes into the net.
  function release(imp, phi, v) {
    const off = wrap(phi - AT);
    const cage = Math.abs(off) > 90;
    const dir = cage ? off : off * (HALF / WIN);
    const deg = imp.opt - 14 * Math.min(1, (off / WIN) ** 2);
    const f = flight(imp, v, deg);
    return { v, deg, dir, off, cage, foul: cage || Math.abs(dir) > HALF, ...f };
  }

  const PHYS = { flight, speedAt, release, IMPL, HALF, WIN, AT };
  if (typeof module === 'object' && module.exports) { module.exports = PHYS; return; }
  root.Throw = PHYS;

  const sec = document.getElementById('throw');
  if (!sec) return;
  const field = sec.querySelector('.field'), cv = field.querySelector('canvas'), g = cv.getContext('2d');
  const hold = field.querySelector('.hold'), prompt = field.querySelector('.f-prompt');
  const ui = {};
  for (const el of sec.querySelectorAll('[data-r]')) ui[el.dataset.r] = el;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const REF = {
    discus: ["Alekna's 75.56 m world record needed a 25.33 m/s release at 36°.", "SECTOR'S RECONSTRUCTION"],
    hammer: ['The hammer flies without lift, so this one is all release speed and angle.', 'SECTOR MODELS IT BALLISTIC TOO'],
  };
  const CHALK = 'rgba(238,241,246,', RED = '#ff3e3e', INK = '#eef1f6';

  let kind = 'discus', imp = IMPL.discus;
  let state = 'idle', t0 = 0, last = 0, phi = 90, speed = 0, raf = 0, shot = null, tape = 0, tries = 0;
  const marks = { discus: [], hammer: [] };
  const best = { discus: store.get('jd-best-discus'), hammer: store.get('jd-best-hammer') };

  /* ---- geometry: metres on the ground → canvas pixels ---- */
  let W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0, up = false;
  const P = (x, y) => (up ? [ox - y * s, oy - x * s] : [ox + x * s, oy - y * s]);
  const polar = (r, deg) => P(r * Math.cos(deg * RAD), r * Math.sin(deg * RAD));
  const armAt = (deg) => { const r = imp.arm / s; return [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)]; };
  function layout() {
    const r = field.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    up = H > W * 0.9;
    field.classList.toggle('portrait', up);
    if (up) { s = Math.min((H - 60) / 94, (W / 2 - 14) / 30); ox = W / 2; oy = H - 36; }
    else { s = Math.min((W - 64) / 94, (H / 2 - 18) / 30); ox = 36; oy = H / 2; }
    draw();
  }

  /* ---- drawing ---- */
  function line(a, b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  function arc(r, d0, d1, n = 40) {
    g.beginPath();
    for (let i = 0; i <= n; i++) { const p = polar(r, d0 + (d1 - d0) * (i / n)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  }
  function dot(p, r, fill) { g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function text(str, p, color, align = 'left') {
    g.font = '700 11px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = align; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(6,8,13,.85)'; const w = g.measureText(str).width;
    const x = align === 'left' ? p[0] : p[0] - w / 2;
    g.fillRect(x - 4, p[1] - 9, w + 8, 18);
    g.fillStyle = color; g.fillText(str, p[0], p[1]);
  }

  function drawField() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#06080d'; g.fillRect(0, 0, W, H);
    // turf inside the sector, mown in 5 m bands
    for (let d = 0; d < 100; d += 5) {
      g.beginPath();
      for (let i = 0; i <= 16; i++) { const p = polar(d, -HALF + (2 * HALF * i) / 16); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
      for (let i = 16; i >= 0; i--) { const p = polar(d + 5, -HALF + (2 * HALF * i) / 16); g.lineTo(p[0], p[1]); }
      g.fillStyle = (d / 5) % 2 ? CHALK + '.016)' : CHALK + '.034)'; g.fill();
    }
    g.lineCap = 'butt';
    g.strokeStyle = CHALK + '.12)'; g.lineWidth = 1;
    for (let d = 10; d <= 90; d += 10) { arc(d, -HALF, HALF); g.stroke(); }
    g.strokeStyle = CHALK + '.45)'; g.lineWidth = 1.5;
    line(P(0, 0), polar(100, HALF)); line(P(0, 0), polar(100, -HALF));
    g.font = '600 10px "JetBrains Mono", ui-monospace, monospace'; g.fillStyle = CHALK + '.42)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 20; d <= 90; d += 10) { const p = polar(d, HALF + (14 / (d * s)) / RAD); g.fillText(d + 'M', p[0], p[1]); }
    // the cage: a net behind the circle, open toward the sector
    g.setLineDash([3, 4]); g.strokeStyle = CHALK + '.22)'; g.lineWidth = 1;
    arc(Math.max(CAGE, 22 / s), HALF + 26, 360 - HALF - 26, 48); g.stroke(); g.setLineDash([]);
    const c = P(0, 0), rr = Math.max(1.25 * s, 9);
    g.beginPath(); g.arc(c[0], c[1], rr, 0, Math.PI * 2); g.fillStyle = '#0b0f17'; g.fill();
    g.strokeStyle = RED; g.lineWidth = 2; g.stroke();
  }

  function drawMarks() {
    const list = marks[kind];
    if (!list.length) return;
    let top = list[0];
    for (const m of list) { if (m.mark > top.mark) top = m; dot(P(m.x, m.y), 2.4, CHALK + '.45)'); }
    if (!shot || shot.foul || shot.mark < top.mark) {
      const p = P(top.x, top.y); dot(p, 3.6, RED);
      text(`BEST ${top.mark.toFixed(2)}`, [p[0] + 9, p[1]], CHALK + '.8)');
    }
  }

  function drawSpinner() {
    const c = P(0, 0), p = P(...armAt(phi));
    const inWin = state === 'spin' && Math.abs(wrap(phi - AT)) <= WIN;
    g.lineCap = 'round'; g.lineWidth = 4;
    g.strokeStyle = inWin ? RED : 'rgba(255,62,62,.4)';
    if (inWin) { g.shadowColor = RED; g.shadowBlur = 16; }
    arc((imp.arm + 9) / s, AT - WIN, AT + WIN, 24); g.stroke();
    g.shadowBlur = 0;
    if (state === 'spin') for (let k = 10; k >= 1; k--) dot(P(...armAt(phi - k * 9)), 2.2, CHALK + (0.04 + 0.05 * (10 - k) / 10).toFixed(3) + ')');
    g.strokeStyle = CHALK + (kind === 'hammer' ? '.8)' : '.35)'); g.lineWidth = kind === 'hammer' ? 1.2 : 3; line(c, p);
    dot(c, 4.5, INK);
    dot(p, kind === 'hammer' ? 5.5 : 5, INK);
    if (kind === 'discus') { g.beginPath(); g.arc(p[0], p[1], 5, 0, Math.PI * 2); g.strokeStyle = RED; g.lineWidth = 1.5; g.stroke(); }
  }

  const reach = (sh) => (sh.cage ? CAGE : sh.mark + 1.25);
  const landing = (sh) => [Math.cos(sh.dir * RAD) * reach(sh), Math.sin(sh.dir * RAD) * reach(sh)];
  function drawFlight() {
    const t = Math.min(shot.t, shot.time), k = t / shot.time, L = landing(shot);
    const gx = shot.x0 + (L[0] - shot.x0) * k, gy = shot.y0 + (L[1] - shot.y0) * k;
    const z = shot.cage ? 1.2 : Math.max(0, imp.h + shot.vy * t - 0.5 * G * t * t);
    g.setLineDash([2, 5]); g.strokeStyle = 'rgba(255,62,62,.6)'; g.lineWidth = 1.5; g.lineCap = 'butt';
    line(P(shot.x0, shot.y0), P(gx, gy)); g.setLineDash([]);
    const p = P(gx, gy), lift = Math.min(s, 7) * z * 0.6;
    g.beginPath(); g.ellipse(p[0], p[1], 5, 2.5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.6)'; g.fill();
    dot([p[0] - lift * 0.3, p[1] - lift], kind === 'hammer' ? 5.5 : 5, INK);
    dot(P(0, 0), 4.5, INK);
  }

  function drawLanded() {
    const L = landing(shot), u = shot.dir * RAD, e = [Math.cos(u) * 1.25, Math.sin(u) * 1.25];
    const k = state === 'tape' ? 1 - (1 - tape) ** 3 : 1;
    if (!shot.cage) {
      g.setLineDash([4, 3]); g.strokeStyle = shot.foul ? 'rgba(255,62,62,.6)' : CHALK + '.85)'; g.lineWidth = 1; g.lineCap = 'butt';
      line(P(...e), P(e[0] + (L[0] - e[0]) * k, e[1] + (L[1] - e[1]) * k)); g.setLineDash([]);
    }
    const p = P(...L);
    if (shot.foul) {
      g.strokeStyle = RED; g.lineWidth = 2; line([p[0] - 5, p[1] - 5], [p[0] + 5, p[1] + 5]); line([p[0] - 5, p[1] + 5], [p[0] + 5, p[1] - 5]);
      text('FOUL', [p[0] + 10, p[1]], RED);
    } else {
      dot(p, 4.5, INK); g.beginPath(); g.arc(p[0], p[1], 8, 0, Math.PI * 2); g.strokeStyle = RED; g.lineWidth = 1.5; g.stroke();
      if (k === 1) text(`${shot.mark.toFixed(2)} M`, [p[0] + 13, p[1]], INK);
    }
    dot(P(0, 0), 4.5, INK);
  }

  function draw() {
    if (!W) return;
    drawField();
    drawMarks();
    if (state === 'flight') drawFlight();
    else if ((state === 'tape' || state === 'landed') && shot) drawLanded();
    else drawSpinner();
  }

  /* ---- readout ---- */
  const fmt = (n) => n.toFixed(2);
  function hud() {
    const set = (k, v) => { if (ui[k] && ui[k].textContent !== v) ui[k].textContent = v; };
    let verdict = '', cls = 'verdict';
    if (state === 'spin') {
      const held = (performance.now() - t0) / 1000;
      set('label', 'RELEASE SPEED'); set('num', speed.toFixed(1)); set('unit', 'm/s');
      set('rel', held > imp.ramp + imp.keep ? "You're losing it. Let go." : 'Let go in the red.');
    } else if (state === 'flight') {
      set('label', 'IN THE AIR'); set('num', shot.v.toFixed(1)); set('unit', 'm/s');
      set('rel', `${shot.deg.toFixed(1)}° release · ${imp.h.toFixed(2)} m high`);
    } else if (shot) {
      const k = state === 'tape' ? 1 - (1 - tape) ** 3 : 1;
      set('label', 'MARK');
      if (shot.foul) {
        set('num', 'FOUL'); set('unit', '');
        verdict = 'FOUL'; cls += ' foul';
        set('rel', shot.cage ? 'Released too late: into the cage.' : `Outside the sector by ${(Math.abs(shot.dir) - HALF).toFixed(1)}°. It would have measured ${fmt(shot.mark)} m.`);
      } else {
        set('num', fmt(shot.mark * k)); set('unit', 'm');
        verdict = shot.pb ? 'NEW BEST' : 'FAIR'; cls += shot.pb ? ' pb' : ' fair';
        set('rel', `${shot.v.toFixed(1)} m/s · ${shot.deg.toFixed(1)}° · from ${imp.h.toFixed(2)} m`);
      }
    } else {
      set('label', 'MARK'); set('num', '0.00'); set('unit', 'm');
      set('rel', 'Hold to spin. Let go in the red.');
    }
    if (ui.verdict) { set('verdict', verdict); ui.verdict.className = cls; }
    set('best', best[kind] == null ? '—' : `${fmt(best[kind])} m`);
    set('tries', String(tries));
    prompt.hidden = state === 'spin' || state === 'flight' || state === 'tape';
    setPrompt(!!shot);
  }
  let promptAgain = null;
  const bold = (t) => { const b = document.createElement('b'); b.textContent = t; return b; };
  function setPrompt(again) {
    if (promptAgain === again) return;
    promptAgain = again;
    prompt.replaceChildren(...(again ? [bold('HOLD'), ' TO THROW AGAIN'] : [bold('HOLD'), ' TO SPIN · LET GO IN THE ', bold('RED')]));
  }

  /* ---- the attempt ---- */
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state === 'spin') {
      const held = (now - t0) / 1000, sp = speedAt(imp, held);
      speed = imp.vmin + (imp.vmax - imp.vmin) * sp;
      phi += 360 * (imp.w0 + (imp.w1 - imp.w0) * sp) * dt;
      if (held > 10) letGo();
    } else if (state === 'flight') {
      shot.t += dt * (reduce ? 8 : 1.7);
      if (shot.t >= shot.time) land();
    } else if (state === 'tape') {
      tape = Math.min(1, tape + dt / (reduce ? 0.05 : 0.5));
      if (tape >= 1) state = 'landed';
    }
    draw(); hud();
    if (state === 'spin' || state === 'flight' || state === 'tape') raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  function start() {
    if (state === 'spin' || state === 'flight' || state === 'tape') return;
    state = 'spin'; t0 = performance.now(); phi = 90; speed = imp.vmin; shot = null;
    kick();
  }
  function letGo() {
    if (state !== 'spin') return;
    const v = imp.vmin + (imp.vmax - imp.vmin) * speedAt(imp, (performance.now() - t0) / 1000);
    shot = release(imp, phi, v);
    [shot.x0, shot.y0] = armAt(phi);
    shot.t = 0;
    if (shot.cage) shot.time = 0.3;
    state = 'flight'; kick();
  }
  function land() {
    shot.t = shot.time; tries++;
    if (!shot.foul) {
      const L = landing(shot);
      marks[kind].push({ x: L[0], y: L[1], mark: shot.mark });
      if (best[kind] == null || shot.mark > best[kind]) {
        best[kind] = Math.round(shot.mark * 100) / 100; store.set('jd-best-' + kind, best[kind]); shot.pb = true;
      }
    }
    tape = 0; state = 'tape';
    if (ui.live) {
      ui.live.textContent = shot.foul
        ? `Foul. ${shot.cage ? 'Released into the cage.' : 'Outside the sector.'} Hold to throw again.`
        : `${fmt(shot.mark)} metres, fair${shot.pb ? ', a new best' : ''}. Released at ${shot.v.toFixed(1)} metres per second, ${Math.round(shot.deg)} degrees.`;
    }
  }

  hold.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    try { hold.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    start();
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) hold.addEventListener(t, letGo);
  hold.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) start();
  });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); letGo(); } });
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('blur', letGo);

  for (const b of sec.querySelectorAll('[data-impl]')) {
    b.addEventListener('click', () => {
      if (state === 'spin' || state === 'flight') return;
      kind = b.dataset.impl; imp = IMPL[kind]; shot = null; state = 'idle';
      for (const x of sec.querySelectorAll('[data-impl]')) x.setAttribute('aria-pressed', String(x === b));
      if (ui.ref) { ui.ref.firstChild.textContent = REF[kind][0]; ui.ref.querySelector('cite').textContent = REF[kind][1]; }
      draw(); hud();
    });
  }

  new ResizeObserver(layout).observe(field);
  if (document.fonts) document.fonts.ready.then(draw);
  hud();

  const JD = (root.JD = root.JD || {});
  // Read-only view of the attempt, for the headless page checks.
  JD.throwState = () => ({ state, kind, off: wrap(phi - AT), held: state === 'spin' ? (performance.now() - t0) / 1000 : 0, shot: shot && { mark: shot.mark, foul: shot.foul } });
  // Open The Circle (a window on the desktop, a sheet on a phone) with the hold button focused.
  JD.focusThrow = (opener) => {
    if (JD.wm) JD.wm.open('circle', { opener, focus: false });
    else sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => hold.focus({ preventScroll: true }), reduce ? 0 : 60);
  };
})(this);
