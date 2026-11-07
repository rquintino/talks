// rquintino.github.io/talks: vanilla JS, no dependencies (see CLAUDE.md).
// Progressive enhancement: every talk is in the HTML; this adds theme toggle,
// search, faceted filters, sort, cards/timeline view, countdown, share/copy-link
// and the talk page's live status and stage mode.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var TXT = PT ? {
    dark: '☾ Escuro', light: '☀ Claro', switchTo: function (n) { return 'Mudar para o tema ' + (n === 'dark' ? 'escuro' : 'claro'); },
    copied: 'Copiado ✓', selected: 'Selecionado — prime Ctrl/⌘+C', copy: 'Copiar ligação', share: 'Partilhar ligação',
    upcoming: 'Em breve', startingSoon: 'Começa em breve', onNow: 'A decorrer', thanks: 'Obrigado pela presença',
    latest: 'Última palestra', now: 'Agora', onStage: 'EM PALCO', today: 'Hoje', day: 'DIA', days: 'DIAS',
    session: 'sessão', sessions: 'sessões', newest: 'Mais recentes primeiro ↓', oldest: 'Mais antigas primeiro ↑',
    remove: 'Remover filtro: ', clear: 'Limpar tudo', has: { slides: 'Com diapositivos', video: 'Com vídeo', audio: 'Com áudio' }
  } : {
    dark: '☾ Dark', light: '☀ Light', switchTo: function (n) { return 'Switch to ' + n + ' theme'; },
    copied: 'Copied ✓', selected: 'Selected — press Ctrl/⌘+C', copy: 'Copy link', share: 'Share link',
    upcoming: 'Upcoming', startingSoon: 'Starting soon', onNow: 'On now', thanks: 'Thanks for joining',
    latest: 'Latest talk', now: 'Now', onStage: 'ON STAGE', today: 'Today', day: 'DAY TO GO', days: 'DAYS TO GO',
    session: 'session', sessions: 'sessions', newest: 'Newest first ↓', oldest: 'Oldest first ↑',
    remove: 'Remove filter: ', clear: 'Clear all', has: { slides: 'Has slides', video: 'Has video', audio: 'Has audio' }
  };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  // ---- theme toggle ----
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var currentTheme = function () { return root.getAttribute('data-theme') || (mq && mq.matches ? 'dark' : 'light'); };
  $$('[data-theme-toggle]').forEach(function (btn) {
    var label = $('[data-theme-label]', btn), icon = $('[data-theme-icon]', btn);
    var paint = function () {
      var other = currentTheme() === 'dark' ? 'light' : 'dark';
      var parts = (other === 'dark' ? TXT.dark : TXT.light).split(' ');
      if (icon) { icon.textContent = parts[0]; label.textContent = parts.slice(1).join(' '); }
      else { label.textContent = parts.join(' '); }
      btn.setAttribute('aria-label', TXT.switchTo(other));
    };
    btn.hidden = false;
    paint();
    btn.addEventListener('click', function () {
      var n = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', n);
      store.set('theme', n);
      paint();
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', paint);
  });

  // ---- share / copy link: the phone's own share sheet when there is one ----
  $$('[data-copy]').forEach(function (b) {
    var canShare = !!navigator.share;
    var label = canShare ? TXT.share : TXT.copy;
    b.textContent = label;
    b.hidden = false;
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-copy');
      var done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = label; }, 2000); };
      var fallback = function () {
        var src = $('[data-copy-src]');
        if (src) { var rg = document.createRange(); rg.selectNodeContents(src); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rg); }
        done(TXT.selected);
      };
      var copy = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { done(TXT.copied); }, fallback);
        } else { fallback(); }
      };
      if (canShare) {
        navigator.share({ title: b.getAttribute('data-share-title') || document.title, url: url }).catch(function (e) {
          if (!e || e.name !== 'AbortError') copy();
        });
      } else { copy(); }
    });
  });

  // ---- talk page: live status (the HTML is built ahead of time) ----
  var head = $('.talk-head[data-start]');
  if (head) {
    var tStart = new Date(head.getAttribute('data-start')), tEnd = new Date(head.getAttribute('data-end'));
    var tNow = new Date();
    var status = $('[data-status]', head), statusLabel = $('[data-status-label]', head);
    var soon = tNow >= new Date(tStart.getTime() - 30 * 60000);
    var over = tNow > tEnd;
    var live = tNow >= tStart && !over;
    var recent = over && tNow - tEnd < 7 * 864e5;
    if (status && statusLabel) {
      statusLabel.textContent = over ? TXT.thanks : live ? TXT.onNow : soon ? TXT.startingSoon : TXT.upcoming;
      status.hidden = over && !recent;
      var dot = $('.pulse', status);
      if (dot) dot.hidden = over;
    }
    $$('[data-before]').forEach(function (e) { e.hidden = soon; });
    var note = $('[data-slides-note]');
    if (note && over) note.textContent = note.getAttribute('data-after-text');
    // two weeks on with no recording: stop promising one
    if (over && tNow - tEnd > 14 * 864e5) $$('[data-rec]').forEach(function (e) { e.hidden = true; });
  }

  // ---- stage mode (full-screen QR): Esc/Close return to where you were ----
  var stage = $('#stage');
  if (stage) {
    var fsBtn = $('[data-fullscreen]', stage);
    if (fsBtn && document.documentElement.requestFullscreen) {
      fsBtn.hidden = false;
      fsBtn.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        else document.documentElement.requestFullscreen().catch(function () {});
      });
    }
    var savedY = null, openedHere = false;
    $$('a[href="#stage"]').forEach(function (a) {
      a.addEventListener('click', function () { savedY = window.scrollY; openedHere = true; });
    });
    var closeStage = function () {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      if (openedHere) { openedHere = false; history.back(); }
      else { location.replace('#main'); }
    };
    window.addEventListener('hashchange', function () {
      if (location.hash !== '#stage' && savedY !== null) { var y = savedY; savedY = null; window.scrollTo(0, y); }
    });
    var closer = $('[data-stage-close]', stage);
    if (closer) closer.addEventListener('click', function (e) { e.preventDefault(); closeStage(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && window.location.hash === '#stage') closeStage();
    });
  }

  // ---- 404: slugs are lowercase, so retry a mistyped "/talks/PTH26/" ----
  if ($('.notfound')) {
    var lower = location.pathname.toLowerCase();
    if (lower !== location.pathname) location.replace(lower + location.search + location.hash);
  }

  // ---- next-talk countdown ----
  var next = $('[data-next]');
  if (next && next.getAttribute('data-start')) {
    var start = new Date(next.getAttribute('data-start'));
    var end = new Date(next.getAttribute('data-end') || next.getAttribute('data-start'));
    var now = new Date();
    var num = $('[data-countdown-num]', next), unit = $('[data-countdown-unit]', next), lab = $('[data-next-label]', next);
    var dayOf = function (d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
    var days = Math.round((dayOf(start) - dayOf(now)) / 864e5);
    if (now > end) { lab.textContent = TXT.latest; }
    else if (now >= start) { num.textContent = TXT.now; unit.textContent = TXT.onStage; }
    else if (days <= 0) { num.textContent = TXT.today; unit.textContent = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    else { num.textContent = String(days); unit.textContent = days === 1 ? TXT.day : TXT.days; }
  }

  // ---- explorer ----
  var grid = $('[data-grid]');
  var list = $('[data-list]');
  var input = $('#q');
  if (!grid || !list || !input) return;
  $$('[data-js-only]').forEach(function (e) { e.hidden = false; });

  var parse = function (el) {
    return {
      el: el, id: el.getAttribute('data-id'), date: el.getAttribute('data-date'),
      era: el.getAttribute('data-era'), format: el.getAttribute('data-format'),
      tag: (el.getAttribute('data-tags') || '').split('|').filter(Boolean),
      has: (el.getAttribute('data-has') || '').split(' ').filter(Boolean),
      text: el.getAttribute('data-text') || ''
    };
  };
  var cards = $$('.card[data-item]', grid).map(parse);
  var rows = $$('.row[data-item]', list).map(parse);
  var chips = $$('.chip[data-group]');
  var labelOf = function (g, v) {
    var c = chips.filter(function (x) { return x.getAttribute('data-group') === g && x.getAttribute('data-value') === v; })[0];
    var l = c && $('.chip-label', c);
    return l ? l.firstChild.textContent.trim() : v;
  };
  var ANY = { era: true, format: true };            // OR within group
  var GROUPS = ['tag', 'era', 'format', 'has'];       // tag/has: AND within group

  var state = { q: '', tag: [], era: [], format: [], has: [], sort: 'new', view: store.get('view') === 'list' ? 'list' : 'grid' };
  var params = new URLSearchParams(window.location.search);
  state.q = params.get('q') || '';
  GROUPS.forEach(function (g) { state[g] = params.getAll(g); });
  if (params.get('sort') === 'old') state.sort = 'old';
  if (params.get('view')) state.view = params.get('view') === 'list' ? 'list' : 'grid';
  input.value = state.q;

  var words = function () { return state.q.trim().toLowerCase().split(/\s+/).filter(Boolean); };
  var match = function (it, skip) {
    var w = words();
    for (var i = 0; i < w.length; i++) if (it.text.indexOf(w[i]) === -1) return false;
    for (var g = 0; g < GROUPS.length; g++) {
      var k = GROUPS[g], sel = state[k];
      if (k === skip || !sel.length) continue;
      if (ANY[k]) { if (sel.indexOf(it[k]) === -1) return false; }
      else { for (var j = 0; j < sel.length; j++) if (it[k].indexOf(sel[j]) === -1) return false; }
    }
    return true;
  };
  var has = function (it, k, v) { return ANY[k] ? it[k] === v : it[k].indexOf(v) !== -1; };

  var syncUrl = function () {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    GROUPS.forEach(function (g) { state[g].forEach(function (v) { p.append(g, v); }); });
    if (state.sort === 'old') p.set('sort', 'old');
    if (state.view === 'list') p.set('view', 'list');
    var qs = p.toString();
    try { history.replaceState(null, '', qs ? '?' + qs : window.location.pathname); } catch (e) { /* ignore */ }
  };

  var order = function () {
    var cmp = function (a, b) { return state.sort === 'new' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date); };
    cards.slice().sort(cmp).forEach(function (it) { grid.appendChild(it.el); });
    var years = $$('.year', list);
    years.sort(function (a, b) { return state.sort === 'new' ? b.getAttribute('data-year') - a.getAttribute('data-year') : a.getAttribute('data-year') - b.getAttribute('data-year'); })
      .forEach(function (y) {
        list.appendChild(y);
        var ol = $('.rows', y);
        rows.filter(function (r) { return r.el.parentNode === ol; }).sort(cmp).forEach(function (r) { ol.appendChild(r.el); });
      });
  };

  var activeBox = $('[data-active]');
  var toggle = function (g, v) {
    var i = state[g].indexOf(v);
    if (i === -1) state[g].push(v); else state[g].splice(i, 1);
    render();
  };

  var render = function () {
    var n = 0;
    cards.forEach(function (it) { var ok = match(it); it.el.hidden = !ok; if (ok) n++; });
    rows.forEach(function (it) { it.el.hidden = !match(it); });
    $$('.year', list).forEach(function (y) { y.hidden = !$$('.row:not([hidden])', y).length; });

    chips.forEach(function (c) {
      var g = c.getAttribute('data-group'), v = c.getAttribute('data-value');
      var on = state[g].indexOf(v) !== -1;
      var cnt = cards.filter(function (it) { return ANY[g] ? match(it, g) && has(it, g, v) : match(it) && has(it, g, v); }).length;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      $('[data-count]', c).textContent = cnt;
      c.disabled = !on && cnt === 0;
    });
    $$('.tag[data-tag]').forEach(function (t) { t.setAttribute('aria-pressed', state.tag.indexOf(t.getAttribute('data-tag')) !== -1 ? 'true' : 'false'); });

    $('[data-result-count]').textContent = n;
    $('[data-result-noun]').textContent = n === 1 ? TXT.session : TXT.sessions;
    $('[data-empty]').hidden = n !== 0;

    activeBox.textContent = '';
    var add = function (label, onRemove) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'active-chip';
      b.setAttribute('aria-label', TXT.remove + label);
      b.textContent = label + ' ✕';
      b.addEventListener('click', onRemove);
      activeBox.appendChild(b);
    };
    if (state.q) add('“' + state.q + '”', function () { state.q = ''; input.value = ''; render(); });
    GROUPS.forEach(function (g) {
      state[g].forEach(function (v) {
        add(g === 'has' ? TXT.has[v] || v : labelOf(g, v), function () { toggle(g, v); });
      });
    });
    if (activeBox.children.length) {
      var clr = document.createElement('button');
      clr.type = 'button'; clr.className = 'clear'; clr.textContent = TXT.clear;
      clr.addEventListener('click', clearAll);
      activeBox.appendChild(clr);
    }

    var isList = state.view === 'list';
    grid.hidden = isList || n === 0;
    list.hidden = !isList || n === 0;
    $$('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === state.view ? 'true' : 'false'); });
    $('[data-sort]').textContent = state.sort === 'new' ? TXT.newest : TXT.oldest;
    syncUrl();
  };

  var clearAll = function () {
    state.q = ''; input.value = '';
    GROUPS.forEach(function (g) { state[g] = []; });
    render();
  };

  chips.forEach(function (c) { c.addEventListener('click', function () { toggle(c.getAttribute('data-group'), c.getAttribute('data-value')); }); });
  $$('.tag[data-tag]').forEach(function (t) { t.addEventListener('click', function () { toggle('tag', t.getAttribute('data-tag')); }); });
  $$('[data-clear]').forEach(function (b) { b.addEventListener('click', clearAll); });
  $$('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); store.set('view', state.view); render(); });
  });
  $('[data-sort]').addEventListener('click', function () { state.sort = state.sort === 'new' ? 'old' : 'new'; order(); render(); });
  input.addEventListener('input', function () { state.q = input.value; render(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { state.q = ''; input.value = ''; render(); } });
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); input.focus(); }
  });

  order();
  render();
})();
