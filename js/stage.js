// THE CIRCLE: the night stadium you land in. This file is the DOM side: which view is
// showing (stadium, desktop, clean résumé), the email menu, the LED ribbon of flags,
// the jumbotron readout, "Shipped this week", and loading the 3D (js/stage3d.js)
// only after the page is up. Without WebGL the poster stays and every control still
// works: a throw is computed with the same physics and read out at once.
(function (root) {
  const JD = (root.JD = root.JD || {});
  const html = document.documentElement, stage = document.getElementById('stage');
  if (!stage || !JD.board) return;
  const wm = JD.wm, T = root.Throw, FLAGS = JD.board.flags;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 759px), (pointer: coarse)');
  const $ = (s, el = stage) => el.querySelector(s);
  const store = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } return null; };

  /* ---------------- views ---------------- */
  let three = null, loading = null;
  const view = () => html.dataset.view;
  function setView(v, o = {}) {
    if (!['stage', 'os', 'clean'].includes(v) || v === view()) return;
    const from = view(), go = () => {
      html.dataset.view = v;
      stage.classList.remove('leaving');
      if (v !== 'clean') store('jd-view', v);
      const url = v === 'clean' ? '?view=clean' : location.pathname;
      if (!o.keepUrl) history.replaceState(null, '', url + (v === 'os' ? location.hash : ''));
      if (three) three.active(v === 'stage');
      if (v === 'stage') { boot(); setTimeout(() => $('.st-take').focus({ preventScroll: true }), 30); }
      if (v === 'os' && wm && !o.quiet && !wm.phone() && !wm.list().length) wm.open('readme', { focus: false });
      if (v === 'os' && !o.quiet) setTimeout(() => document.getElementById('desk').focus({ preventScroll: true }), 30);
      if (v === 'clean') { scrollTo(0, 0); setTimeout(() => document.getElementById('cl-h').focus({ preventScroll: true }), 30); }
      document.dispatchEvent(new CustomEvent('jd:view', { detail: { view: v, from } }));
    };
    if (from === 'stage' && v === 'os' && !reduce.matches && !o.quiet) {
      stage.classList.add('leaving');
      if (three) three.enter();
      setTimeout(go, 360);
    } else go();
  }
  document.getElementById('cl-h').tabIndex = -1;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-view-go]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setView(a.dataset.viewGo);
  });
  // Anything that opens a window from the stadium (a case study, the chat, a deep
  // link, the "/" key) walks you into DARE-OS first.
  if (wm) wm.on((type) => { if (type === 'open' && view() !== 'os') setView('os', { quiet: true }); });
  for (const b of document.querySelectorAll('[data-print]')) b.addEventListener('click', () => print());
  for (const a of document.querySelectorAll('[data-email-text]')) if (JD.email) a.textContent = JD.email;

  /* ---------------- email: one button, three subjects ---------------- */
  const SUBJECT = { work: 'Software engineering role', contract: 'Contract build', question: 'Question from your portfolio' };
  const mailBtn = $('[data-mail-btn]'), menu = $('#st-mailmenu');
  for (const a of menu.querySelectorAll('[data-mail]')) a.href = `mailto:${JD.email}?subject=${encodeURIComponent(SUBJECT[a.dataset.mail])}`;
  const menuOpen = (on, refocus) => {
    menu.hidden = !on; mailBtn.setAttribute('aria-expanded', String(on));
    if (on) menu.querySelector('a').focus(); else if (refocus) mailBtn.focus();
  };
  mailBtn.addEventListener('click', () => menuOpen(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(() => menuOpen(false), 0); });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('a')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); menuOpen(false, true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('.st-mail')) menuOpen(false); });
  stage.addEventListener('focusout', (e) => { if (!menu.hidden && !(e.relatedTarget && e.relatedTarget.closest('.st-mail'))) menuOpen(false); });

  /* ---------------- live numbers (filled by live.js) ---------------- */
  const ago = (iso) => {
    const min = Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
    return min < 60 ? `${Math.max(1, Math.round(min))} min ago` : min < 2880 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} days ago`;
  };
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function liveFor(f) {
    const L = JD.live || {}, out = [];
    const p = f.url && L.sites && L.sites[f.url];
    if (p) out.push(p.ok ? `Answered your browser in ${p.ms} ms at ${clock(p.at)}` : 'No answer from your browser just now');
    const r = f.repo && L.repos && L.repos[f.repo];
    if (r) out.push(`Last public push ${ago(r.pushed)}`);
    return { text: out.join(' · '), probe: p };
  }

  /* ---------------- the readout (and the jumbotron's data) ---------------- */
  const R = {};
  for (const n of stage.querySelectorAll('.st-read [data-r]')) R[n.dataset.r] = n;
  const openBtn = $('[data-read-open]'), say = $('[data-say]');
  let current = -1, lastMark = null;
  function numbers(f) {
    const { probe } = liveFor(f);
    if (f.big === 'LIVE') return probe && probe.ok ? { big: String(probe.ms), unit: 'ms', what: `to answer your browser just now · ${f.what}` } : { big: 'LIVE', unit: '', what: f.what };
    if (f.wip && f.big === 'SOON') return { big: 'IN PROGRESS', unit: '', what: f.what, word: true };
    return { big: f.big, unit: f.unit, what: f.what };
  }
  function show(i, mark) {
    const f = FLAGS[i];
    if (!f) return;
    current = i;
    const n = numbers(f), live = liveFor(f);
    R.cat.textContent = `${String(i + 1).padStart(2, '0')}/${FLAGS.length} · ${f.cat}`;
    R.name.textContent = f.name;
    R.big.textContent = n.big; R.big.classList.toggle('word', !!n.word);
    R.unit.textContent = n.unit;
    R.what.textContent = n.what;
    R.how.textContent = f.how + (f.wip && f.big !== 'SOON' ? ` ${f.wip}.` : '');
    R.when.textContent = f.when;
    R.live.hidden = !live.text;
    R.live.replaceChildren();
    if (live.text) { const dot = document.createElement('span'); dot.className = 'st-live-dot'; dot.setAttribute('aria-hidden', 'true'); R.live.append(dot, live.text); }
    lastMark = mark || null;
    R.mark.hidden = !mark;
    if (mark) R.mark.textContent = mark.foul ? `Foul · ${mark.cage ? 'into the cage' : 'outside the sector'}` : `Mark ${mark.mark.toFixed(2)} m · fair · ${mark.v.toFixed(1)} m/s at ${mark.deg.toFixed(1)}°`;
    openBtn.hidden = !f.open || !(wm && wm.has(f.open));
    for (const b of stage.querySelectorAll('[data-flag]')) b.setAttribute('aria-pressed', String(b.dataset.flag === f.id));
    for (const t of tags) t.el.classList.toggle('on', t.id === f.id);
    const rb = stage.querySelector(`.st-ribbon [data-flag="${f.id}"]`);
    if (rb && !phone.matches) rb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
    if (three) three.jumbo({ mode: 'flag', name: f.name, big: n.big, unit: n.unit, what: n.what, when: f.when, mark, word: !!n.word });
    say.textContent = (mark ? (mark.foul ? 'Foul. ' : `${mark.mark.toFixed(2)} metres, fair. Landed by ${f.name}. `) : `${f.name}. `) + `${n.big} ${n.unit} ${n.what}. ${f.when}.`;
  }
  openBtn.addEventListener('click', () => { const f = FLAGS[current]; if (f && f.open) { if (f.open === 'circle' && JD.focusThrow) JD.focusThrow(openBtn); else wm.open(f.open, { opener: openBtn }); } });
  for (const b of stage.querySelectorAll('[data-read-step]')) b.addEventListener('click', () => pick((Math.max(0, current) + +b.dataset.readStep + FLAGS.length) % FLAGS.length));
  // A pick from the ribbon, a flag or the arrows: the laser measures that flag (no throw).
  function pick(i) { if (three) three.measure(i); show(i); }

  /* ---------------- the ribbon and the flag tags ---------------- */
  const ribbon = $('[data-flags]'), tagBox = $('.st-tags'), tags = [];
  ribbon.replaceChildren(...FLAGS.map((f, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.flag = f.id; b.setAttribute('aria-pressed', 'false');
    const num = document.createElement('i'); num.textContent = String(i + 1).padStart(2, '0');
    const val = document.createElement('span'); val.textContent = f.big === 'LIVE' ? 'live' : f.big === 'SOON' ? 'in progress' : `${f.big} ${f.unit}`.trim();
    b.append(num, f.name, val);
    b.addEventListener('click', () => pick(i));
    li.appendChild(b);
    // the same flag, pinned to its pole in the stadium (pointer only)
    const t = document.createElement('button');
    t.type = 'button'; t.tabIndex = -1; t.className = 'st-tag'; t.dataset.off = '';
    const tv = document.createElement('b'); tv.textContent = val.textContent;
    t.append(f.name, tv);
    t.addEventListener('click', () => pick(i));
    tagBox.appendChild(t);
    tags.push({ id: f.id, el: t });
    return li;
  }));
  ribbon.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && ribbon.scrollWidth > ribbon.clientWidth) { ribbon.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });

  /* ---------------- throws ---------------- */
  const take = $('[data-take]');
  let next = 0, throws = 0, busy = false;
  // Nearest flag to where the discus came down (the landing point, in metres).
  function nearest(r) {
    const reach = r.cage ? 0 : r.mark + T.RIM, lx = reach * Math.sin(r.dir * Math.PI / 180), lz = reach * Math.cos(r.dir * Math.PI / 180);
    let best = 0, bd = Infinity;
    FLAGS.forEach((f, i) => { const fx = f.d * Math.sin(f.a * Math.PI / 180), fz = f.d * Math.cos(f.a * Math.PI / 180), d = Math.hypot(fx - lx, fz - lz); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function landed(r) {
    busy = false; throws++;
    take.removeAttribute('aria-busy');
    show(r.foul ? (current < 0 ? 0 : current) : nearest(r), r);
  }
  // "Take a throw": aim for the next flag on the board and land beside it.
  function takeThrow() {
    if (busy) return;
    const i = next; next = (next + 1) % FLAGS.length;
    const f = FLAGS[i], imp = T.IMPL.discus;
    const aim = T.aim(imp, f.d - 1.0 - T.RIM, f.a + 0.9), r = T.release(imp, aim.phi, aim.v);
    if (three) { busy = true; take.setAttribute('aria-busy', 'true'); three.throwShot(r, aim.phi); }
    else landed(r);
  }
  take.addEventListener('click', takeThrow);

  /* ---------------- shipped this week ---------------- */
  const ACT = { PushEvent: 'Pushed to', CreateEvent: 'Created', PublicEvent: 'Made public', ReleaseEvent: 'Released' };
  function feed(events) {
    const week = Date.now() - 7 * 864e5, rows = [], seen = new Set();
    for (const e of events) {
      if (!ACT[e.type] || e.repo.name === 'Waleee7/Waleee7') continue;
      if (e.type === 'CreateEvent' && e.payload.ref_type === 'tag') continue;
      const repo = e.repo.name.split('/')[1], day = e.created_at.slice(0, 10), key = repo + day;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = e.payload || {};
      const what = e.type === 'PushEvent' ? `Pushed to ${(p.ref || '').replace('refs/heads/', '')}`
        : e.type === 'CreateEvent' ? (p.ref_type === 'repository' ? 'New repo' : `New branch ${p.ref || ''}`) : ACT[e.type];
      const href = e.type === 'PushEvent' && p.head ? `https://github.com/${e.repo.name}/commit/${p.head}` : `https://github.com/${e.repo.name}`;
      rows.push({ at: e.created_at, repo, what, href, week: Date.parse(e.created_at) >= week });
      if (rows.length >= 8) break;
    }
    return rows;
  }
  function renderFeed() {
    const L = JD.live;
    if (!L || !L.events) return;
    const rows = feed(L.events), n = rows.filter((r) => r.week).length;
    for (const list of document.querySelectorAll('[data-feed]')) {
      const max = list.closest('.hfeed') ? 4 : 7, out = [];
      rows.slice(0, max).forEach((r, k) => {
        if (!r.week && (k === 0 || rows[k - 1].week)) { const s = document.createElement('li'); s.className = 'f-sep'; s.textContent = n ? 'Earlier' : 'Nothing public yet this week · latest'; out.push(s); }
        const li = document.createElement('li'), t = document.createElement('time'), a = document.createElement('a'), sp = document.createElement('span');
        t.dateTime = r.at; t.textContent = ago(r.at).replace(' ago', ''); t.title = new Date(r.at).toLocaleString();
        a.href = r.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.repo;
        sp.textContent = r.what;
        li.append(t, a, sp); out.push(li);
      });
      list.replaceChildren(...out);
    }
    for (const s of document.querySelectorAll('[data-feed-stamp]')) s.textContent = `GitHub API · ${clock(L.eventsAt)} · ${n} this week`;
  }
  document.addEventListener('jd:live', () => { renderFeed(); if (current >= 0) show(current, lastMark); if (three) three.jumbo({ mode: current >= 0 ? 'keep' : 'idle', live: JD.live && JD.live.up }); });

  /* ---------------- the 3D: loaded after the page is up, only on the stadium ---------------- */
  function boot() {
    if (three || loading || view() !== 'stage' || stage.classList.contains('flat')) return loading;
    const c = navigator.connection;
    if (c && c.saveData) { stage.classList.add('flat'); return null; }
    const canvas = $('.st-canvas');
    loading = import('./stage3d.js').then((m) => m.init({
      canvas, flags: FLAGS, tags, physics: T, light: phone.matches || (navigator.hardwareConcurrency || 8) <= 4,
      reduce: reduce.matches,
      onReady: () => stage.classList.add('live'),
      onLand: landed,
      onSpin: (on) => { busy = on; if (on) take.setAttribute('aria-busy', 'true'); },
      onLost: () => { stage.classList.remove('live'); stage.classList.add('flat'); three = null; },
    })).then((api) => { three = api; three.active(view() === 'stage'); if (current >= 0) show(current, lastMark); return api; })
      .catch(() => { stage.classList.add('flat'); });
    return loading;
  }
  const start = () => ('requestIdleCallback' in root ? requestIdleCallback(() => boot(), { timeout: 1200 }) : setTimeout(boot, 200));
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  addEventListener('pagehide', () => { if (three) three.active(false); });
  document.addEventListener('visibilitychange', () => { if (three) three.active(!document.hidden && view() === 'stage'); });

  // Read-only view for the headless page checks.
  JD.stage = {
    view, setView, pick, takeThrow,
    state: () => ({ view: view(), live: stage.classList.contains('live'), flat: stage.classList.contains('flat'), current: current >= 0 ? FLAGS[current].id : null, throws, busy, three: three ? three.state() : null }),
  };
})(this);
