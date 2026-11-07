// Applies a saved theme choice before first paint (loaded in <head>, no inline scripts).
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system setting */ }
  document.documentElement.classList.add('js'); // CSS: clamp summaries only when the script can expand them
  // Header: "/talks" types itself on the first page of a visit only (not on every navigation).
  try {
    if (!sessionStorage.getItem('typed')) { document.documentElement.classList.add('type-in'); sessionStorage.setItem('typed', '1'); }
  } catch (e) { /* storage blocked: skip the animation */ }
  // Talk pages: pick the phase before first paint so buttons never flash or jump.
  // before: > 30 min to start · live: until N min before the end · fb: feedback window · over: after the end
  var h = document.documentElement, s = h.getAttribute('data-talk-start'), e = h.getAttribute('data-talk-end');
  if (s && e) {
    var now = Date.now(), start = Date.parse(s), end = Date.parse(e);
    var lead = (parseInt(h.getAttribute('data-fb-lead'), 10) || 10) * 60000;
    h.setAttribute('data-phase', now < start - 30 * 60000 ? 'before' : now < end - lead ? 'live' : now <= end ? 'fb' : 'over');
  }
})();
