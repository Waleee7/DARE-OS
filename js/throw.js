// THE CIRCLE's physics: projectile flight from a real release height. The discus
// adds lift, tuned so a 25.33 m/s release at 36° lands at 75.56 m: SECTOR's
// reconstruction of Mykolas Alekna's world record. The stadium on the landing page
// (js/stage3d.js) throws with these numbers, and tests/ask.test.cjs pins them.
(function (root) {
  const G = 9.81, RAD = Math.PI / 180;
  const HALF = 34.92 / 2;   // sector half-angle, degrees
  const WIN = 36;           // degrees of spin either side of the release point that still land fair
  const AT = -90;           // spin angle where the implement's path points down the centreline
  const RIM = 1.25;         // circle radius: marks are measured from the inside of the rim
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
  // The inverse: the spin angle and speed that land a fair throw `mark` metres from
  // the rim along `dir` degrees. "Take a throw" uses it to land beside a flag.
  function aim(imp, mark, dir) {
    const off = dir * (WIN / HALF), phi = AT + off;
    const deg = imp.opt - 14 * Math.min(1, (off / WIN) ** 2);
    let lo = imp.vmin, hi = imp.vmax;
    if (flight(imp, hi, deg).mark <= mark) return { phi, v: hi };
    if (flight(imp, lo, deg).mark >= mark) return { phi, v: lo };
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (flight(imp, mid, deg).mark < mark) lo = mid; else hi = mid; }
    return { phi, v: (lo + hi) / 2 };
  }

  const PHYS = { flight, speedAt, release, aim, wrap, IMPL, HALF, WIN, AT, RIM, G };
  if (typeof module === 'object' && module.exports) module.exports = PHYS;
  else root.Throw = PHYS;
})(this);
