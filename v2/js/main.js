// Page wiring: case-study tabs, inline embeds, the BLOX LIFE clip, the email
// address (assembled here so scrapers reading the HTML don't find it), deep
// links like #work/sector, and the / shortcut for the chat.
(function (root) {
  document.documentElement.classList.add('js');
  const JD = (root.JD = root.JD || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  JD.email = ['jdare354', 'gmail.com'].join('@');
  for (const a of document.querySelectorAll('[data-email]')) a.href = 'mailto:' + JD.email;

  /* ---- tabs: every attempt is in the HTML (readable without JS); JS shows one ---- */
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const panelOf = (t) => document.getElementById(t.getAttribute('aria-controls'));
  const vid = document.querySelector('#a-blox video');
  const vio = vid && new IntersectionObserver(([e]) => {
    if (e.isIntersecting) vid.play().catch(() => { /* autoplay refused: the poster stays */ });
    else vid.pause();
  }, { threshold: 0.35 });

  function show(tab) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelOf(t).classList.toggle('on', on);
    }
    const list = tab.parentElement;
    list.scrollTo({ left: tab.offsetLeft - list.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    if (vid) {
      if (panelOf(tab).contains(vid)) vio.observe(vid);
      else { vio.unobserve(vid); vid.pause(); }
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (n === null) return;
      e.preventDefault();
      const next = tabs[(n + tabs.length) % tabs.length];
      show(next); next.focus();
    });
  });
  show(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]);

  JD.openAttempt = (id, scroll) => {
    const t = tabs.find((x) => x.dataset.id === id);
    if (!t) return;
    show(t);
    if (scroll) document.getElementById('work').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  for (const a of document.querySelectorAll('a[data-open]')) {
    a.addEventListener('click', (e) => { e.preventDefault(); JD.openAttempt(a.dataset.open, true); });
  }

  /* ---- sound toggle for the BLOX LIFE clip ---- */
  const sound = document.querySelector('[data-sound]');
  if (vid && sound) {
    sound.addEventListener('click', () => {
      vid.muted = !vid.muted;
      sound.setAttribute('aria-pressed', String(!vid.muted));
      sound.textContent = vid.muted ? 'SOUND OFF' : 'SOUND ON';
      if (vid.paused) vid.play().catch(() => {});
    });
  }

  /* ---- inline embeds: the real, deployed apps, loaded only when asked for ---- */
  JD.embed = (id) => {
    const fig = document.querySelector(`[data-embed="${id}"]`);
    if (!fig) return;
    // On a phone the app gets the whole screen instead of a box inside this page.
    if (coarse) { window.open(fig.dataset.src, '_blank', 'noopener'); return; }
    JD.openAttempt(id, true);
    if (fig.querySelector('iframe')) return;
    const before = [...fig.childNodes], card = fig.closest('.attempt');
    const f = document.createElement('iframe');
    f.src = fig.dataset.src;
    f.title = fig.dataset.title;
    f.allow = 'autoplay; fullscreen; gamepad';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-pointer-lock allow-forms');
    const exit = document.createElement('button');
    exit.type = 'button'; exit.className = 'exit'; exit.textContent = '✕ CLOSE';
    exit.setAttribute('aria-label', 'Close ' + fig.dataset.title);
    exit.addEventListener('click', () => {
      fig.replaceChildren(...before);
      card.classList.remove('wide');
      fig.querySelector('[data-embed-btn]').focus();
    });
    fig.replaceChildren(f, exit);
    card.classList.add('wide');
    setTimeout(() => f.focus(), 400);
  };
  for (const b of document.querySelectorAll('[data-embed-btn]')) {
    if (coarse) b.textContent = '▶ OPEN IT ↗';
    b.addEventListener('click', () => JD.embed(b.closest('[data-embed]').dataset.embed));
  }

  /* ---- deep links and the chat shortcut ---- */
  const deep = location.hash.match(/^#work\/([a-z]+)$/);
  if (deep) JD.openAttempt(deep[1], true);
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key !== '/') return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (JD.openChat) JD.openChat();
  });
})(this);
