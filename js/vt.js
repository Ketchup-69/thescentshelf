// Moving between the light shelf and dark Lux: the new page cuts in along a rough
// diagonal and pushes the old one aside (see "Page transition" in css/main.css).
// A plain script in <head>, so it is listening before the new page first paints.
(function () {
  var KEY = 'tss.theme';
  function theme() { return document.documentElement.classList.contains('lux') ? 'lux' : 'shelf'; }
  function remember() { try { sessionStorage.setItem(KEY, theme()); } catch (e) { /* storage blocked */ } }
  function quiet(vt) { if (!vt) return; ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (vt[k]) vt[k].catch(function () {}); }); }
  addEventListener('pageswap', function (e) { quiet(e.viewTransition); remember(); });
  addEventListener('pagehide', remember);
  addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    quiet(e.viewTransition); // a skipped or interrupted transition rejects its promises; nothing to report
    var from = null;
    try { from = sessionStorage.getItem(KEY); } catch (err) { /* storage blocked */ }
    var now = theme();
    if (!from || from === now || matchMedia('(prefers-reduced-motion: reduce)').matches) { e.viewTransition.skipTransition(); return; }
    e.viewTransition.types.add(now === 'lux' ? 'to-lux' : 'to-shelf');
  });
})();
