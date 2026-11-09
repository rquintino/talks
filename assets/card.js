// rquintino.github.io/talks: takeaway card. Vanilla JS, no dependencies (see CLAUDE.md).
// The attendee's one idea is drawn as a 1200×630 image on a canvas, on their own device.
// Nothing is sent anywhere: no network calls; the draft stays in this browser's localStorage.
(function () {
  'use strict';
  var sec = document.querySelector('[data-card]');
  if (!sec) return;
  var $ = function (s) { return sec.querySelector(s); };
  var canvas = $('[data-card-canvas]'), text = $('[data-card-text]'), who = $('[data-card-name]');
  var count = $('[data-card-count]'), shareBtn = $('[data-card-share]'), dlBtn = $('[data-card-download]');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx || !canvas.toBlob || !text || !who || !dlBtn || !shareBtn) return;

  var D = function (k) { return sec.getAttribute('data-' + k) || ''; };
  var FILE = D('file') || 'takeaway.png', ALT = canvas.getAttribute('aria-label') || '';
  var MAX = parseInt(text.getAttribute('maxlength'), 10) || 140;
  var KEY = 'card:' + D('id');
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  var one = function (s) { return s.replace(/\s+/g, ' ').trim(); };

  // ---- drawing: same look as the social card (ogTemplate in tools/build.mjs) ----
  var W = 1200, H = 630, PX = 72, PY = 64, HERO_W = 800;
  var INK = '#F2F5FB', SUB = '#C3CCDD', BLUE = '#9DB8FF', FAINT = '#5E6E96';
  var SORA = '"Sora", ui-sans-serif, system-ui, sans-serif';
  var SANS = '"DM Sans", ui-sans-serif, system-ui, sans-serif';
  var MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
  var spacing = function (px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
  var wide = function (s) { return ctx.measureText(s).width; };
  // word wrap; a word wider than the box is broken by characters
  var wrap = function (s, maxW) {
    var lines = [], line = '';
    s.split(' ').forEach(function (word) {
      var next = line ? line + ' ' + word : word;
      if (wide(next) <= maxW) { line = next; return; }
      if (line) { lines.push(line); line = ''; }
      if (wide(word) <= maxW) { line = word; return; }
      Array.from(word).forEach(function (ch) {
        if (line && wide(line + ch) > maxW) { lines.push(line); line = ch; } else { line += ch; }
      });
    });
    if (line) lines.push(line);
    return lines;
  };
  var clip = function (s, maxW) {
    if (wide(s) <= maxW) return s;
    var a = Array.from(s);
    while (a.length > 1 && wide(a.join('').replace(/\s+$/, '') + '…') > maxW) a.pop();
    return a.join('').replace(/\s+$/, '') + '…';
  };
  var ring = function () {
    var k = 620 / 600, cx = 810 + 300 * k, cy = -170 + 300 * k;
    var circle = function (x, r) { ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); };
    ctx.lineCap = 'butt'; ctx.strokeStyle = '#1E2A48'; ctx.lineWidth = 2 * k;
    circle(cx, 280 * k); ctx.stroke();
    circle(cx, 200 * k); ctx.stroke();
    ctx.strokeStyle = '#3D6BFF'; ctx.lineWidth = 10 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, 200 * k, 0, 520 / 200); ctx.stroke();
    ctx.fillStyle = BLUE; circle(810 + 500 * k, 14 * k); ctx.fill();
  };
  var draw = function () {
    var idea = one(text.value), name = one(who.value);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0B1020'; ctx.fillRect(0, 0, W, H);
    ring();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // eyebrow: event · date
    var size = 26, eyebrow = D('eyebrow');
    do { ctx.font = '400 ' + size + 'px ' + MONO; spacing(size * 0.04); size -= 2; } while (wide(eyebrow) > HERO_W && size >= 18);
    ctx.fillStyle = BLUE;
    ctx.fillText(clip(eyebrow, HERO_W), PX, PY + 24);

    // footer: page address on the right, talk title on the left (two lines at most)
    var base = H - PY;
    ctx.font = '400 22px ' + MONO; spacing(0);
    var url = D('url'), urlW = wide(url);
    ctx.textAlign = 'right'; ctx.fillText(url, W - PX, base); ctx.textAlign = 'left';
    var titleW = W - PX * 2 - urlW - 48, tl;
    // one line if it fits at 26–22px, otherwise two lines at 22px
    size = 28;
    do { size -= 2; ctx.font = '700 ' + size + 'px ' + SORA; spacing(size * -0.02); tl = wrap(D('title'), titleW); } while (tl.length > 1 && size > 22);
    if (tl.length > 2) { tl = [tl[0], clip(tl.slice(1).join(' '), titleW)]; }
    ctx.fillStyle = INK;
    tl.forEach(function (l, i) { ctx.fillText(l, PX, base - (tl.length - 1 - i) * 34); });

    // the idea: as large as fits between the eyebrow and the footer
    var top = PY + 62, bottom = base - (tl.length - 1) * 34 - 26 - 34, room = bottom - top;
    var nameH = name ? 58 : 0, lines, lh;
    var hero = idea ? '“' + idea + '”' : D('empty');
    size = hero.length > 48 ? 64 : 76;
    for (;;) {
      ctx.font = '800 ' + size + 'px ' + SORA; spacing(size * -0.035);
      lines = wrap(hero, HERO_W); lh = Math.round(size * 1.1);
      if (lines.length * lh + nameH <= room || size <= 24) break;
      size -= 2;
    }
    var y = top + Math.max(0, (room - lines.length * lh - nameH) / 2);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = idea ? INK : FAINT;
    lines.forEach(function (l, i) { ctx.fillText(l, PX, y + (i + 0.5) * lh); });
    if (name) {
      ctx.font = '400 28px ' + SANS; spacing(0);
      ctx.fillStyle = SUB;
      ctx.fillText(clip('— ' + name, HERO_W), PX, y + lines.length * lh + 20 + 17);
    }
    ctx.textBaseline = 'alphabetic'; spacing(0);
  };

  // ---- image file: baked a moment after each change, so share/download run inside the tap ----
  var baked = null, bakedFor = null, timer = null;
  var sig = function () { return one(text.value) + '\n' + one(who.value); };
  var snapshot = function (then) {
    var s = sig();
    if (baked && bakedFor === s) { then(baked); return; }
    canvas.toBlob(function (b) { if (b) { baked = b; bakedFor = s; } then(b); }, 'image/png');
  };
  var save = function (blob) {
    var a = document.createElement('a'), url = null;
    try { url = blob && window.URL && URL.createObjectURL ? URL.createObjectURL(blob) : null; } catch (e) { url = null; }
    a.href = url || canvas.toDataURL('image/png'); // data: URL only where object URLs are missing
    a.download = FILE; a.hidden = true;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  };
  var asFile = function (blob) {
    try { return new File([blob], FILE, { type: 'image/png' }); } catch (e) { return null; }
  };
  var canShare = false;
  try { canShare = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [asFile(new Blob(['.'], { type: 'image/png' }))] })); } catch (e) { canShare = false; }

  var render = function () {
    var has = !!one(text.value);
    draw();
    dlBtn.disabled = shareBtn.disabled = !has;
    if (count) count.textContent = text.value.length + '/' + MAX;
    canvas.setAttribute('aria-label', has ? ALT + ': ' + one(text.value) : ALT);
    clearTimeout(timer);
    if (has) timer = setTimeout(function () { snapshot(function () {}); }, 250);
  };
  var changed = function () { store.set({ t: text.value, n: who.value }); render(); };

  var draft = store.get();
  if (draft && typeof draft.t === 'string') text.value = draft.t.slice(0, MAX);
  if (draft && typeof draft.n === 'string') who.value = draft.n.slice(0, parseInt(who.getAttribute('maxlength'), 10) || 40);
  text.addEventListener('input', changed);
  who.addEventListener('input', changed);
  dlBtn.addEventListener('click', function () { if (one(text.value)) snapshot(save); });
  // have the image ready before the tap lands, so share() runs inside the tap (iOS asks for that)
  var bakeNow = function () { clearTimeout(timer); if (one(text.value)) snapshot(function () {}); };
  shareBtn.addEventListener('pointerdown', bakeNow);
  text.addEventListener('blur', bakeNow);
  who.addEventListener('blur', bakeNow);
  var sharing = false;
  shareBtn.addEventListener('click', function () {
    if (sharing || !one(text.value)) return;
    snapshot(function (blob) {
      var f = blob && asFile(blob);
      if (!f) { save(blob); return; }
      sharing = true;
      // the image only: with a link next to it, some share targets send the link and drop the image
      navigator.share({ files: [f], title: D('share-title') }).then(function () { sharing = false; }, function (e) {
        sharing = false;
        // closing the sheet, or a second tap while it is open, is not a failure
        if (!e || (e.name !== 'AbortError' && e.name !== 'InvalidStateError')) save(blob);
      });
    });
  });
  shareBtn.hidden = !canShare;
  dlBtn.classList.toggle('btn-primary', !canShare);
  sec.hidden = false;

  // first draw once the three families are in, so the card never shows a fallback font
  var fonts = ['800 64px "Sora"', '700 26px "Sora"', '400 28px "DM Sans"', '400 26px "JetBrains Mono"'];
  if (document.fonts && document.fonts.load && window.Promise) {
    Promise.all(fonts.map(function (f) { return document.fonts.load(f); })).then(render, render);
  } else { render(); }
})();
