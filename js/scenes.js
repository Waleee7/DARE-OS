// CINEMA, the DOM side: which view is showing (the film, the desktop, the clean résumé),
// the five scenes and the shot list that moves between them (chips, arrow keys, number
// keys, scroll past the dolly, swipe on phones), the sector's plaque and marks, the live
// board, the email menus, the bounded free look, and loading the 3D (js/cinema3d.js)
// after the page is up. Without WebGL the poster stays and every scene still works.
(function (root) {
  const JD = (root.JD = root.JD || {});
  const html = document.documentElement, cine = document.getElementById('stage');
  if (!cine || !JD.board) return;
  const wm = JD.wm, FLAGS = JD.board.flags, N = FLAGS.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 759px), (pointer: coarse)');
  const split = matchMedia('(max-width: 759px), (max-aspect-ratio: 4/5)');   // the picture above the words
  const $ = (s, el = cine) => el.querySelector(s);
  const $$ = (s, el = cine) => [...el.querySelectorAll(s)];
  const store = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } return null; };
  const SCENES = ['the-circle', 'the-sector', 'the-board', 'the-press-box', 'the-tunnel'];
  const NAMES = ['The Circle', 'The Sector', 'The Board', 'The Press Box', 'The Tunnel'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const say = $('[data-say]');

  /* ---------------- views: the film, the desktop, the clean look ---------------- */
  let three = null, loading = null;
  const view = () => html.dataset.view;
  const filmUrl = () => location.pathname + (scene ? '#' + SCENES[scene] : '');
  function setView(v, o = {}) {
    if (!['stage', 'os', 'clean'].includes(v) || v === view()) return;
    const from = view(), go = () => {
      html.dataset.view = v;
      cine.classList.remove('leaving');
      if (v !== 'clean') store('jd-view', v);
      if (!o.keepUrl) history.replaceState(null, '', v === 'clean' ? '?view=clean' : v === 'os' ? location.pathname + (/^#(app|work)\//.test(location.hash) ? location.hash : '') : filmUrl());
      if (three) three.active(v === 'stage' && !document.hidden);
      if (v === 'stage') { boot(); setTimeout(() => { const c = $('[aria-current="step"]'); if (c) c.focus({ preventScroll: true }); }, 30); }
      if (v === 'os' && wm && !o.quiet && !wm.phone() && !wm.list().length) wm.open('readme', { focus: false });
      if (v === 'os' && !o.quiet) setTimeout(() => document.getElementById('desk').focus({ preventScroll: true }), 30);
      if (v === 'clean') { scrollTo(0, 0); setTimeout(() => document.getElementById('cl-h').focus({ preventScroll: true }), 30); }
      overlay();
      document.dispatchEvent(new CustomEvent('jd:view', { detail: { view: v, from } }));
    };
    if (from === 'stage' && v !== 'stage' && !reduce.matches && !o.quiet) { cine.classList.add('leaving'); setTimeout(go, 320); } else go();
  }
  document.getElementById('cl-h').tabIndex = -1;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-view-go]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setView(a.dataset.viewGo);
  });
  for (const b of document.querySelectorAll('[data-print]')) b.addEventListener('click', () => print());
  for (const a of document.querySelectorAll('[data-email-text]')) if (JD.email) a.textContent = JD.email;

  // Windows (the Ask chat, a case study, the game) open over the film instead of leaving it:
  // the chat as a side drawer, anything else as a sheet with the film dimmed behind it.
  function overlay() {
    const open = wm ? wm.list().filter((w) => !w.min) : [];
    const kind = view() !== 'stage' || !open.length ? null : open.some((w) => w.id !== 'ask') ? 'sheet' : 'ask';
    if (kind) html.dataset.over = kind; else delete html.dataset.over;
  }
  if (wm) wm.on((type) => { if (type === 'open' && view() === 'clean') setView('os', { quiet: true }); overlay(); });

  /* ---------------- email: one button, three subjects (the circle and the tunnel) ---------------- */
  const SUBJECT = { work: 'Software engineering role', contract: 'Contract build', question: 'Question from your portfolio' };
  for (const box of $$('.mail')) {
    const btn = box.querySelector('[data-mail-btn]'), menu = box.querySelector('.mail-menu');
    for (const a of menu.querySelectorAll('[data-mail]')) a.href = `mailto:${JD.email}?subject=${encodeURIComponent(SUBJECT[a.dataset.mail])}`;
    const open = (on, refocus) => {
      menu.hidden = !on; btn.setAttribute('aria-expanded', String(on));
      if (on) menu.querySelector('a').focus(); else if (refocus) btn.focus();
    };
    btn.addEventListener('click', () => open(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(() => open(false), 0); });
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('a')], i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); open(false, true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    });
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !box.contains(e.target)) open(false); });
    box.addEventListener('focusout', (e) => { if (!menu.hidden && !(e.relatedTarget && box.contains(e.relatedTarget))) open(false); });
  }

  /* ---------------- live numbers (filled by js/live.js) ---------------- */
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
  function numbers(f) {
    const { probe } = liveFor(f);
    if (f.big === 'LIVE') return probe && probe.ok ? { big: String(probe.ms), unit: 'ms', what: `to answer your browser just now · ${f.what}` } : { big: 'LIVE', unit: '', what: f.what, word: true };
    if (f.wip && f.big === 'SOON') return { big: 'IN PROGRESS', unit: '', what: f.what, word: true };
    return { big: f.big, unit: f.unit, what: f.what };
  }

  /* ---------------- 02 THE SECTOR: the plaque, the marks ---------------- */
  const PL = {};
  for (const n of $$('[data-p]')) PL[n.dataset.p] = n;
  const openBtn = $('[data-open-case]'), list = $('[data-marks]'), allBtn = $('[data-all-marks]');
  let cur = 0, sectorSeen = false;
  function renderPlaque() {
    const f = FLAGS[cur], n = numbers(f), live = liveFor(f);
    PL.cat.textContent = `Mark ${pad2(cur + 1)} of ${N} · ${f.cat}`;
    PL.name.textContent = f.name;
    PL.big.textContent = n.big; PL.big.classList.toggle('word', !!n.word);
    PL.unit.textContent = n.unit;
    PL.what.textContent = n.what;
    PL.how.textContent = f.how + (f.wip && f.big !== 'SOON' ? ` ${f.wip}.` : '');
    PL.when.textContent = f.when;
    PL.live.hidden = !live.text; PL.live.textContent = live.text;
    openBtn.hidden = !f.open || !(wm && wm.has(f.open));
    for (const b of list.querySelectorAll('[data-mark]')) b.setAttribute('aria-current', String(+b.dataset.mark === cur));
  }
  function pick(i, o = {}) {
    cur = (i + N) % N;
    renderPlaque();
    if (three && scene === 1) three.mark(cur, o);
    if (o.say !== false) say.textContent = `Mark ${cur + 1} of ${N}: ${FLAGS[cur].name}, ${PL.big.textContent} ${PL.unit.textContent} ${PL.what.textContent}.`;
  }
  list.replaceChildren(...FLAGS.map((f, i) => {
    const li = document.createElement('li'), b = document.createElement('button'), num = document.createElement('i'), val = document.createElement('span');
    b.type = 'button'; b.dataset.mark = String(i);
    num.textContent = pad2(i + 1);
    val.textContent = f.big === 'LIVE' ? 'live' : f.big === 'SOON' ? 'in progress' : `${f.big} ${f.unit}`.trim();
    b.append(num, document.createTextNode(f.name), val);
    b.addEventListener('click', () => { pick(i); marksOpen(false, true); });
    li.appendChild(b);
    return li;
  }));
  function marksOpen(on, refocus) {
    list.hidden = !on; allBtn.setAttribute('aria-expanded', String(on));
    if (on) list.querySelector(`[data-mark="${cur}"]`).focus(); else if (refocus) allBtn.focus();
  }
  allBtn.addEventListener('click', () => marksOpen(list.hidden));
  list.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); marksOpen(false, true); }
    else if (step) { e.preventDefault(); items[(i + step + items.length) % items.length].focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!list.hidden && !e.target.closest('[data-marks], [data-all-marks]')) marksOpen(false); });
  for (const b of $$('[data-step]')) b.addEventListener('click', () => pick(cur + +b.dataset.step));
  openBtn.addEventListener('click', () => {
    const f = FLAGS[cur];
    if (!f.open) return;
    if (f.open === 'circle' && JD.focusThrow) JD.focusThrow(openBtn); else wm.open(f.open, { opener: openBtn });
  });

  /* ---------------- 03 THE BOARD: the live numbers, one at a time on the scoreboard ---------------- */
  const rowsBox = $('[data-rows]');
  let rows = [], rowK = 0, rowHold = false, rowTimer = 0;
  function boardRows() {
    const L = JD.live || {}, gh = L.gh, push = gh && gh.push;
    const pushAgo = push ? ago(push.at).split(' ') : null;
    const week = L.events ? feed(L.events).filter((r) => r.week).length : 0;
    return [
      { label: 'Live now', big: L.up != null ? `${L.up}/${L.total}` : '11/11', unit: '', what: 'products answering your browser', src: L.probedAt ? `Probed from your browser at ${clock(L.probedAt)} · median ${L.median} ms` : 'Probed from your browser as the page loads', live: L.up != null },
      { label: 'Tests', big: '918', unit: '', what: 'passing across 8 projects', src: 'Re-run from each public repo · 15 Nov 2026' },
      { label: 'Precision', big: '3.9', unit: 'cm', what: 'off on a 68 m reference throw', src: 'SECTOR accuracy harness · 15 Nov 2026' },
      { label: 'Frame time', big: '8.3', unit: 'ms', what: 'with 12 ragdolls on screen', src: 'RAGDOLL RIOT, M3 Pro, 475 frames · 15 Nov 2026' },
      { label: 'Clients', big: '2', unit: 'live', what: 'one taking cards on live Stripe', src: "D'extensionz · CleanBins Tuscaloosa" },
      { label: 'Open source', big: gh ? String(gh.repos) : '17', unit: 'repos', what: gh ? `public on GitHub · ${gh.stars} stars` : 'public on GitHub', src: gh ? `GitHub API at ${clock(gh.at)}` : 'GitHub · snapshot 15 Nov 2026', live: !!gh },
      { label: 'Last push', big: pushAgo ? pushAgo[0] : '15', unit: pushAgo ? pushAgo.slice(1).join(' ') : 'Nov', what: (push ? push.repo : 'peach-dash') + (week ? ` · ${week} public update${week === 1 ? '' : 's'} this week` : ''), src: push ? `GitHub API · ${new Date(push.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'GitHub · snapshot 15 Nov 2026', live: !!push },
    ];
  }
  function renderBoard() {
    rows = boardRows();
    rowsBox.replaceChildren(...rows.map((r, k) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.dataset.row = String(k); b.setAttribute('aria-pressed', String(k === rowK));
      const l = document.createElement('span'); l.className = 'b-l'; l.textContent = r.label;
      if (r.live) { const d = document.createElement('i'); d.className = 'ldot'; d.setAttribute('aria-hidden', 'true'); l.prepend(d); }
      const v = document.createElement('span'); v.className = 'b-v';
      const big = document.createElement('b'); big.textContent = r.big; v.append(big);
      if (r.unit) { const u = document.createElement('small'); u.textContent = r.unit; v.append(' ', u); }
      const w = document.createElement('span'); w.className = 'b-w'; w.textContent = ` ${r.what}.`;
      const s = document.createElement('span'); s.className = 'b-s'; s.textContent = ` ${r.src}.`;
      b.append(l, v, w, s);
      b.addEventListener('click', () => { rowK = k; boardFocus(); });
      li.appendChild(b);
      return li;
    }));
    boardFocus(true);
  }
  const capWhat = $('[data-cap-what]'), capSrc = $('[data-cap-src]');
  function boardFocus(quiet) {
    for (const b of rowsBox.querySelectorAll('[data-row]')) b.setAttribute('aria-pressed', String(+b.dataset.row === rowK));
    const r = rows[rowK];
    if (r) { capWhat.textContent = r.what; capSrc.textContent = r.src; }
    if (three) three.board({ rows, k: rowK });
    if (!quiet) restartCycle();
  }
  function restartCycle() {
    clearInterval(rowTimer);
    if (scene !== 2 || reduce.matches || view() !== 'stage') return;
    rowTimer = setInterval(() => { if (!rowHold && !document.hidden) { rowK = (rowK + 1) % rows.length; boardFocus(true); } }, 3600);
  }
  rowsBox.addEventListener('pointerenter', () => { rowHold = true; });
  rowsBox.addEventListener('pointerleave', () => { rowHold = false; });
  rowsBox.addEventListener('focusin', () => { rowHold = true; });
  rowsBox.addEventListener('focusout', () => { rowHold = false; });

  /* ---------------- shipped this week (the board, and the phone home screen) ---------------- */
  const ACT = { PushEvent: 'Pushed to', CreateEvent: 'Created', PublicEvent: 'Made public', ReleaseEvent: 'Released' };
  function feed(events) {
    const week = Date.now() - 7 * 864e5, out = [], seen = new Set();
    for (const e of events) {
      if (!ACT[e.type] || e.repo.name === 'Waleee7/Waleee7') continue;
      if (e.type === 'CreateEvent' && e.payload.ref_type === 'tag') continue;
      const repo = e.repo.name.split('/')[1], key = repo + e.created_at.slice(0, 10);
      if (seen.has(key)) continue;
      seen.add(key);
      const p = e.payload || {};
      const what = e.type === 'PushEvent' ? `Pushed to ${(p.ref || '').replace('refs/heads/', '')}` : e.type === 'CreateEvent' ? (p.ref_type === 'repository' ? 'New repo' : `New branch ${p.ref || ''}`) : ACT[e.type];
      const href = e.type === 'PushEvent' && p.head ? `https://github.com/${e.repo.name}/commit/${p.head}` : `https://github.com/${e.repo.name}`;
      out.push({ at: e.created_at, repo, what, href, week: Date.parse(e.created_at) >= week });
      if (out.length >= 8) break;
    }
    return out;
  }
  function renderFeed() {
    const L = JD.live;
    if (!L || !L.events) return;
    const all = feed(L.events), n = all.filter((r) => r.week).length;
    for (const ol of document.querySelectorAll('[data-feed]')) {
      const max = +ol.dataset.max || 4, items = [];
      all.slice(0, max).forEach((r) => {
        const li = document.createElement('li'), t = document.createElement('time'), a = document.createElement('a'), sp = document.createElement('span');
        t.dateTime = r.at; t.textContent = ago(r.at).replace(' ago', ''); t.title = new Date(r.at).toLocaleString();
        a.href = r.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.repo;
        sp.textContent = r.what;
        li.append(t, a, sp); items.push(li);
      });
      ol.replaceChildren(...items);
    }
    for (const s of document.querySelectorAll('[data-feed-stamp]')) s.textContent = `GitHub API · ${clock(L.eventsAt)} · ${n} this week`;
  }
  document.addEventListener('jd:live', () => { renderFeed(); renderPlaque(); renderBoard(); });

  /* ---------------- the shot list ---------------- */
  const panels = $$('.scene'), nav = $$('[data-go]'), count = $('[data-count-now]'), nextBtn = $('[data-next]'), prevBtn = $('[data-prev]');
  let scene = Math.max(0, Math.min(4, +html.dataset.shot || 0));
  const sectorArgs = () => { const first = !sectorSeen && !reduce.matches; sectorSeen = true; return { mark: cur, delay: first ? 5600 : 0 }; };
  function chrome() {
    for (const a of nav) { if (+a.dataset.go === scene && a.closest('.cine-shots')) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); }
    count.textContent = pad2(scene + 1);
    prevBtn.disabled = scene === 0;
    // the last scene offers the way back to the first instead of a dead "next"
    nextBtn.firstChild.nodeValue = scene < 4 ? 'Next: ' : 'Back to: ';
    nextBtn.querySelector('span').textContent = NAMES[scene < 4 ? scene + 1 : 0];
  }
  function show(i, o = {}) {
    i = Math.max(0, Math.min(SCENES.length - 1, i));
    if (i === scene && !o.force) return;
    const prev = scene, old = panels[prev], nu = panels[i];
    scene = i; html.dataset.shot = String(i);
    const hadFocus = old && old.contains(document.activeElement);
    if (old && old !== nu && !reduce.matches) { old.classList.remove('enter'); old.classList.add('leaving'); setTimeout(() => old.classList.remove('leaving'), 280); }
    nu.classList.remove('enter'); void nu.offsetWidth; if (!reduce.matches) nu.classList.add('enter');
    nu.scrollTop = 0;
    chrome();
    if (hadFocus) setTimeout(() => nu.querySelector('.slate').focus({ preventScroll: true }), reduce.matches ? 0 : 280);
    if (view() === 'stage') history.replaceState(null, '', filmUrl());
    say.textContent = `Scene ${i + 1} of 5: ${NAMES[i]}.`;
    if (!list.hidden) marksOpen(false);
    if (three) three.go(i, i === 1 ? sectorArgs() : {});
    else if (i === 1) sectorSeen = sectorSeen || !!three;
    restartCycle();
  }
  for (const a of nav) a.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); show(+a.dataset.go); });
  nextBtn.addEventListener('click', () => show(scene < 4 ? scene + 1 : 0));
  prevBtn.addEventListener('click', () => show(scene - 1));
  addEventListener('hashchange', () => { const k = SCENES.indexOf(location.hash.slice(1)); if (k >= 0) { if (view() !== 'stage') setView('stage', { keepUrl: true }); show(k); } });
  for (const p of panels) { const s = p.querySelector('.slate'); if (s) s.tabIndex = -1; }

  // keys: ← → PageUp PageDown Home End and 1–5 change scenes; W A S D and ↑ ↓ nudge the camera
  const NUDGE = { w: [0, 0, 130], s: [0, 0, -130], a: [-0.62, 0, 0], d: [0.62, 0, 0], ArrowUp: [0, -0.4, 0], ArrowDown: [0, 0.4, 0] };
  addEventListener('keydown', (e) => {
    if (view() !== 'stage' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], .win, .mail-menu, [data-marks]')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); show(scene + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); show(scene - 1); }
    else if (k === 'Home' || k === 'End') { e.preventDefault(); show(k === 'Home' ? 0 : 4); }
    else if (/^[1-5]$/.test(k)) { e.preventDefault(); show(+k - 1); }
    else {
      const n = NUDGE[k.length === 1 ? k.toLowerCase() : k];
      if (n && three) { e.preventDefault(); three.nudge(n[0], n[1], n[2]); }
    }
  });

  // scroll pushes the camera in (or pulls it out); keep scrolling past the end and the next scene starts
  let over = 0, overAt = 0, lockUntil = 0;
  cine.addEventListener('wheel', (e) => {
    if (view() !== 'stage' || e.target.closest('[data-marks], .win, .mail-menu')) return;
    const box = e.target.closest('.scene');
    if (box && box.scrollHeight > box.clientHeight + 2) return;   // a long panel on a short screen scrolls itself
    e.preventDefault();
    const now = performance.now();
    if (now < lockUntil) return;
    const dy = (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * (e.ctrlKey ? -3 : 1);
    if (now - overAt > 500) over = 0;
    overAt = now;
    over += three ? three.wheel(dy) : dy;
    if (Math.abs(over) > 260) { const d = Math.sign(over); over = 0; lockUntil = now + 1200; show(scene + d); }
  }, { passive: false });

  // drag to look (it springs back), pinch to dolly, a quick swipe changes the scene on touch
  const frame = $('.cine-frame'), ptrs = new Map();
  let drag = null, pinch = null;
  const gap = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  function down(e) {
    if (e.button || view() !== 'stage') return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.currentTarget === frame) { try { frame.setPointerCapture(e.pointerId); } catch { /* synthetic */ } }
    if (ptrs.size === 1) drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, look: e.currentTarget === frame };
    else if (ptrs.size === 2 && e.currentTarget === frame) { pinch = gap(); drag = null; }
  }
  function move(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch != null && ptrs.size >= 2) { const g = gap(); if (three) three.wheel((g - pinch) * 3); pinch = g; return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.look && three) three.drag(-dx, -dy);
  }
  function up(e) {
    if (!ptrs.delete(e.pointerId)) return;
    if (pinch != null) { if (ptrs.size < 2) { pinch = null; if (three) three.release(); } return; }
    if (!drag) return;
    const d = drag; drag = null;
    if (three) three.release();
    if (e.type === 'pointercancel') return;
    const dt = performance.now() - d.t0, dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (e.pointerType !== 'mouse' && dt < 500 && Math.abs(dx) > 50 && Math.abs(dx) > 1.4 * Math.abs(dy)) show(scene + (dx < 0 ? 1 : -1));
    else if (d.look && d.moved < 8 && dt < 600 && scene === 1 && three) {
      const r = frame.getBoundingClientRect(), i = three.pickAt(e.clientX - r.left, e.clientY - r.top);
      if (i >= 0) pick(i);
    }
  }
  for (const el of [frame, $('.cine-panels')]) {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  frame.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- the 3D: after the page is up (or the first touch), only on the film ---------------- */
  function boot() {
    if (three || loading || view() !== 'stage' || cine.classList.contains('flat')) return loading;
    const c = navigator.connection;
    if (c && c.saveData) { cine.classList.add('flat'); return null; }
    loading = import('./cinema3d.js').then((m) => m.init({
      canvas: $('.cine-canvas'), marks: FLAGS, physics: root.Throw, reduce: reduce.matches, split: () => split.matches,
      light: phone.matches || (navigator.hardwareConcurrency || 8) <= 4,
      onReady: () => {
        cine.classList.add('live');
        if (!/[?&]still\b/.test(location.search)) setTimeout(() => { if (three) three.go(scene, scene === 1 ? sectorArgs() : {}); }, reduce.matches ? 0 : 420);
      },
      onLost: () => { cine.classList.remove('live'); cine.classList.add('flat'); three = null; },
    })).then((api) => {
      three = api;
      three.board({ rows, k: rowK });
      three.active(view() === 'stage' && !document.hidden);
      setInterval(() => { if (three && view() === 'stage' && !document.hidden) three.tick(); }, 30000);
      return api;
    }).catch(() => { cine.classList.add('flat'); });
    return loading;
  }
  // The poster is the first picture (and the LCP): the 3D waits until the first paint has been
  // presented and the poster has loaded, then two more frames (so the poster is on screen), then idle time.
  const idle = () => ('requestIdleCallback' in root ? requestIdleCallback(() => boot(), { timeout: 2000 }) : setTimeout(boot, 300));
  function start() {
    const img = $('.cine-poster img');
    const painted = new Promise((res) => {
      let po = null;
      try {
        if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
          po = new PerformanceObserver((l) => { if (l.getEntries().some((e) => e.name === 'first-contentful-paint')) { po.disconnect(); res(); } });
          po.observe({ type: 'paint', buffered: true });
        }
      } catch { po = null; }
      if (!po) res();
    });
    const loaded = !img || img.complete ? null : new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
    Promise.all([painted, loaded]).then(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(idle, 0))));
  }
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { if (document.readyState === 'complete') boot(); }, { once: true, passive: true });
  addEventListener('pagehide', () => { if (three) three.active(false); });
  document.addEventListener('visibilitychange', () => { if (three) three.active(!document.hidden && view() === 'stage'); });

  renderPlaque(); renderBoard(); chrome();
  panels[scene].classList.add('enter');
  // the view this visit started in counts as entered (a ?theme= or #app/ link opens the desktop),
  // so a reload after the URL is tidied stays where the visitor was
  if (view() !== 'clean') store('jd-view', view());

  // Read-only view for the headless page checks.
  JD.cine = {
    view, setView, show, pick, scenes: SCENES,
    state: () => ({ view: view(), scene, name: SCENES[scene], live: cine.classList.contains('live'), flat: cine.classList.contains('flat'), mark: FLAGS[cur].id, row: rowK, over: html.dataset.over || null, three: three ? three.state() : null }),
  };
})(this);
