// Live numbers for the scorecard. LIVE probes every product from this browser;
// OPEN SOURCE and LAST PUSH come from the GitHub API. If a request fails, the
// snapshot measured on 25 Oct 2026 (already in the HTML) stays on screen.
(function () {
  const card = document.querySelector('.card');
  if (!card) return;
  const USER = 'Waleee7';
  const SITES = [
    ["D'extensionz", 'https://dextensionz-site.vercel.app'],
    ['CleanBins', 'https://cleanbins-tuscaloosa.vercel.app'],
    ['RAGDOLL RIOT', 'https://ragdoll-riot.vercel.app'],
    ['SECTOR', 'https://sector-ochre.vercel.app'],
    ['ThrowingTracker', 'https://throwing-tracker.vercel.app'],
    ['echo', 'https://echo-ruby-omega.vercel.app'],
    ['GlobalLingo', 'https://global-lingo.vercel.app'],
    ['Options Course', 'https://optionstradingcourse.vercel.app'],
  ];
  const stamp = card.querySelector('[data-stamp]');
  function set(key, big, rest, title, state) {
    const r = card.querySelector(`[data-live="${key}"]`);
    if (!r) return;
    r.querySelector('b').textContent = big;
    r.querySelector('[data-v]').textContent = rest;
    r.title = title;
    r.dataset.state = state;
  }

  /* ---- reachability: an opaque no-cors HEAD resolves only if the server answered ---- */
  async function probe([name, url]) {
    const c = new AbortController(), timer = setTimeout(() => c.abort(), 6000), t0 = performance.now();
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: c.signal });
      return { name, ok: true, ms: Math.round(performance.now() - t0) };
    } catch {
      return { name, ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
  Promise.all(SITES.map(probe)).then((rs) => {
    const up = rs.filter((r) => r.ok), ms = up.map((r) => r.ms).sort((a, b) => a - b);
    const median = ms.length ? ms[Math.floor(ms.length / 2)] : 0;
    set('sites', String(up.length), `/${rs.length} answering · ${median} ms`,
      'Probed from your browser just now:\n' + rs.map((r) => `${r.name}: ${r.ok ? r.ms + ' ms' : 'no answer'}`).join('\n'),
      up.length === rs.length ? 'up' : 'part');
    for (const n of document.querySelectorAll('[data-count="sites"]')) n.textContent = String(up.length);
    if (stamp) stamp.textContent = 'LIVE · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  /* ---- GitHub, cached for ten minutes so reloads don't spend the rate limit ---- */
  const KEY = 'jd-gh-v1', TTL = 10 * 60 * 1000;
  const cache = {
    get() { try { const v = JSON.parse(sessionStorage.getItem(KEY)); return v && Date.now() - v.at < TTL ? v : null; } catch { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };
  const ago = (iso) => {
    const min = Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
    return min < 60 ? `${Math.max(1, Math.round(min))} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
  };
  function apply(gh) {
    set('repos', String(gh.repos), `public repos · ${gh.stars} ★`, `github.com/${USER}: ${gh.repos} public repos, ${gh.stars} stars, from the GitHub API`, 'up');
    if (gh.push) set('push', ago(gh.push.at), `ago · ${gh.push.repo}`, `Latest public push: ${gh.push.repo}, ${new Date(gh.push.at).toLocaleString()}`, 'up');
  }
  const json = (url) => fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const hit = cache.get();
  if (hit) apply(hit);
  else {
    Promise.all([
      json(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`),
      json(`https://api.github.com/users/${USER}/events/public?per_page=30`),
    ]).then(([repos, events]) => {
      const pub = repos.filter((r) => !r.private);
      const ev = events.find((e) => (e.type === 'PushEvent' || e.type === 'CreateEvent') && e.repo.name !== `${USER}/${USER}`);
      const gh = { at: Date.now(), repos: pub.length, stars: pub.reduce((s, r) => s + r.stargazers_count, 0), push: ev ? { at: ev.created_at, repo: ev.repo.name.split('/')[1] } : null };
      cache.set(gh);
      apply(gh);
    }).catch(() => { /* rate-limited or offline: the measured snapshot stays */ });
  }

  /* ---- the footer measures this page on the visitor's own device ---- */
  addEventListener('load', () => setTimeout(() => {
    const foot = document.querySelector('[data-pagestats]');
    const nav = performance.getEntriesByType('navigation')[0];
    if (!foot || !nav) return;
    const code = performance.getEntriesByType('resource').filter((r) => r.name.startsWith(location.origin) && /\.(js|css)(\?|$)/.test(r.name));
    const bytes = [nav, ...code].reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0);
    const size = bytes ? `${Math.round(bytes / 1024)} KB OF CODE · ` : '';
    foot.textContent = `THIS PAGE: ${size}NO FRAMEWORK · READY IN ${Math.round(nav.domContentLoadedEventEnd)} MS ON YOUR DEVICE`;
  }, 0));
})();
