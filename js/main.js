// Page wiring: project windows, the inline embeds, the BLOX LIFE clip and the email
// address (assembled here so scrapers reading the HTML don't find it).
(function (root) {
  const JD = (root.JD = root.JD || {}), wm = JD.wm;
  const coarse = matchMedia('(pointer: coarse)').matches;

  JD.email = ['jdare354', 'gmail.com'].join('@');
  for (const a of document.querySelectorAll('[data-email]')) a.href = 'mailto:' + JD.email;

  /* ---- projects open in their own windows ---- */
  JD.openAttempt = (id) => {
    if (!wm || !wm.has('p-' + id)) return;
    wm.open('p-' + id);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-project], a[data-open]');
    if (!b) return;
    e.preventDefault();
    JD.openAttempt(b.dataset.project || b.dataset.open);
  });

  /* ---- the BLOX LIFE clip plays only while its window is on screen ---- */
  const vid = document.querySelector('#w-p-blox video');
  if (vid) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) vid.play().catch(() => { /* autoplay refused: the poster stays */ });
      else vid.pause();
    }, { threshold: 0.35 }).observe(vid);
    const sound = document.querySelector('[data-sound]');
    sound.addEventListener('click', () => {
      vid.muted = !vid.muted;
      sound.setAttribute('aria-pressed', String(!vid.muted));
      sound.textContent = vid.muted ? 'SOUND OFF' : 'SOUND ON';
      if (vid.paused) vid.play().catch(() => {});
    });
    if (wm) wm.on((type, id) => { if (id === 'p-blox' && (type === 'close' || type === 'min')) vid.pause(); });
  }

  /* ---- inline embeds: the real, deployed apps, loaded only when asked for ---- */
  const teardown = new Map();
  JD.embed = (id) => {
    const fig = document.querySelector(`[data-embed="${id}"]`);
    if (!fig) return;
    // On a phone the app gets the whole screen instead of a box inside a window.
    if (coarse) { window.open(fig.dataset.src, '_blank', 'noopener'); return; }
    const win = fig.closest('.win').dataset.app;
    wm.open(win);
    if (fig.querySelector('iframe')) return;
    const before = [...fig.childNodes], body = fig.closest('.case'), wasMax = wm.state(win).max;
    const f = document.createElement('iframe');
    f.src = fig.dataset.src;
    f.title = fig.dataset.title;
    f.allow = 'autoplay; fullscreen; gamepad';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-pointer-lock allow-forms');
    const exit = document.createElement('button');
    exit.type = 'button'; exit.className = 'exit'; exit.textContent = '✕ CLOSE APP';
    exit.setAttribute('aria-label', 'Close ' + fig.dataset.title);
    const undo = (refocus) => {
      teardown.delete(win);
      fig.replaceChildren(...before);
      body.classList.remove('wide');
      if (!wasMax) wm.maximize(win, false);
      if (refocus) fig.querySelector('[data-embed-btn]').focus();
    };
    exit.addEventListener('click', () => undo(true));
    fig.replaceChildren(f, exit);
    body.classList.add('wide');
    wm.maximize(win, true);
    teardown.set(win, undo);
    body.scrollTop = 0;
    setTimeout(() => f.focus(), 400);
  };
  for (const b of document.querySelectorAll('[data-embed-btn]')) {
    if (coarse) b.textContent = '▶ OPEN IT ↗';
    b.addEventListener('click', () => JD.embed(b.closest('[data-embed]').dataset.embed));
  }
  // Closing the window stops the app inside it.
  if (wm) wm.on((type, id) => { if (type === 'close' && teardown.has(id)) teardown.get(id)(false); });
})(this);
