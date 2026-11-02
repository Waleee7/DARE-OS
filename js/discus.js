// The Circle's window now runs DISCUS DISASTER in an iframe. The game loads when the window
// opens and unloads when it closes, so a closed window costs no GPU or network.
(function (root) {
  const JD = (root.JD = root.JD || {});
  const win = document.getElementById('w-circle');
  if (!win) return;
  const frame = win.querySelector('iframe'), box = win.querySelector('.dd-frame');
  const load = () => { if (!frame.src || frame.src === 'about:blank') { box.classList.remove('ready'); frame.src = frame.dataset.src; } };
  const unload = () => { frame.src = 'about:blank'; box.classList.remove('ready'); };
  frame.addEventListener('load', () => { if (frame.src && frame.src !== 'about:blank') box.classList.add('ready'); });
  const hook = () => JD.wm.on((type, id) => { if (id !== 'circle') return; if (type === 'open' || type === 'restore') load(); else if (type === 'close') unload(); });
  if (JD.wm) hook(); else document.addEventListener('DOMContentLoaded', () => JD.wm && hook());
  // Read-only view for the headless page checks.
  JD.discusState = () => ({ src: frame.src, ready: box.classList.contains('ready') });
  // Open the game (a window on the desktop, a sheet on a phone) and hand it keyboard focus.
  JD.focusThrow = (opener) => {
    if (JD.wm) JD.wm.open('circle', { opener, focus: false });
    load();
    setTimeout(() => frame.focus({ preventScroll: true }), 80);
  };
})(this);
