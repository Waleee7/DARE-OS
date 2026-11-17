// What's New: a red dot on its icon until this visitor has opened it. A later ship
// (a newer date in the list) brings the dot back. Storage can be blocked, so the dot
// just shows for that visit.
(function () {
  const KEY = 'jd-news-seen';
  const html = document.documentElement;
  const first = document.querySelector('#w-news time');
  if (!first) return;
  const latest = first.getAttribute('datetime');
  let seen = null;
  try { seen = localStorage.getItem(KEY); } catch (e) { /* blocked */ }
  if (seen !== latest) html.dataset.news = 'new';
  function markSeen() {
    delete html.dataset.news;
    try { localStorage.setItem(KEY, latest); } catch (e) { /* blocked */ }
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-launch="news"]')) markSeen(); });
  // also covers a deep link and the terminal or Ask Akinwale opening it
  new MutationObserver(() => { if (window.JD && JD.wm && JD.wm.isOpen('news')) markSeen(); })
    .observe(document.getElementById('w-news'), { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
})();
