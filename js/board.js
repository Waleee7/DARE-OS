// THE BOARD: one flag per project in the throwing sector. The stadium plants them,
// the ribbon lists them, and the jumbotron reads them out. Every number here was
// measured, and `when` says when it was last re-run. `d` is metres from the centre
// of the circle and `a` is degrees off the centre line (positive = the thrower's
// left). Flags are grouped by category: each category throws down its own lane.
(function (root) {
  const RUN = '15 Nov 2026';
  const flags = [
    /* ---- sports tech: the left lane ---- */
    { id: 'sector', name: 'SECTOR', cat: 'Sports tech', d: 68.5, a: 10.5, big: '3.9', unit: 'cm', what: 'off on a 68 m reference throw',
      how: "SECTOR's accuracy harness renders a 68.14 m throw with a known answer, then measures it back from the pixels alone: 68.10 m. 58 tests pass.",
      when: `Re-run ${RUN}`, url: 'https://sector-ochre.vercel.app', repo: 'sector', open: 'p-sector' },
    { id: 'trackside', name: 'trackside', cat: 'Sports tech', d: 51, a: 12.5, big: '0.58', unit: 'ms', what: 'worst finish-timing error',
      how: 'Synthetic sprint finishes with known answers, sub-pixel motion, blur and sensor noise. Every number comes back with its error bar.',
      when: `Re-run ${RUN}`, repo: 'trackside', open: 'p-trackside' },
    { id: 'throwingtracker', name: 'ThrowingTracker', cat: 'Sports tech', d: 36.5, a: 9.5, big: '107', unit: 'tests', what: 'passing on the public repo',
      how: 'Vitest, run on a fresh clone of github.com/Waleee7/ThrowingTracker.',
      when: `Re-run ${RUN}`, url: 'https://throwing-tracker.vercel.app', repo: 'ThrowingTracker', open: 'p-throwingtracker' },
    /* ---- client builds ---- */
    { id: 'dextensionz', name: "D'extensionz", cat: 'Client builds', d: 45, a: 5, big: 'LIVE', unit: '', what: 'client storefront on live Stripe',
      how: 'Stripe Checkout in live mode, so card numbers never touch my server. The live check is a request from your browser to the store, right now.',
      when: 'Probed live', url: 'https://dextensionz-site.vercel.app', open: 'p-dextensionz', client: true },
    { id: 'cleanbins', name: 'CleanBins', cat: 'Client builds', d: 30.5, a: 4, big: 'LIVE', unit: '', what: 'client site, approved by the owner',
      how: 'A trash-bin cleaning service in Tuscaloosa. The live check is a request from your browser to the site, right now.',
      when: 'Probed live', url: 'https://cleanbins-tuscaloosa.vercel.app', open: 'p-cleanbins', client: true },
    /* ---- games & media: down the middle ---- */
    { id: 'discus', name: 'DISCUS DISASTER', cat: 'Games & media', d: 74, a: -0.5, big: 'LIVE', unit: '', what: '3D discus with real aerodynamics',
      how: 'Lift and drag by angle of attack, plus wind. A cinematic upgrade is in progress; the link stays the same.',
      when: 'Probed live', url: 'https://discus-disaster.vercel.app', open: 'circle', wip: 'Cinematic upgrade in progress' },
    { id: 'groundstop', name: 'GROUND STOP', cat: 'Games & media', d: 63, a: 1.5, big: 'SOON', unit: '', what: 'airport sim on the live FAA feed',
      how: 'A real-life airport simulator driven by the live FAA status feed. In progress: no public link until it ships.',
      when: 'In progress', open: 'p-groundstop', wip: 'In progress · no public link yet' },
    { id: 'ragdoll', name: 'RAGDOLL RIOT', cat: 'Games & media', d: 55.5, a: -1.5, big: '8.3', unit: 'ms', what: 'per frame with 12 ragdolls on screen',
      how: '475 frames at 1440×900 and 2× pixel ratio in headless Chrome on an M3 Pro: 8.33 ms average, 8.40 ms p95.',
      when: `Re-measured ${RUN}`, url: 'https://ragdoll-riot.vercel.app', repo: 'ragdoll-riot', open: 'p-ragdoll' },
    { id: 'peachdash', name: 'PEACH DASH', cat: 'Games & media', d: 41.5, a: 1, big: '51', unit: 'tests', what: 'on the game logic, plus a 6,000 m autopilot run',
      how: 'Phone update shipped today (commit 3645750): half-size building atlases and phone-sized skies, with no per-frame allocations.',
      when: `Re-run ${RUN}`, url: 'https://peach-dash.vercel.app', repo: 'peach-dash', open: 'p-peachdash' },
    { id: 'blox', name: 'BLOX LIFE', cat: 'Games & media', d: 27, a: -1, big: '50', unit: 's', what: 'to render ten 1080×1920 videos',
      how: 'Every frame is a pure function of time, drawn by headless Chrome on the GPU through Metal.',
      when: 'Measured 25 Oct 2026', open: 'p-blox' },
    /* ---- AI & dev tools: the right lane ---- */
    { id: 'tells', name: 'TELLS', cat: 'AI & dev tools', d: 70, a: -7.5, big: '95.2', unit: '%', what: 'precision on 45 held-out messages',
      how: 'The rules were frozen at a git tag, then a fresh 45-message holdout ran once: 95.2% precision, 83.3% recall. 228 tests pass.',
      when: `Re-run ${RUN}`, repo: 'TELLS', open: 'p-tells' },
    { id: 'daredesk', name: 'DARE Desk', cat: 'AI & dev tools', d: 59.5, a: -6, big: '129', unit: 'tests', what: 'on a rules-based options engine',
      how: 'Vitest: 15 files in 8.9 s, on a fresh clone of the public repo. Paper-first until the rules prove out.',
      when: `Re-run ${RUN}`, repo: 'dare-desk', open: 'p-daredesk' },
    { id: 'hushprint', name: 'Hushprint', cat: 'AI & dev tools', d: 48.5, a: -9, big: '117', unit: 'tests', what: '10 file types, 0 uploads',
      how: 'Hand-written parsers fuzzed against hostile files. Every clean copy is re-parsed to prove the metadata is gone.',
      when: `Re-run ${RUN}`, repo: 'hushprint', open: 'p-hushprint' },
    { id: 'darecheck', name: 'DARE CHECK', cat: 'AI & dev tools', d: 38, a: -6.5, big: '115', unit: 'tests', what: '14 safety checks, graded A to F',
      how: 'node --test with zero dependencies. Every address is re-checked at connect time, so it cannot be aimed at a private network.',
      when: `Re-run ${RUN}`, url: 'https://dare-check.vercel.app', repo: 'dare-check', open: 'p-darecheck' },
    { id: 'echo', name: 'echo', cat: 'AI & dev tools', d: 26.5, a: -8, big: '5', unit: 'tools', what: 'an MCP server that gives AI a memory',
      how: 'Counted in the server source: save_memory, recall, search, list_by_category and forget. Memories are plain JSON files.',
      when: `Counted ${RUN}`, url: 'https://echo-ruby-omega.vercel.app', repo: 'echo', open: 'p-echo' },
    /* ---- learning: the far right ---- */
    { id: 'course', name: 'Options Lab', cat: 'Learning apps', d: 44, a: -13.5, big: '113', unit: 'tests', what: 'unit tests on the pricing engine',
      how: 'Vitest, re-run today. 1,720 browser checks across three browsers passed on 5 Nov 2026.',
      when: `Re-run ${RUN}`, url: 'https://optionstradingcourse.vercel.app', repo: 'options-trading-course', open: 'p-course' },
  ];
  const board = { run: RUN, flags, byId: (id) => flags.find((f) => f.id === id) };
  if (typeof module === 'object' && module.exports) module.exports = board;
  else (root.JD = root.JD || {}).board = board;
})(this);
