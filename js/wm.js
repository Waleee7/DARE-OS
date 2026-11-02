// The window manager. Every app is a <section class="win"> already in the HTML,
// readable without JavaScript. This file adds the title-bar controls, then opens,
// stacks, drags, resizes, minimizes and maximizes the windows, and tells anyone
// listening (the shell, the chat, the embeds) what changed.
(function (root) {
  const JD = (root.JD = root.JD || {});
  const desk = document.getElementById('desk');
  if (!desk) return;
  const PHONE = '(max-width: 759px), (pointer: coarse)';
  const phone = matchMedia(PHONE);
  const SVG = 'http://www.w3.org/2000/svg';
  const GLYPH = {
    min: [['g-min', 'M1.5 8.5h6']],
    max: [['g-max', 'M1 1.5h8v7H1zM1 2.5h8'], ['g-restore', 'M3 1h6v5.5M1 3.5h5.5V9H1zM1 4.5h5.5']],
    close: [['g-close', 'M1.5 1.5l7 7M8.5 1.5l-7 7']],
  };
  const wins = new Map();
  const subs = [];
  let topZ = 10, cascade = 0, activeId = null;
  const emit = (type, id) => { for (const f of subs) f(type, id); };

  const glyph = (kind) => {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 10 10'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    for (const [cls, d] of GLYPH[kind]) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('class', cls); p.setAttribute('d', d); s.appendChild(p); }
    return s;
  };
  const LABEL = { min: 'Minimize', max: 'Maximize', close: 'Close' };

  function init(el) {
    const id = el.dataset.app, head = el.querySelector('.wt'), t = head.querySelector('.wt-t');
    const s = { id, el, head, t, open: false, min: false, max: false, x: null, y: null, opener: null };
    [s.w, s.h] = (el.dataset.size || '720x520').split('x').map(Number);
    [s.minW, s.minH] = (el.dataset.min || '300x200').split('x').map(Number);
    el.tabIndex = -1;
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'wt-back'; back.dataset.wAct = 'close';
    const chev = document.createElementNS(SVG, 'svg'); chev.setAttribute('viewBox', '0 0 10 16'); chev.setAttribute('aria-hidden', 'true');
    const cp = document.createElementNS(SVG, 'path'); cp.setAttribute('d', 'M8 2L2 8l6 6'); chev.appendChild(cp);
    back.append(chev, document.createTextNode('Home'));
    const ic = document.createElement('span'); ic.className = 'wt-ic'; ic.dataset.icon = el.dataset.icon || 'app';
    const ctl = document.createElement('div'); ctl.className = 'wt-c';
    for (const k of ['min', 'max', 'close']) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.wAct = k; b.appendChild(glyph(k));
      ctl.appendChild(b);
    }
    head.prepend(back, ic);
    head.appendChild(ctl);
    const grip = document.createElement('span'); grip.className = 'wr'; grip.setAttribute('aria-hidden', 'true');
    el.appendChild(grip);
    wins.set(id, s);
    relabel(s);

    el.addEventListener('pointerdown', () => focus(id, false), true);
    el.addEventListener('focusin', () => focus(id, false));
    head.addEventListener('click', (e) => {
      const b = e.target.closest('[data-w-act]');
      if (!b) return;
      const act = b.dataset.wAct;
      if (act === 'close') close(id); else if (act === 'min') minimize(id); else maximize(id);
    });
    head.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) maximize(id); });
    head.addEventListener('pointerdown', (e) => drag(e, s));
    grip.addEventListener('pointerdown', (e) => resize(e, s));
  }
  // Control labels name the window ("Close README") so a screen reader knows which one.
  function relabel(s) {
    const name = s.t.textContent.trim();
    for (const b of s.head.querySelectorAll('.wt-c [data-w-act]')) {
      const k = b.dataset.wAct, label = k === 'max' && s.max ? 'Restore' : LABEL[k];
      b.setAttribute('aria-label', `${label} ${name}`);
      b.title = label;
    }
    s.head.querySelector('.wt-back').setAttribute('aria-label', `Back to the home screen from ${name}`);
  }

  /* ---- geometry: positions are relative to the desktop area ---- */
  const area = () => ({ w: desk.clientWidth, h: desk.clientHeight });
  const gutter = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  function place(s) {
    const A = area(), w = Math.min(s.w, A.w - 16), h = Math.min(s.h, A.h - 16);
    const gl = gutter('--gl'), gr = gutter('--gr');
    const pos = s.el.dataset.pos;
    if (pos === 'left') { s.x = gl; s.y = 18; }
    else if (pos === 'right') { s.x = A.w - gr - w; s.y = 18; }
    else if (pos === 'center') { s.x = (A.w - w) / 2; s.y = Math.max(12, (A.h - h) * 0.4); }
    else { const k = cascade++ % 7; s.x = gl + 70 + k * 32; s.y = 26 + k * 28; }
  }
  function clamp(s, strict) {
    const A = area();
    s.cw = Math.max(Math.min(s.minW, A.w - 8), Math.min(s.w, A.w - 8));
    s.ch = Math.max(Math.min(s.minH, A.h - 8), Math.min(s.h, A.h - 8));
    if (strict) { s.x = Math.min(Math.max(0, s.x), A.w - s.cw); s.y = Math.min(Math.max(0, s.y), A.h - s.ch); }
    else { s.x = Math.min(Math.max(100 - s.cw, s.x), A.w - 100); s.y = Math.min(Math.max(0, s.y), A.h - 40); }
  }
  function apply(s) {
    const st = s.el.style;
    st.left = Math.round(s.x) + 'px'; st.top = Math.round(s.y) + 'px';
    st.width = Math.round(s.cw) + 'px'; st.height = Math.round(s.ch) + 'px';
  }
  function refit() { for (const s of wins.values()) if (s.open && s.x != null) { clamp(s, true); apply(s); } }

  /* ---- open, focus, close ---- */
  function open(id, o = {}) {
    const s = wins.get(id);
    if (!s) return null;
    if (!s.open) {
      s.open = true; s.min = false;
      s.opener = o.opener || document.activeElement;
      if (s.x == null) place(s);
      clamp(s, true); apply(s);
      s.el.classList.add('open'); s.el.classList.remove('min');
      emit('open', id);
    } else if (s.min) {
      s.min = false; s.el.classList.remove('min');
      emit('restore', id);
    }
    focus(id, o.focus !== false, true);
    return s.el;
  }
  function focus(id, move = true, force = false) {
    const s = wins.get(id);
    if (!s || !s.open) return;
    if (s.min) { s.min = false; s.el.classList.remove('min'); emit('restore', id); }
    if (activeId !== id || force) {
      if (s.el.style.zIndex !== String(topZ)) s.el.style.zIndex = String(++topZ);
      activeId = id;
      for (const w of wins.values()) w.el.classList.toggle('active', w === s);
      emit('focus', id);
    }
    if (move && !s.el.contains(document.activeElement)) s.el.focus({ preventScroll: true });
  }
  const visible = (n) => n && document.contains(n) && n.getClientRects().length > 0;
  function topmost(except) {
    let best = null;
    for (const s of wins.values()) if (s.open && !s.min && s.id !== except && (!best || +s.el.style.zIndex > +best.el.style.zIndex)) best = s;
    return best;
  }
  function settle(s, hadFocus) {
    if (activeId === s.id) activeId = null;
    s.el.classList.remove('active');
    const next = topmost(s.id);
    if (next) focus(next.id, false);
    if (!hadFocus) return;
    if (visible(s.opener) && !s.el.contains(s.opener)) s.opener.focus({ preventScroll: true });
    else if (next) next.el.focus({ preventScroll: true });
    else desk.focus({ preventScroll: true });
  }
  function close(id) {
    const s = wins.get(id);
    if (!s || !s.open) return;
    const hadFocus = s.el.contains(document.activeElement);
    s.open = false; s.min = false;
    s.el.classList.remove('open', 'min');
    if (s.max) { s.max = false; s.el.classList.remove('max'); relabel(s); }
    emit('close', id);
    settle(s, hadFocus);
  }
  function minimize(id) {
    const s = wins.get(id);
    if (!s || !s.open || s.min) return;
    const hadFocus = s.el.contains(document.activeElement);
    s.min = true; s.el.classList.add('min');
    emit('min', id);
    settle(s, hadFocus);
  }
  function maximize(id, on) {
    const s = wins.get(id);
    if (!s || !s.open) return;
    const want = on === undefined ? !s.max : !!on;
    if (want === s.max) return;
    s.max = want; s.el.classList.toggle('max', want);
    relabel(s);
    emit('max', id);
  }

  /* ---- drag by the title bar, resize from the corner ---- */
  function track(e, target, onMove, s) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    try { target.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    s.el.classList.add('dragging');
    const move = (ev) => { onMove(ev.clientX - sx, ev.clientY - sy); apply(s); };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      s.el.classList.remove('dragging');
      emit('move', s.id);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }
  function drag(e, s) {
    if (e.button || phone.matches || s.max || e.target.closest('button, a, input')) return;
    const x0 = s.x, y0 = s.y;
    track(e, s.head, (dx, dy) => { s.x = x0 + dx; s.y = y0 + dy; clamp(s, false); }, s);
  }
  function resize(e, s) {
    if (e.button || phone.matches || s.max) return;
    const w0 = s.cw, h0 = s.ch;
    track(e, e.currentTarget, (dx, dy) => {
      const A = area();
      s.w = Math.max(s.minW, Math.min(w0 + dx, A.w - s.x));
      s.h = Math.max(s.minH, Math.min(h0 + dy, A.h - s.y));
      s.cw = s.w; s.ch = s.h;
    }, s);
  }

  // Esc closes the window that has focus (the chat included).
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const w = e.target.closest && e.target.closest('.win.open');
    if (!w) return;
    e.preventDefault();
    close(w.dataset.app);
  });
  addEventListener('resize', refit);
  phone.addEventListener('change', () => { refit(); emit('mode', null); });

  for (const el of desk.querySelectorAll('.win[data-app]')) init(el);

  const snap = (s) => s && { id: s.id, title: s.t.textContent.trim(), icon: s.el.dataset.icon || 'app', open: s.open, min: s.min, max: s.max, active: s.id === activeId, z: +s.el.style.zIndex || 0 };
  JD.wm = {
    open, close, focus, minimize, maximize, refit,
    has: (id) => wins.has(id),
    isOpen: (id) => !!(wins.get(id) && wins.get(id).open),
    state: (id) => snap(wins.get(id)),
    list: () => [...wins.values()].filter((s) => s.open).sort((a, b) => a.order - b.order).map(snap),
    all: () => [...wins.keys()],
    active: () => activeId,
    title: (id) => (wins.get(id) ? wins.get(id).t.textContent.trim() : id),
    setTitle(id, text) { const s = wins.get(id); if (s && s.t.textContent !== text) { s.t.textContent = text; relabel(s); } },
    on: (fn) => { subs.push(fn); },
    phone: () => phone.matches,
  };
  // open order, for the taskbar
  let n = 0;
  subs.push((type, id) => { if (type === 'open') wins.get(id).order = ++n; });
})(this);
