// The desktop around the windows: icons, the taskbar or the menu bar and dock,
// the Start menu, the clock, the four themes, the phone home screen and deep links.
// Every launcher is built from one list of apps, so they can't drift apart.
(function (root) {
  const JD = root.JD, wm = JD && JD.wm;
  if (!wm) return;
  const html = document.documentElement;

  const THEMES = {
    retro98: { name: 'Retro 98', chrome: 'win', color: '#008080' },
    throws: { name: 'Throws Night', chrome: 'mac', color: '#0a0d14' },
    mac: { name: 'Mac Light', chrome: 'mac', color: '#e9eef5' },
    win11: { name: 'Windows 11', chrome: 'win', color: '#0b3080' },
  };
  const APPS = [
    { id: 'readme', icon: 'doc', name: 'README', retro98: 'README.TXT' },
    { id: 'projects', icon: 'folder', name: 'Projects', retro98: 'My Projects' },
    { id: 'circle', icon: 'discus', name: 'The Circle' },
    { id: 'ask', icon: 'chat', name: 'Ask Josh' },
    { id: 'athlete', icon: 'medal', name: 'Athlete' },
    { id: 'contact', icon: 'mail', name: 'Contact' },
    { id: 'terminal', icon: 'term', name: 'Terminal', retro98: 'MS-DOS Prompt', win11: 'Terminal' },
    { id: 'settings', icon: 'gear', name: 'Settings', retro98: 'Display' },
    { id: 'bin', icon: 'bin', name: 'Recycle Bin', mac: 'Trash', throws: 'Trash' },
  ];
  // Window titles where a theme names things its own way.
  const TITLES = {
    readme: { retro98: 'README.TXT - Notepad' },
    projects: { retro98: 'C:\\Josh\\Projects', win11: 'Projects - File Explorer', mac: 'Projects', throws: 'Projects' },
    terminal: { retro98: 'MS-DOS Prompt', win11: 'Windows PowerShell', mac: 'josh — zsh', throws: 'josh — zsh' },
    settings: { retro98: 'Display Properties', mac: 'System Settings', throws: 'System Settings' },
    bin: { mac: 'Trash', throws: 'Trash' },
  };
  const ADDR = { retro98: 'C:\\Josh\\Projects', win11: 'This PC  ›  Josh  ›  Projects', mac: 'Josh  ›  Projects', throws: 'JOSH / PROJECTS' };
  // The phone home screen: everything not in the dock, plus the three best projects.
  const GRID = ['readme', 'athlete', 'terminal', 'settings', 'bin', { project: 'sector', icon: 'cam', name: 'SECTOR' }, { project: 'ragdoll', icon: 'stick', name: 'RAGDOLL RIOT' }, { project: 'dextensionz', icon: 'bag', name: "D'extensionz" }];
  const PDOCK = ['ask', 'projects', 'circle', 'contact'];
  const PINNED = ['readme', 'projects', 'circle', 'ask', 'terminal'];
  const app = (id) => APPS.find((a) => a.id === id);
  const theme = () => html.dataset.theme;
  const nameOf = (a) => a[theme()] || a.name;

  /* ---- icons: clone the shared glyph into every [data-icon] that's still empty ---- */
  function fillIcons(scope = document) {
    for (const n of scope.querySelectorAll('[data-icon]')) {
      if (n.firstElementChild) continue;
      const t = document.getElementById('ic-' + n.dataset.icon) || document.getElementById('ic-app');
      n.appendChild(t.content.cloneNode(true));
    }
  }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  function launcher(entry, kind) {
    const a = typeof entry === 'string' ? app(entry) : entry;
    const b = el('button', kind === 'dock' ? 'dk' : 'ico');
    b.type = 'button';
    if (a.project) b.dataset.project = a.project; else b.dataset.launch = a.id;
    const ic = el('span', kind === 'start' ? null : 'tile');
    ic.dataset.icon = a.icon;
    const label = el('span', kind === 'dock' ? 'dk-l' : 'ico-l', a.project ? a.name : nameOf(a));
    label.dataset.label = a.id || a.project;
    b.append(ic, label);
    if (kind === 'start') { b.setAttribute('role', 'menuitem'); b.className = ''; label.className = ''; }
    return b;
  }
  function render() {
    for (const box of document.querySelectorAll('[data-launchers]')) {
      const kind = box.dataset.launchers;
      const list = kind === 'grid' ? GRID : kind === 'pdock' ? PDOCK : APPS.map((a) => a.id);
      if (kind === 'start') {
        box.setAttribute('role', 'menu'); box.setAttribute('aria-label', 'Programs');
        box.replaceChildren(...list.flatMap((id) => {
          const li = el('li'); li.setAttribute('role', 'none'); li.appendChild(launcher(id, 'start'));
          if (id !== 'settings') return [li];
          const sep = el('li', 'sep'); sep.setAttribute('role', 'separator');
          return [li, sep];
        }));
      } else box.replaceChildren(...list.map((id) => launcher(id, kind)));
    }
    fillIcons();
  }
  function relabel() {
    for (const n of document.querySelectorAll('[data-label]')) { const a = app(n.dataset.label); if (a) n.textContent = nameOf(a); }
    for (const a of APPS) {
      const t = TITLES[a.id];
      wm.setTitle(a.id, (t && t[theme()]) || a.name);
    }
    for (const n of document.querySelectorAll('[data-addr]')) n.textContent = ADDR[theme()];
  }

  /* ---- launching ---- */
  const start = document.querySelector('.start-btn'), menu = document.getElementById('startmenu');
  function launch(id, from) {
    closeStart(false);
    if (id === 'ask' && JD.openChat) return JD.openChat();
    if (id === 'circle' && JD.focusThrow) return JD.focusThrow(from);
    wm.open(id, { opener: from });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-launch]');
    if (!b) return;
    e.preventDefault();
    launch(b.dataset.launch, b);
  });

  /* ---- the Start menu ---- */
  function openStart() {
    menu.hidden = false; start.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector(theme() === 'win11' ? '#sm-q' : '.sm-apps button');
    if (first) first.focus();
  }
  function closeStart(refocus) {
    if (menu.hidden) return;
    menu.hidden = true; start.setAttribute('aria-expanded', 'false');
    if (refocus) start.focus();
  }
  start.addEventListener('click', () => (menu.hidden ? openStart() : closeStart(true)));
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !start.contains(e.target)) closeStart(false); });
  menu.addEventListener('click', (e) => { if (e.target.closest('[data-project]')) closeStart(false); });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeStart(true); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...menu.querySelectorAll('input, button')].filter((n) => n.getClientRects().length);
    const i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });
  // Search (Windows 11 taskbar and Start menu) asks the chat.
  for (const f of document.querySelectorAll('[data-search]')) {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = f.querySelector('input'), text = q.value.trim();
      q.value = '';
      closeStart(false);
      if (JD.openChat) JD.openChat(text);
    });
  }

  /* ---- taskbar buttons and the dock follow the window manager ---- */
  const tasks = document.querySelector('.tasks'), dockMin = document.querySelector('.dock-min');
  function taskButton(st, kind) {
    const b = el('button', kind === 'dock' ? 'dk mini-w' : 'task');
    b.type = 'button'; b.dataset.task = st.id;
    const ic = el('span'); ic.dataset.icon = st.icon;
    b.append(ic, el('span', kind === 'dock' ? 'dk-l' : 'task-l', st.title));
    if (kind !== 'dock') b.setAttribute('aria-pressed', String(st.active && !st.min));
    b.classList.toggle('running', st.open);
    if (kind === 'dock') b.setAttribute('aria-label', `Restore ${st.title}`);
    return b;
  }
  function renderTasks() {
    const open = wm.list();
    if (theme() === 'win11') {
      const pinned = PINNED.map((id) => wm.state(id));
      const extra = open.filter((s) => !PINNED.includes(s.id));
      tasks.replaceChildren(...[...pinned, ...extra].map((s) => taskButton(s, 'task')));
    } else tasks.replaceChildren(...open.map((s) => taskButton(s, 'task')));
    for (const b of document.querySelectorAll('.dock-apps .dk')) {
      const st = wm.state(b.dataset.launch);
      b.classList.toggle('running', !!(st && st.open) || (b.dataset.launch === 'projects' && open.some((s) => s.id.startsWith('p-'))));
    }
    dockMin.replaceChildren(...open.filter((s) => s.min).map((s) => taskButton(s, 'dock')));
    fillIcons(tasks); fillIcons(dockMin);
  }
  function onTask(e) {
    const b = e.target.closest('[data-task]');
    if (!b) return;
    const id = b.dataset.task, st = wm.state(id);
    if (!st.open) { if (id === 'ask' && JD.openChat) JD.openChat(); else wm.open(id, { opener: b }); }
    else if (st.active && !st.min && b.classList.contains('task')) wm.minimize(id);
    else wm.focus(id);
  }
  tasks.addEventListener('click', onTask);
  dockMin.addEventListener('click', onTask);
  wm.on((type) => { if (type !== 'move') renderTasks(); });

  /* ---- themes ---- */
  const meta = document.querySelector('meta[name="theme-color"]');
  function setTheme(id, save = true) {
    if (!Object.prototype.hasOwnProperty.call(THEMES, id)) return false;
    html.dataset.theme = id; html.dataset.chrome = THEMES[id].chrome;
    if (meta) meta.content = THEMES[id].color;
    if (save) {
      try { localStorage.setItem('jd-theme', id); } catch { /* storage blocked */ }
      if (/[?&]theme=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    }
    for (const r of document.querySelectorAll('input[name="theme"]')) r.checked = r.value === id;
    closeStart(false);
    relabel(); tick(); renderTasks();
    requestAnimationFrame(() => wm.refit());
    return true;
  }
  for (const r of document.querySelectorAll('input[name="theme"]')) r.addEventListener('change', () => { if (r.checked) setTheme(r.value); });
  JD.theme = { set: setTheme, get: theme, list: Object.keys(THEMES), name: (id) => THEMES[id] && THEMES[id].name };

  /* ---- the clock ---- */
  const clocks = document.querySelectorAll('[data-clock]');
  function tick() {
    const d = new Date(), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    for (const c of clocks) {
      const kind = c.dataset.clock;
      if (kind === 'mac') c.textContent = `${d.toLocaleDateString([], { weekday: 'short' })} ${t}`;
      else if (kind === 'win' && theme() === 'win11') c.textContent = `${t}\n${d.toLocaleDateString()}`;
      else c.textContent = t;
    }
  }
  setInterval(tick, 15000);

  /* ---- deep links: #app/<id>, #app/<project>, and the old #work/<project> ---- */
  function route() {
    const m = location.hash.match(/^#(app|work)\/([a-z0-9-]+)$/);
    if (!m) return false;
    const id = wm.has(m[2]) ? m[2] : wm.has('p-' + m[2]) ? 'p-' + m[2] : null;
    if (!id) return false;
    if (id === 'ask' && JD.openChat) JD.openChat(); else wm.open(id);
    return true;
  }
  addEventListener('hashchange', route);

  // The "/" key opens the chat from anywhere that isn't a text field.
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key !== '/') return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (JD.openChat) JD.openChat();
  });

  render();
  setTheme(theme(), false);
  // Desktops open on the README so a recruiter has the essentials without a click.
  addEventListener('DOMContentLoaded', () => {
    if (!wm.phone()) wm.open('readme', { focus: false });
    route();
  });
})(this);
