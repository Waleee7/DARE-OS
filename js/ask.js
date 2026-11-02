// The matcher behind ASK THE PORTFOLIO. There's no model: a question is scored
// against the fact file (kb.js) by project names, intent words and keywords.
// The last project discussed carries over to follow-ups ("how is it tested?"),
// small typos are corrected against the fact file's own vocabulary, and anything
// that doesn't clear the bar gets an honest "not in my fact file".
(function (root, make) {
  const node = typeof module === 'object' && module.exports;
  const api = make(node ? require('./kb.js') : root.KB);
  if (node) module.exports = api; else root.Ask = api;
})(this, function (KB) {
  const STOP = new Set(('a an the is are was were be been am do does did can could would should will may might must of to in on ' +
    'for at by with from into about as than then so too very really just also and or but if not no i me my we us our you your ' +
    'he him his she her they them their it its this that these those there here what which who when where why how please tell ' +
    'show give know want like any some much many more most get got has have had im ive id whats hows wheres whos dont doesnt ' +
    'didnt cant isnt').split(' '));
  const FOLLOW = /\b(it|its|this|that|they|them|the game|the app|the project|this one|that one)\b/;
  const ABOUT_HIM = /\b(he|him|his|himself|josh|joshua)\b/;

  const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '').replace(/[^a-z0-9#+]+/g, ' ').trim();
  const undouble = (w) => (/([b-df-hj-np-tv-z])\1$/.test(w) ? w.slice(0, -1) : w);
  function stem(w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(ss|us|is)$/.test(w)) return w;
    if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s')) return w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) return undouble(w.slice(0, -3));
    if (w.endsWith('ed') && w.length > 4) return undouble(w.slice(0, -2));
    return w;
  }
  const phrase = (s) => norm(s).split(' ').filter(Boolean).map(stem).join(' ');
  const weight = (p) => { const n = p.split(' ').length; return n === 1 ? 1 : 2 * n; };

  /* ---- index the fact file once ---- */
  const VOCAB = new Set();
  const learn = (p) => p.split(' ').forEach((w) => { if (w.length >= 4 && !STOP.has(w)) VOCAB.add(w); });
  const TOPICS = KB.topics.map((t) => ({ ...t, keys: t.alias.map(phrase) }));
  TOPICS.forEach((t) => t.keys.forEach(learn));
  const INTENTS = Object.entries(KB.intents).map(([id, ws]) => ({ id, keys: ws.map(phrase) }));
  INTENTS.forEach((i) => i.keys.forEach(learn));
  const ENTRIES = KB.entries.map((e) => ({ ...e, keys: [...new Set((e.kw || []).map(phrase))] }));
  ENTRIES.forEach((e) => e.keys.forEach(learn));
  const byId = (id) => ENTRIES.find((e) => e.id === id);
  const find = (topic, intent) => ENTRIES.find((e) => e.topic === topic && e.intent === intent);

  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fix(w) {
    if (w.length < 5 || STOP.has(w) || /\d/.test(w) || VOCAB.has(w)) return w;
    const max = w.length >= 8 ? 2 : 1;
    let best = w, bd = max + 1;
    for (const v of VOCAB) { const d = dist(w, v, max); if (d < bd) { bd = d; best = v; } }
    return best;
  }

  function analyze(q) {
    const raw = norm(q);
    const words = raw.split(' ').filter(Boolean).map(stem).map(fix);
    return { raw, words, text: ` ${words.join(' ')} `, content: words.filter((w) => !STOP.has(w)) };
  }
  // Score a list of key phrases against the question: multi-word phrases count more.
  function score(A, keys) {
    let s = 0; const hit = [];
    for (const k of keys) if (A.text.includes(` ${k} `)) { s += weight(k); hit.push(k); }
    return { s, hit };
  }
  function bestTopic(A) {
    let top = null, ts = 0, hit = [];
    for (const t of TOPICS) {
      let s = 0, h = null;
      for (const k of t.keys) if (A.text.includes(` ${k} `) && weight(k) + 1 > s) { s = weight(k) + 1; h = k; }
      if (s > ts) { top = t; ts = s; hit = [h]; }
    }
    return { top, ts, hit };
  }
  function bestIntent(A) {
    let id = null, is = 0, hit = [];
    for (const i of INTENTS) {
      const r = score(A, i.keys);
      let s = r.s;
      if (i.id === 'why' && /^why\b/.test(A.raw)) s += 3;
      if (s > is) { id = i.id; is = s; hit = r.hit; }
    }
    if (!id && /^how (does|do|did|is|was|are|were|would)\b/.test(A.raw)) id = 'how';
    return { id, is, hit };
  }
  function bestEntry(A, pool) {
    let e = null, gs = 0, hit = [];
    for (const x of pool) {
      if (!x.keys.length) continue;
      const r = score(A, x.keys);
      if (r.s > gs) { e = x; gs = r.s; hit = r.hit; }
    }
    return { e, gs, hit };
  }

  const label = (e, follow) => {
    const t = e.topic && TOPICS.find((x) => x.id === e.topic);
    const what = t ? `${t.name} · ${KB.intentNames[e.intent] || 'OVERVIEW'}` : (KB.labels[e.id] || e.id.toUpperCase());
    return follow ? `${what} · FOLLOW-UP` : what;
  };
  const reply = (e, extra = {}) => ({ id: e.id, text: e.text, acts: e.acts || [], chips: e.chips || [], src: e.src || null, topic: e.topic || null, ...extra });

  const COMMANDS = {
    help: () => ({ id: 'help', ...KB.help, match: 'COMMANDS' }),
    projects: () => reply(byId('projects'), { match: 'COMMAND · /PROJECTS' }),
    play: () => reply(byId('ragdoll.live'), { match: 'COMMAND · /PLAY' }),
    sector: () => reply(byId('sector.live'), { match: 'COMMAND · /SECTOR' }),
    marks: () => reply(byId('marks'), { match: 'COMMAND · /MARKS' }),
    stack: () => reply(byId('stack'), { match: 'COMMAND · /STACK' }),
    contact: () => reply(byId('contact'), { match: 'COMMAND · /CONTACT' }),
    about: () => reply(byId('about'), { match: 'COMMAND · /ABOUT' }),
    resume: () => reply(byId('resume'), { match: 'COMMAND · /RESUME' }),
    throw: () => ({ id: 'cmd.throw', text: 'Heading to the circle. Hold to spin, let go in the red.', acts: [{ label: 'TAKE A THROW', do: 'throw', auto: true }], chips: [], match: 'COMMAND · /THROW' }),
    email: () => ({ id: 'cmd.email', text: 'Copying the address to your clipboard.', acts: [{ label: 'COPY EMAIL', do: 'copy', auto: true }], chips: [], match: 'COMMAND · /EMAIL' }),
    clear: () => ({ id: 'cmd.clear', clear: true }),
  };

  function answer(q, ctx = {}) {
    const s = String(q).trim();
    if (s.startsWith('/')) {
      const name = norm(s.slice(1)).split(' ')[0];
      const run = COMMANDS[name];
      return run ? run() : { id: 'cmd.unknown', text: `There's no /${name || ''} command. Type **/help** for the list.`, chips: ['/help'], acts: [], match: 'COMMANDS' };
    }
    const A = analyze(s);
    if (!A.words.length) return { id: 'fallback', ...KB.fallback, acts: [], match: 'NO MATCH' };

    const { top, ts, hit: th } = bestTopic(A);
    const { id: intent, hit: ih } = bestIntent(A);
    const gen = bestEntry(A, ENTRIES);
    const matched = (h) => ({ matched: [...new Set(h)].filter(Boolean).slice(0, 3) });

    if (top) {
      // A strong general match ("what is mcp") beats a bare project mention.
      if (gen.e && gen.gs > ts + (intent ? 2 : 0)) return reply(gen.e, { match: label(gen.e), ...matched(gen.hit) });
      const own = intent && find(top.id, intent);
      const kw = !own && bestEntry(A, ENTRIES.filter((e) => e.topic === top.id)).e;
      const e = own || kw || find(top.id, 'what');
      return reply(e, { topic: top.id, match: label(e), ...matched([...th, ...ih]) });
    }
    const follow = ctx.topic && FOLLOW.test(A.raw);
    if (follow && intent) {
      const e = find(ctx.topic, intent) || find(ctx.topic, 'what');
      return reply(e, { topic: ctx.topic, match: label(e, true), ...matched(ih) });
    }
    // A short question with an intent and no subject ("how does the physics work?")
    // is about the last project, unless it's about Josh himself ("what's his stack?").
    const short = intent && ctx.topic && A.content.length <= 4 && !ABOUT_HIM.test(A.raw);
    if (gen.e && !(short && gen.gs <= 1)) return reply(gen.e, { match: label(gen.e), ...matched(gen.hit) });
    if (short) {
      const e = find(ctx.topic, intent) || find(ctx.topic, 'what');
      return reply(e, { topic: ctx.topic, match: label(e, true), ...matched(ih) });
    }
    if (intent) return { id: 'clarify', ...KB.clarify, acts: [], match: 'WHICH PROJECT?' };
    return { id: 'fallback', ...KB.fallback, acts: [], match: 'NO MATCH' };
  }

  const welcome = () => ({ id: 'welcome', ...KB.welcome, acts: [], match: null });
  return { answer, welcome, analyze, norm, stem };
});
