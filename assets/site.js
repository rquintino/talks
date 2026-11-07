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
    copied: 'Copiado ✓', selected: 'Selecionado — prime Ctrl/⌘+C', copy: 'Copiar link da página', share: 'Partilhar esta página',
    showN: function (n) { return 'Ver ' + n + (n === 1 ? ' sessão' : ' sessões'); },
    upcoming: 'Em breve', startingSoon: 'Começa em breve', onNow: 'A decorrer', thanks: 'Obrigado pela presença',
    latest: 'Última palestra', now: 'Agora', until: function (t) { return 'ATÉ ÀS ' + t; }, today: 'Hoje', day: 'DIA RESTANTE', days: 'DIAS RESTANTES',
    emptyQ: function (q) { return 'Nenhuma palestra corresponde a “' + q + '”'; },
    session: 'sessão', sessions: 'sessões', newest: 'Mais recentes primeiro ↓', oldest: 'Mais antigas primeiro ↑',
    remove: 'Remover filtro: ', clear: 'Limpar tudo', has: { slides: 'Com slides', video: 'Com vídeo', audio: 'Com áudio' }
  } : {
    dark: '☾ Dark', light: '☀ Light', switchTo: function (n) { return 'Switch to ' + n + ' theme'; },
    copied: 'Copied ✓', selected: 'Selected — press Ctrl/⌘+C', copy: 'Copy page link', share: 'Share this page',
    showN: function (n) { return 'Show ' + n + (n === 1 ? ' session' : ' sessions'); },
    upcoming: 'Upcoming', startingSoon: 'Starting soon', onNow: 'On now', thanks: 'Thanks for joining',
    latest: 'Latest talk', now: 'Now', until: function (t) { return 'UNTIL ' + t; }, today: 'Today', day: 'DAY TO GO', days: 'DAYS TO GO',
    emptyQ: function (q) { return 'No talks match “' + q + '”'; },
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
  var toast = $('[data-fb-toast]');
  var openedEarly = null; // page opened before the feedback window: those visitors get the toast
  var toastKey = head ? 'fb-toast:' + head.getAttribute('data-id') : '';
  if (toast) $$('[data-toast-done]', toast).forEach(function (b) {
    b.addEventListener('click', function () { toast.hidden = true; document.body.classList.remove('has-toast'); store.set(toastKey, '1'); });
  });
  var applyPhase = function () {
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
      if (dot) dot.hidden = over || !soon;
    }
    var lead = parseInt(head.getAttribute('data-fb-lead'), 10) || 10;
    var fbWin = tNow >= new Date(tEnd.getTime() - lead * 60000);
    document.documentElement.setAttribute('data-phase', !soon ? 'before' : !fbWin ? 'live' : over ? 'over' : 'fb');
    if (openedEarly === null) openedEarly = !fbWin;
    // toast only once the session has ended: nothing pulls attention to the phone during the talk
    if (toast) {
      toast.hidden = !(openedEarly && over && tNow - tEnd < 3 * 36e5 && !store.get(toastKey));
      document.body.classList.toggle('has-toast', !toast.hidden);
    }
    var note = $('[data-slides-note]');
    if (note && over) note.textContent = note.getAttribute('data-after-text');
    // two weeks on with no recording: stop promising one
    if (over && tNow - tEnd > 14 * 864e5 && $('[data-rec]')) {
      $$('[data-rec]').forEach(function (e) { e.hidden = true; });
      $$('.mat .mat-k').forEach(function (e) { e.hidden = true; });
      var mh = $('[data-only-slides]');
      if (mh) mh.textContent = mh.getAttribute('data-only-slides');
    }
  };
  if (head) {
    applyPhase();
    setInterval(applyPhase, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) applyPhase(); });
    window.addEventListener('pageshow', applyPhase);
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
    var savedY = null, openedHere = false, opener = null;
    var bg = function () { return $$('body > :not(#stage)'); };
    var syncStage = function () {
      var open = location.hash === '#stage';
      bg().forEach(function (e) { if (open) e.setAttribute('inert', ''); else e.removeAttribute('inert'); });
      if (open) { var c = $('[data-stage-close]', stage); if (c) c.focus(); }
      else if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    };
    $$('a[href="#stage"]').forEach(function (a) {
      a.addEventListener('click', function () { savedY = window.scrollY; openedHere = true; opener = a; });
    });
    var closeStage = function () {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      if (openedHere) { openedHere = false; history.back(); }
      else { location.replace('#main'); }
    };
    window.addEventListener('hashchange', function () {
      if (location.hash !== '#stage' && savedY !== null) { var y = savedY; savedY = null; window.scrollTo(0, y); }
      syncStage();
    });
    syncStage();
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
  var orig = null;
  var paintNext = function () {
    var start = new Date(next.getAttribute('data-start'));
    var end = new Date(next.getAttribute('data-end') || next.getAttribute('data-start'));
    var now = new Date();
    var num = $('[data-countdown-num]', next), unit = $('[data-countdown-unit]', next), lab = $('[data-next-label]', next);
    if (!orig) orig = { num: num.textContent, unit: unit.textContent };
    var dayOf = function (d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
    var days = Math.round((dayOf(start) - dayOf(now)) / 864e5);
    var hhmm = function (d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Lisbon' }); };
    var pulse = $('.pulse', next);
    if (pulse) pulse.hidden = !(now >= new Date(start.getTime() - 30 * 60000) && now <= end);
    if (now >= start) {
      $$('[data-live-text]', next).forEach(function (a) { a.textContent = a.getAttribute('data-live-text'); });
      $$('[data-ics]', next).forEach(function (e) { e.hidden = true; });
    }
    if (now > end) {
      // back to the build-time date in the tile
      num.textContent = orig.num; unit.textContent = orig.unit;
      lab.textContent = TXT.latest;
      $$('.card.is-next').forEach(function (c) { c.classList.remove('is-next'); $$('.badge, .badge-txt', c).forEach(function (bd) { bd.parentNode.removeChild(bd); }); });
    }
    else if (now >= start) { num.textContent = TXT.now; unit.textContent = TXT.until(hhmm(end)); lab.textContent = TXT.onNow; }
    else if (days <= 0) { num.textContent = TXT.today; unit.textContent = hhmm(start); }
    else { num.textContent = String(days); unit.textContent = days === 1 ? TXT.day : TXT.days; }
  };
  if (next && next.getAttribute('data-start')) {
    paintNext();
    setInterval(paintNext, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) paintNext(); });
    window.addEventListener('pageshow', paintNext);
  }

  // ---- explorer ----
  var grid = $('[data-grid]');
  var list = $('[data-list]');
  var input = $('#q');
  if (!grid || !list || !input) return;
  $$('[data-js-only]').forEach(function (e) { e.hidden = false; });
  $$('span.tag[data-tag]').forEach(function (sp) {
    var bt = document.createElement('button');
    bt.type = 'button'; bt.className = sp.className; bt.textContent = sp.textContent;
    bt.setAttribute('data-tag', sp.getAttribute('data-tag'));
    sp.parentNode.replaceChild(bt, sp);
  });

  var parse = function (el) {
    return {
      el: el, id: el.getAttribute('data-id'), date: el.getAttribute('data-date'),
      era: el.getAttribute('data-era'), format: el.getAttribute('data-format'),
      tag: (el.getAttribute('data-tags') || '').split('|').filter(Boolean),
      has: (el.getAttribute('data-has') || '').split(' ').filter(Boolean),
      text: el.getAttribute('data-text') || '',
      tokens: (el.getAttribute('data-text') || '').split(/[^a-z0-9]+/).filter(Boolean)
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

  var fold = function (s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
  var words = function () { return fold(state.q.trim()).split(/\s+/).filter(Boolean); };
  var match = function (it, skip) {
    var w = words();
    // short words match the start of a word ("ai" must not hit "ajax"); longer ones match anywhere
    for (var i = 0; i < w.length; i++) {
      if (w[i].length >= 4) { if (it.text.indexOf(w[i]) === -1) return false; }
      else if (!it.tokens.some(function (tk) { return tk.indexOf(w[i]) === 0; })) return false;
    }
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
    $$('.lang-switch').forEach(function (a) {
      var base = a.getAttribute('data-base') || a.getAttribute('href');
      a.setAttribute('data-base', base);
      a.setAttribute('href', base + (qs ? '?' + qs : ''));
    });
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
  var bannerId = (function () { var n = $('[data-next]'); return n ? n.getAttribute('data-id') : null; })();
  var emptyTitle = $('[data-empty] .empty-title'), emptyDefault = emptyTitle ? emptyTitle.textContent : '';
  var panel = $('#filters'), filtersBtn = $('[data-filters-toggle]'), doneBtn = $('[data-filters-done]'), filtersN = $('[data-filters-n]');
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 999px)') : { matches: false };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toResults = function () { if (narrow.matches) $('.results').scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }); };
  var setPanel = function (open) {
    if (!panel || !filtersBtn) return;
    panel.classList.toggle('is-open', open);
    filtersBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) $('.search').scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
  };
  if (filtersBtn) filtersBtn.addEventListener('click', function () { setPanel(!panel.classList.contains('is-open')); });
  if (doneBtn) doneBtn.addEventListener('click', function () { setPanel(false); toResults(); var c = $('.count'); if (c) c.focus({ preventScroll: true }); });
  var toggle = function (g, v) {
    var i = state[g].indexOf(v);
    if (i === -1) state[g].push(v); else state[g].splice(i, 1);
    render();
  };

  var render = function () {
    var n = 0;
    var plain = !state.q && GROUPS.every(function (g) { return !state[g].length; });
    cards.forEach(function (it) { var ok = match(it); it.el.hidden = !ok || (plain && narrow.matches && it.el.getAttribute('data-id') === bannerId); if (ok) n++; });
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
    if (doneBtn) doneBtn.textContent = TXT.showN(n);
    if (filtersN) {
      var k = GROUPS.reduce(function (a, g) { return a + state[g].length; }, 0);
      filtersN.textContent = k; filtersN.hidden = !k;
    }
    $('[data-result-noun]').textContent = n === 1 ? TXT.session : TXT.sessions;
    $('[data-empty]').hidden = n !== 0;
    if (emptyTitle) emptyTitle.textContent = state.q && GROUPS.every(function (g) { return !state[g].length; }) ? TXT.emptyQ(state.q) : emptyDefault;

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
  $$('.tag[data-tag]').forEach(function (t) { t.addEventListener('click', function () { toggle('tag', t.getAttribute('data-tag')); toResults(); }); });
  $$('[data-clear]').forEach(function (b) { b.addEventListener('click', clearAll); });
  $$('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); store.set('view', state.view); render(); });
  });
  $('[data-sort]').addEventListener('click', function () { state.sort = state.sort === 'new' ? 'old' : 'new'; order(); render(); });
  input.addEventListener('input', function () { state.q = input.value; render(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { state.q = ''; input.value = ''; render(); }
    if (e.key === 'Enter') { input.blur(); toResults(); }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); input.focus(); }
  });

  order();
  render();
})();
