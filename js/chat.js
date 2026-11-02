// ASK JOSH, the chat window. Ask.answer() picks the reply from the fact file;
// this file renders it, types it out and runs the page actions it carries.
// Everything is built with DOM nodes, so nothing a visitor types becomes HTML.
(function (root) {
  const el = document.getElementById('chat');
  if (!el || !root.Ask) return;
  const Ask = root.Ask, JD = (root.JD = root.JD || {}), wm = JD.wm;
  const thread = el.querySelector('.chat-thread'), chips = el.querySelector('.chat-chips');
  const form = el.querySelector('form'), input = form.querySelector('input');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = {};
  let started = false, typing = null;

  const node = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const link = (label, href) => {
    const a = node('a', null, label);
    a.href = href === 'mailto' ? 'mailto:' + JD.email : href;
    if (/^https?:/.test(a.href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  };
  const scroll = () => { thread.scrollTop = thread.scrollHeight; };

  /* ---- open / close: the chat is a window like any other ---- */
  function open(q) {
    wm.open('ask', { opener: document.activeElement });
    if (!started) { started = true; say(Ask.welcome(), false); }
    if (q) ask(q);
    setTimeout(() => input.focus({ preventScroll: true }), reduce ? 0 : 60);
  }
  const close = () => wm.close('ask');
  JD.openChat = open;
  JD.closeChat = close;
  for (const b of document.querySelectorAll('[data-ask]')) b.addEventListener('click', () => open(b.dataset.ask || ''));
  wm.on((type, id) => { if (id === 'ask' && type === 'open' && !started) { started = true; say(Ask.welcome(), false); } });

  /* ---- answers: **bold**, [label](url), `code` and line breaks ---- */
  function parse(s) {
    const out = [], re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)|`(.+?)`|\n/g;
    let i = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > i) out.push({ t: s.slice(i, m.index) });
      if (m[1]) out.push({ t: m[1], tag: 'b' });
      else if (m[2]) out.push({ t: m[2], tag: 'a', href: m[3] });
      else if (m[4]) out.push({ t: m[4], tag: 'code' });
      else out.push({ br: true });
      i = re.lastIndex;
    }
    if (i < s.length) out.push({ t: s.slice(i) });
    return out;
  }

  function say(res, animate) {
    const m = node('div', 'msg bot'), p = node('p');
    m.appendChild(p);
    thread.appendChild(m);
    const parts = [];
    for (const seg of parse(res.text || '')) {
      if (seg.br) { p.appendChild(node('br')); continue; }
      const n = seg.tag === 'a' ? link('', seg.href) : seg.tag ? node(seg.tag) : document.createTextNode('');
      p.appendChild(n);
      parts.push({ n, full: seg.t.replace('{email}', JD.email) });
    }
    const finish = () => {
      typing = null;
      thread.removeAttribute('aria-busy');
      p.classList.remove('caret');
      extras(m, res);
    };
    if (!animate || reduce) { for (const x of parts) x.n.textContent = x.full; finish(); return; }
    thread.setAttribute('aria-busy', 'true');
    p.classList.add('caret');
    let k = 0, j = 0;
    const step = () => {
      let budget = 5;
      while (k < parts.length && budget > 0) {
        const x = parts[k], take = Math.min(budget, x.full.length - j);
        j += take; budget -= take;
        x.n.textContent = x.full.slice(0, j);
        if (j >= x.full.length) { k++; j = 0; }
      }
      scroll();
      if (k < parts.length) typing.raf = requestAnimationFrame(step); else finish();
    };
    typing = {
      raf: requestAnimationFrame(step),
      done() { cancelAnimationFrame(this.raf); for (const x of parts) x.n.textContent = x.full; finish(); },
    };
  }

  function extras(m, res) {
    if (res.acts && res.acts.length) {
      const row = node('div', 'acts');
      for (const a of res.acts) {
        if (a.href) { row.appendChild(link(a.label, a.href)); continue; }
        const b = node('button', null, a.label);
        b.type = 'button';
        b.addEventListener('click', () => act(a.do));
        row.appendChild(b);
      }
      m.appendChild(row);
    }
    if (res.match) {
      const src = node('span', 'src', '↳ ' + res.match);
      if (res.src && res.src[1]) { src.append(' · SOURCE: '); src.appendChild(link(res.src[0] + ' ↗', res.src[1])); }
      else if (res.src) src.append(' · SOURCE: ' + res.src[0]);
      m.appendChild(src);
    }
    if (res.chips && res.chips.length) setChips(res.chips);
    const auto = (res.acts || []).find((a) => a.auto);
    if (auto) setTimeout(() => act(auto.do), reduce ? 0 : 450);
    scroll();
  }

  function setChips(list) {
    chips.replaceChildren(...list.map((c) => {
      const b = node('button', null, c);
      b.type = 'button';
      b.addEventListener('click', () => ask(c));
      return b;
    }));
    chips.scrollLeft = 0;
  }

  /* ---- a question ---- */
  function ask(q) {
    q = String(q).trim().slice(0, 240);
    if (!q) return;
    if (typing) typing.done();
    thread.appendChild(node('div', 'msg me', q));
    const res = Ask.answer(q, ctx);
    if (res.clear) {
      thread.replaceChildren();
      ctx.topic = null;
      say(Ask.welcome(), false);
      return;
    }
    if (res.topic) ctx.topic = res.topic;
    if (reduce) { say(res, false); return; }
    const wait = node('div', 'msg wait');
    wait.setAttribute('aria-hidden', 'true');
    wait.append(node('i', null, '●'), node('i', null, '●'), node('i', null, '●'));
    thread.appendChild(wait);
    scroll();
    setTimeout(() => { wait.remove(); say(res, true); }, 260);
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    ask(q);
  });

  /* ---- page actions an answer can carry. The chat stays open: windows stack. ---- */
  function act(d) {
    const [verb, arg] = d.split(':');
    if (verb === 'tab') JD.openAttempt(arg);
    else if (verb === 'embed') JD.embed(arg);
    else if (verb === 'throw') { if (JD.focusThrow) JD.focusThrow(); }
    else if (verb === 'app') wm.open(arg);
    else if (verb === 'copy') copyEmail();
  }
  JD.act = act;

  /* ---- the greeting: puts the chat one question away without opening a window on load.
     Hidden for the rest of the visit once it's dismissed or the chat has been opened. ---- */
  const nudge = document.getElementById('nudge');
  const OFF = 'jd-nudge-off';
  const seen = () => { try { return sessionStorage.getItem(OFF) === '1'; } catch { return false; } };
  const hush = () => {
    if (nudge) nudge.hidden = true;
    try { sessionStorage.setItem(OFF, '1'); } catch { /* storage blocked: it just reappears next load */ }
  };
  for (const f of document.querySelectorAll('[data-nudge]')) {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = f.elements.q.value.trim();
      f.elements.q.value = '';
      open(q);
    });
  }
  if (nudge) {
    nudge.querySelector('.nudge-x').addEventListener('click', hush);
    for (const b of nudge.querySelectorAll('[data-q]')) b.addEventListener('click', () => open(b.dataset.q));
    nudge.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); hush(); } });
    wm.on((type, id) => { if (id === 'ask' && type === 'open') hush(); });
    const show = () => { if (!seen() && !wm.phone() && !wm.isOpen('ask')) nudge.hidden = false; };
    if (!seen()) setTimeout(show, reduce ? 0 : 1200);
  }
  JD.nudge = { hush, shown: () => !!nudge && !nudge.hidden };
  function copyEmail() {
    const done = (ok) => say({ text: ok ? `Copied **{email}** to your clipboard.` : `Here it is: [{email}](mailto)` }, false);
    if (navigator.clipboard && root.isSecureContext) navigator.clipboard.writeText(JD.email).then(() => done(true), () => done(false));
    else done(false);
  }
})(this);
