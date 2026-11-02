// The Terminal: a few shell commands on the same brain as the chat. Anything that
// isn't a command goes to Ask.answer(). Output is text nodes only, so nothing a
// visitor types becomes HTML.
(function (root) {
  const box = document.getElementById('term');
  if (!box || !root.Ask) return;
  const Ask = root.Ask, JD = root.JD, wm = JD.wm;
  const out = box.querySelector('.t-out'), form = box.querySelector('form'), input = form.querySelector('input'), ps = box.querySelector('[data-ps]');
  const PS = { retro98: 'C:\\JOSH>', win11: 'PS C:\\Users\\josh>', mac: 'josh@dare ~ %', throws: 'josh@dare ~ %' };
  const APPS = ['readme', 'projects', 'circle', 'ask', 'athlete', 'contact', 'terminal', 'settings', 'bin'];
  const PROJECTS = wm.all().filter((id) => id.startsWith('p-')).map((id) => id.slice(2));
  const RUNNABLE = ['sector', 'ragdoll'];
  const ctx = {}, hist = [];
  let at = 0, started = false;

  const prompt = () => PS[JD.theme ? JD.theme.get() : 'retro98'] || PS.retro98;
  function print(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    out.appendChild(p);
    out.scrollTop = out.scrollHeight;
  }
  // Fact-file markup to plain text: **bold**, [label](url), `code`, {email}.
  const plain = (s) => String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, (m, label, url) => (url === 'mailto' ? JD.email : `${label} <${url}>`))
    .replace(/`(.+?)`/g, '$1')
    .replace(/\{email\}/g, JD.email);
  const hint = (d) => {
    const [verb, arg] = d.split(':');
    return verb === 'tab' ? `open ${arg}` : verb === 'embed' ? `run ${arg}` : verb === 'throw' ? 'open circle' : verb === 'app' ? `open ${arg}` : verb === 'copy' ? 'email' : null;
  };
  function banner() {
    const dos = JD.theme && JD.theme.get() === 'retro98';
    print(dos ? 'JOSH-DOS Version 2027.3' : "Welcome to Josh Dare's portfolio shell.", 't-dim');
    print('Type help for commands, or ask anything about Josh\'s work.', 't-dim');
    print('');
  }
  function copyEmail() {
    const done = (ok) => print(ok ? `Copied ${JD.email} to your clipboard.` : `Email: ${JD.email}`);
    if (navigator.clipboard && root.isSecureContext) navigator.clipboard.writeText(JD.email).then(() => done(true), () => done(false));
    else done(false);
  }

  const CMDS = {
    help() {
      for (const l of ['help              this list', 'ls                apps and projects', 'open <name>       open an app or a project (open sector)', 'run <sector|ragdoll>  run a live app in its window', 'theme [name]      list themes, or switch (theme mac)', 'whoami            who Josh is', 'email             copy Josh\'s email', 'clear             clear the screen', 'exit              close the terminal', '', 'Anything else is a question: try "how many tests" or "is he open to roles".']) print(l);
    },
    ls() { print('APPS      ' + APPS.join('  ')); print('PROJECTS  ' + PROJECTS.join('  ')); },
    open(arg) {
      if (!arg) return print('usage: open <name>. Type ls for the list.', 't-dim');
      if (APPS.includes(arg)) { if (arg === 'ask') JD.openChat(); else if (arg === 'circle') JD.focusThrow(); else wm.open(arg); return print(`Opening ${wm.title(arg)}.`); }
      if (PROJECTS.includes(arg)) { JD.openAttempt(arg); return print(`Opening ${wm.title('p-' + arg)}.`); }
      print(`No app or project called "${arg}". Type ls for the list.`, 't-dim');
    },
    run(arg) {
      if (!RUNNABLE.includes(arg)) return print('usage: run sector  or  run ragdoll', 't-dim');
      JD.embed(arg);
      print(`Starting ${wm.title('p-' + arg)}.`);
    },
    theme(arg) {
      const T = JD.theme;
      if (!arg) { for (const id of T.list) print(`${id === T.get() ? '*' : ' '} ${id.padEnd(8)} ${T.name(id)}`); return; }
      if (!T.set(arg)) return print(`No theme called "${arg}". Try: ${T.list.join(', ')}.`, 't-dim');
      ps.textContent = prompt();
      print(`Theme set to ${T.name(arg)}.`);
    },
    whoami() { print('Joshua Dare: software engineer and college thrower (discus, hammer) at Life University. B.S. Computer Information Systems, March 2027. Atlanta, GA.'); },
    email: copyEmail,
    clear() { out.replaceChildren(); },
    exit() { wm.close('terminal'); },
  };

  function run(line) {
    const text = line.trim().slice(0, 240);
    print(`${prompt()} ${text}`, 't-cmd');
    if (!text) return;
    hist.push(text); at = hist.length;
    const [cmd, ...rest] = text.split(/\s+/);
    const name = cmd.toLowerCase(), arg = rest.join(' ').toLowerCase().replace(/^p-/, '');
    if (Object.prototype.hasOwnProperty.call(CMDS, name)) { CMDS[name](arg); return; }
    const res = Ask.answer(text, ctx);
    if (res.clear) { CMDS.clear(); ctx.topic = null; return; }
    if (res.topic) ctx.topic = res.topic;
    print(plain(res.text || ''));
    const tips = (res.acts || []).map((a) => (a.href ? a.href : hint(a.do))).filter(Boolean);
    if (tips.length) print('→ try: ' + [...new Set(tips)].join('  ·  '), 't-dim');
    const auto = (res.acts || []).find((a) => a.auto);
    if (auto) { if (auto.do === 'copy') copyEmail(); else JD.act(auto.do); }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; run(v); });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    at = Math.max(0, Math.min(hist.length, at + (e.key === 'ArrowUp' ? -1 : 1)));
    input.value = hist[at] || '';
  });
  out.addEventListener('click', () => { if (!String(getSelection())) input.focus(); });
  wm.on((type, id) => {
    if (type === 'focus' || type === 'open') ps.textContent = prompt();
    if (id !== 'terminal' || type !== 'open') return;
    if (!started) { started = true; banner(); }
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  });
  ps.textContent = prompt();
  JD.term = { run };
})(this);
