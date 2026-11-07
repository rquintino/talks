// Static site builder for rquintino.github.io/talks
// Node.js standard library ONLY (see CLAUDE.md, rule 2). Output is committed.
//
//   node tools/build.mjs          build HTML, .ics and sitemap
//   node tools/build.mjs --og     also render 1200x630 social cards with a local
//                                 Chrome/Chromium (set CHROME_PATH if not found)

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// GitHub Pages lets browsers cache assets for ~10 minutes; a content hash in the URL
// makes a new page always load the CSS/JS it was built with.
const v = (rel) => createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex').slice(0, 10);
const VER = { css: v('assets/site.css'), theme: v('assets/theme.js'), js: v('assets/site.js'), photo: v('assets/rui.webp') };
const site = JSON.parse(readFileSync(join(ROOT, 'data/site.json'), 'utf8'));
const talks = JSON.parse(readFileSync(join(ROOT, 'data/talks.json'), 'utf8'));
const NOW = new Date();

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAYS_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// ---------- languages (EN at /talks/, pt-PT at /talks/pt/) ----------
const UI = JSON.parse(readFileSync(join(ROOT, 'data/ui.json'), 'utf8'));
let LANG = 'en';      // language being rendered
let ASSET = './';     // relative path to /talks/ (assets live there)
let LANGBASE = site.baseUrl; // absolute base URL of the current language
let SWITCH = 'pt/';   // relative link to the same page in the other language
let ALT = { en: site.baseUrl, pt: `${site.baseUrl}pt/` };
let S = site;         // localized site.json view
const T = (k) => { const v = UI[LANG][k] ?? UI.en[k]; if (v == null) throw new Error(`ui.json: missing key ${k}`); return v; };
const tagLabel = (g) => (UI[LANG].tags || {})[g] || g;
const fmtLabel = (f) => (UI[LANG].formats || {})[f] || f;
const langName = (l) => (UI[LANG].languages || {})[l] || l;
function loc(t) {
  if (LANG === 'en' || !t.pt) return { ...t, _orig: t };
  const r = { ...t, ...t.pt, _orig: t };
  if (t.resources) r.resources = t.resources.map((x) => ({ ...x, note: x.note_pt || x.note }));
  return r;
}
function setLang(l) {
  LANG = l;
  LANGBASE = l === 'en' ? site.baseUrl : `${site.baseUrl}pt/`;
  S = l === 'en' ? site : { ...site, ...site.pt, quietLink: { ...site.quietLink, ...((site.pt || {}).quietLink || {}) } };
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wbr = (s) => esc(s).replace(/\//g, '/<wbr>');
const ext = (url, label, cls = '') => `<a class="${cls}" href="${esc(url)}" rel="noopener noreferrer">${label}</a>`;
const year = (t) => Number(t.date.slice(0, 4));
const eraOf = (t) => (year(t) >= 2024 ? 'agentic' : year(t) >= 2015 ? 'data' : 'early');
const ERAS = [
  ['agentic', 'Agentic AI', '2024 →'],
  ['data', 'Data & ML', '2015 – 2023'],
  ['early', 'Early days', '→ 2014'],
];
function dateLabel(t) {
  const [y, m, d] = t.date.split('-');
  if (d) {
    const dt = new Date(Date.UTC(+y, +m - 1, +d));
    return LANG === 'pt' ? `${DAYS_PT[dt.getUTCDay()]}, ${+d} ${MONTHS_PT[+m - 1]} ${y}` : `${DAYS[dt.getUTCDay()]} ${+d} ${MONTHS[+m - 1]} ${y}`;
  }
  if (m) return `${(LANG === 'pt' ? MONTHS_PT : MONTHS)[+m - 1]} ${y}`;
  return y;
}
const shortDate = (t) => {
  const [, m, d] = t.date.split('-');
  const M = LANG === 'pt' ? MONTHS_PT : MONTHS;
  return d ? `${+d} ${M[+m - 1]}` : m ? M[+m - 1] : '';
};
const isUpcoming = (t) => t.end ? new Date(t.end) > NOW : false;
const sorted = [...talks].sort((a, b) => b.date.localeCompare(a.date));
const materials = (t) => [t.slides && 'slides', t.video && 'video', t.audio && 'audio'].filter(Boolean);
const mainHref = (t, prefix) => (t.page ? `${prefix}${t.id}/` : t.slides || t.audio || t.video || t.eventUrl || null);
const CITY_PT = { Lisbon: 'Lisboa' };
const city = (c) => (c && LANG === 'pt' && CITY_PT[c]) || c;
const where = (t) => [t.venue, city(t.city)].filter(Boolean).join(', ');

function linksHtml(t, prefix) {
  const out = [];
  if (t.page) out.push(`<a class="lnk" href="${prefix}${t.id}/">${T('talkPage')}</a>`);
  if (t.slides) out.push(ext(t.slides, T('slides'), 'lnk'));
  if (t.video) out.push(ext(t.video, T('video'), 'lnk'));
  if (t.audio) out.push(ext(t.audio, T('listen'), 'lnk'));
  if (t.eventUrl) out.push(ext(t.eventUrl, T('event'), 'lnk lnk-quiet'));
  const recent = t.end && NOW - new Date(t.end) < 30 * 864e5;
  return out.length ? out.join('') : isUpcoming(t) || recent ? `<span class="muted">${T('soon')}</span>` : '';
}

function head({ title, description, prefix, canonical, og, htmlAttrs = '' }) {
  return `<!doctype html>
<html lang="${T('htmlLang')}"${htmlAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">${site.noindex ? '\n<meta name="robots" content="noindex">' : ''}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="en" href="${esc(ALT.en)}">
<link rel="alternate" hreflang="pt-PT" href="${esc(ALT.pt)}">
<link rel="alternate" hreflang="x-default" href="${esc(ALT.en)}">
<meta property="og:locale" content="${T('ogLocale')}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(og)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${ASSET}assets/icon.svg" type="image/svg+xml">
<link rel="preload" href="${ASSET}assets/fonts/sora.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${ASSET}assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ASSET}assets/site.css?v=${VER.css}">
<script src="${ASSET}assets/theme.js?v=${VER.theme}"></script>
<script src="${ASSET}assets/site.js?v=${VER.js}" defer></script>
</head>`;
}

function header(prefix) {
  return `<a class="skip" href="#main">${T('skip')}</a>
<header class="top wrap">
  <a class="brand" href="${prefix}"><span class="brand-name">${esc(site.name)}</span><span class="brand-path">/talks</span></a>
  <nav class="top-nav" aria-label="${T('profiles')}">
    ${site.links.map((l) => ext(l.url, `${esc(l.label)} ↗`)).join('\n    ')}
    <a class="lang-switch" href="${SWITCH}" hreflang="${T('otherLang')}" lang="${T('otherLang')}" aria-label="${T('switchAria')}">${T('switchLabel')}</a>
    <button class="theme-btn" type="button" data-theme-toggle hidden aria-label="${T('themeAria')}"><span class="theme-ico" data-theme-icon aria-hidden="true"></span><span class="theme-txt" data-theme-label>${T('theme')}</span></button>
  </nav>
</header>`;
}

function footer() {
  const q = S.quietLink;
  return `<footer class="foot wrap">
  <div class="foot-id"><strong>${esc(site.name)}</strong><span><span class="about-label">${T('about')}</span> ${esc(S.tagline)}</span></div>
  <div class="foot-links">
    ${site.links.map((l) => ext(l.url, esc(l.label))).join('\n    ')}
    <span class="quiet">${esc(q.text)} ${ext(q.url, esc(q.label))}</span>
  </div>
</footer>`;
}

function tagButtons(t) {
  return t.tags.map((g) => `<span class="tag" data-tag="${esc(g)}">${esc(tagLabel(g))}</span>`).join('');
}

function dataAttrs(t) {
  const o = t._orig || t, p = o.pt || {};
  const MAT_WORDS = { slides: 'slides diapositivos', video: 'video vídeo', audio: 'audio áudio podcast' };
  const text = [o.id, o.title, o.event, o.city, CITY_PT[o.city], o.venue, ...materials(o).map((m) => MAT_WORDS[m]), o.track, o.format, o.language, o.summary, ...(o.tags || []), ...(o.abstract || []),
    p.title, p.event, p.summary, ...(p.abstract || []), fmtLabel(o.format), ...(o.tags || []).map(tagLabel)]
    .filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `data-item data-id="${esc(t.id)}" data-date="${esc(t.date)}" data-era="${eraOf(t)}" data-format="${esc(t.format)}" data-tags="${esc(t.tags.join('|'))}" data-has="${materials(t).join(' ')}" data-text="${esc(text)}"`;
}

function card(t, prefix) {
  const href = mainHref(t, prefix);
  const internal = t.page;
  const badge = isUpcoming(t) ? `<span class="badge">${T('nextBadge')}</span>` : t.first ? `<span class="badge">${T('first')}</span>` : '';
  const cover = `<span class="cover-top"><span>${esc(fmtLabel(t.format))}${t.language && t.language.toLowerCase() !== LANG ? ' · ' + esc(langName(t.language)) : ''}</span>${badge}</span><span class="cover-title">${esc(t.short || t.title)}</span>`;
  const coverEl = href
    ? internal ? `<a class="cover tone-${eraOf(t)}" href="${href}" tabindex="-1" aria-hidden="true">${cover}</a>` : `<a class="cover tone-${eraOf(t)}" href="${esc(href)}" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${cover}</a>`
    : `<div class="cover tone-${eraOf(t)}" aria-hidden="true">${cover}</div>`;
  const titleEl = href
    ? internal ? `<a href="${href}">${esc(t.title)}</a>` : `<a href="${esc(href)}" rel="noopener noreferrer">${esc(t.title)}&nbsp;↗</a>`
    : esc(t.title);
  const details = t.abstract
    ? `<details class="peek"><summary>${T('details')}</summary>
        ${(t.abstract || (t.summary ? [t.summary] : [])).map((p) => `<p>${esc(p)}</p>`).join('')}
        <dl>
          <dt>${T('when')}</dt><dd>${esc(dateLabel(t))}${t.time ? ' · ' + esc(t.time) : ''}</dd>
          ${where(t) ? `<dt>${T('where')}</dt><dd>${esc(where(t))}</dd>` : ''}
          ${t.track ? `<dt>${T('track')}</dt><dd>${esc(t.track)}</dd>` : ''}
          ${t.level ? `<dt>${T('level')}</dt><dd>${esc((UI[LANG].levels || {})[t.level] || t.level)}</dd>` : ''}
        </dl>
      </details>`
    : '';
  return `<li class="card${isUpcoming(t) ? ' is-next' : ''}" ${dataAttrs(t)}>
    ${coverEl}
    <div class="card-body">
      <p class="meta mono"><span class="meta-fmt">${esc(fmtLabel(t.format))}${t.language && t.language.toLowerCase() !== LANG ? ' · ' + esc(langName(t.language)) : ''}${badge ? `<span class="badge-txt"> · ${badge.replace(/<[^>]+>/g, '')}</span>` : ''} · </span>${esc(dateLabel(t))}${t.city ? ' · ' + esc(city(t.city)) : ''}${t.verified ? '' : ` · <span class="unverified" title="${T('toConfirmTitle')}">${T('toConfirm')}</span>`}</p>
      <h3 class="card-title">${titleEl}</h3>
      <p class="card-event">${esc(t.event)}</p>
      ${t.summary ? `<p class="card-sum">${esc(t.summary)}</p>` : ''}
      <div class="tags">${tagButtons(t)}</div>
      <div class="links">${linksHtml(t, prefix)}</div>
      ${details}
    </div>
  </li>`;
}

function row(t, prefix) {
  const href = mainHref(t, prefix);
  const title = href ? (t.page ? `<a href="${href}">${esc(t.title)}</a>` : `<a href="${esc(href)}" rel="noopener noreferrer">${esc(t.title)}&nbsp;↗</a>`) : esc(t.title);
  return `<li class="row" ${dataAttrs(t)}>
      <span class="row-date mono">${esc(shortDate(t))}</span>
      <div class="row-main"><span class="row-title">${title}</span><span class="row-sub">${esc(t.event)}${t.city ? ' · ' + esc(city(t.city)) : ''} · ${esc(fmtLabel(t.format))}${t.verified ? '' : ` · <span class="unverified">${T('toConfirm')}</span>`}</span></div>
      <div class="row-links">${linksHtml(t, prefix)}</div>
    </li>`;
}

function chip(group, value, label, count, extra = '') {
  return `<button type="button" class="chip" data-group="${group}" data-value="${esc(value)}" aria-pressed="false">${extra}<span class="chip-label">${esc(label)}</span><span class="chip-count mono" data-count>${count}</span></button>`;
}

// ---------- pages ----------
function homePage() {
  const prefix = './';
  const nextRaw = sorted.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date))[0]
    || sorted.find((t) => t.page);
  const next = nextRaw ? loc(nextRaw) : null;
  const years = [...new Set(talks.map(year))];
  const events = new Set(talks.map((t) => t.event.split(' ·')[0].replace(/ #\d+$/, ''))).size;
  const stats = `${talks.length} ${T('sessions')} · ${Math.min(...years)} → ${Math.max(...years)} · ${events} ${T('eventsAndCommunities')}`;
  const tagCounts = {};
  talks.forEach((t) => t.tags.forEach((g) => { tagCounts[g] = (tagCounts[g] || 0) + 1; }));
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const formats = [...new Set(talks.map((t) => t.format))];
  const count = (fn) => talks.filter(fn).length;
  const groups = [];
  sorted.forEach((t) => { const y = String(year(t)); let g = groups.find((x) => x.y === y); if (!g) groups.push((g = { y, items: [] })); g.items.push(t); });

  const nextHtml = next ? `<div class="wrap next-wrap"><section class="next" aria-labelledby="next-title" data-next data-id="${esc(next.id)}" data-start="${esc(next.start || '')}" data-end="${esc(next.end || '')}">
  <div class="next-count tone-agentic" aria-hidden="true"><span class="next-num" data-countdown-num>${esc(shortDate(next))}</span><span class="next-unit mono" data-countdown-unit>${esc(next.date.slice(0, 4))}</span></div>
  <div class="next-main">
    <p class="eyebrow mono"><span class="pulse" aria-hidden="true" hidden>●</span> <span data-next-label>${isUpcoming(next) ? T('nextTalk') : T('latestTalk')}</span> · <span class="nw d-long">${esc(dateLabel(next))}</span><span class="nw d-short">${esc(shortDate(next))}</span>${next.time ? ` · <span class="nw">${esc(next.time)}</span>` : ''}</p>
    <h2 id="next-title" class="next-title"><a href="${prefix}${next.id}/">${esc(next.title)}</a></h2>
    <p class="next-sub">${esc(next.event)} · ${esc(where(next))}${next.track ? ' · ' + esc(next.track) : ''}</p>
  </div>
  <div class="next-actions">
    <a class="btn btn-primary" href="${prefix}${next.id}/" data-live-text="${esc(T('liveBtn'))}">${T('talkPageBtn')}</a>
    ${next.start && isUpcoming(next) ? `<a class="btn" href="${prefix}${next.id}/talk.ics" data-ics>${T('addCal')}</a>` : ''}
  </div>
  <a class="next-qr" href="${prefix}${next.id}/#stage" title="${T('qrFull')}">${qrSvg(`${LANGBASE}${next.id}/`, `${T('qrLabel')} ${next.title}`)}<span class="mono">${T('scanMe')}</span></a>
</section></div>` : '';

  return `${head({ title: `${T('titleHome')} · ${site.name}`, description: S.description, prefix, canonical: LANGBASE, og: `${site.baseUrl}og/${LANG === 'pt' ? 'pt/' : ''}home.png` })}
<body>
${header(prefix)}
<main id="main">
<section class="intro wrap">
  <div class="intro-head"><img class="avatar" src="${ASSET}assets/rui.webp?v=${VER.photo}" width="72" height="72" alt="${esc(site.name)}"><h1 class="intro-title">${T('titleHome')}</h1></div>
  <p class="intro-tagline"><span class="about-label">${T('about')}</span> ${esc(S.tagline)}</p>
  <p class="intro-stats mono">${esc(stats)}</p>
</section>
${nextHtml}
<section class="explore wrap" aria-label="${T('allTalks')}">
  <div class="search" data-js-only hidden>
    <label class="search-box" for="q">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <span class="sr-only">${T('searchSr')}</span>
      <input id="q" type="search" placeholder="${T('searchPh')}" autocomplete="off" spellcheck="false">
      <kbd class="mono" aria-hidden="true">/</kbd>
    </label>
    <button type="button" class="btn filters-btn" data-filters-toggle aria-expanded="false" aria-controls="filters">${T('filters')} <span class="q-count mono" data-filters-n hidden></span></button>
  </div>
  <div class="layout">
    <aside class="filters" id="filters" data-js-only hidden aria-label="${T('filters')}">
      <div class="fgroup"><h2 class="fhead mono">${T('eraH')}</h2><div class="fstack">
        ${ERAS.map(([k, , span]) => chip('era', k, T('era_' + k), count((t) => eraOf(t) === k), '').replace(`${esc(T('era_' + k))}</span>`, `${esc(T('era_' + k))} <span class="chip-span">${span}</span></span>`)).join('\n        ')}
      </div></div>
      <div class="fgroup"><h2 class="fhead mono">${T('topicsH')}</h2><div class="fwrap">
        ${tags.map(([g, n]) => chip('tag', g, tagLabel(g), n)).join('\n        ')}
      </div></div>
      <div class="fgroup"><h2 class="fhead mono">${T('formatH')}</h2><div class="fwrap">
        ${formats.map((f) => chip('format', f, fmtLabel(f), count((t) => t.format === f))).join('\n        ')}
      </div></div>
      <div class="fgroup"><h2 class="fhead mono">${T('materialsH')}</h2><div class="fwrap">
        ${[['slides', T('slidesF')], ['video', T('videoF')], ['audio', T('audioF')]].filter(([k]) => count((t) => materials(t).includes(k))).map(([k, l]) => chip('has', k, l, count((t) => materials(t).includes(k)))).join('\n        ')}
      </div></div>
      <button type="button" class="btn btn-primary filters-done" data-filters-done>${T('filters')}</button>
    </aside>
    <div class="results">
      <div class="toolbar">
        <div class="status"><p class="count" aria-live="polite" tabindex="-1"><strong data-result-count>${talks.length}</strong> <span data-result-noun>${T('sessions')}</span></p><div class="active" data-active></div></div>
        <div class="controls" data-js-only hidden>
          <button type="button" class="btn btn-small" data-sort>${T('newest')}</button>
          <div class="seg" role="group" aria-label="${T('layout')}">
            <button type="button" class="seg-btn" data-view="grid" aria-pressed="false">${T('cards')}</button>
            <button type="button" class="seg-btn" data-view="list" aria-pressed="true">${T('timeline')}</button>
          </div>
        </div>
      </div>
      <div class="empty" data-empty hidden>
        <p class="empty-title">${T('emptyT')}</p>
        <p>${T('emptyP')}</p>
        <button type="button" class="btn btn-primary" data-clear>${T('showAll')}</button>
      </div>
      <ul class="grid" data-grid hidden>
        ${sorted.map((t) => card(loc(t), prefix)).join('\n        ')}
      </ul>
      <div class="timeline" data-list>
        ${groups.map((g) => `<section class="year" data-year="${g.y}"><h3 class="year-label">${g.y}</h3><ol class="rows">
      ${g.items.map((t) => row(loc(t), prefix)).join('\n      ')}
    </ol></section>`).join('\n        ')}
      </div>
    </div>
  </div>
</section>
</main>
${footer()}
</body>
</html>
`;
}

function gcalUrl(t, url) {
  const z = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${t.title} (${site.name})`, dates: `${z(t.start)}/${z(t.end)}`, details: url, location: where(t) });
  // keep the slash between the two dates literal, as Google documents it
  return `https://calendar.google.com/calendar/render?${q.toString().replace(/(dates=[0-9TZ]+)%2F/, "$1/")}`;
}

function talkPage(t) {
  const prefix = '../';
  const url = `${LANGBASE}${t.id}/`;
  const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[\s,;:.—–-]+$/, '') + '…');
  const desc = t.abstract ? clip(t.abstract.join(' '), 155) : `${t.title} · ${t.event}`;
  const related = sorted.filter((o) => o.id !== t.id && o.tags.some((g) => t.tags.includes(g))).slice(0, 3).map(loc);
  const upcoming = isUpcoming(t);
  const shortUrl = url.replace('https://', '').replace(/\/$/, '');
  const qr = qrSvg(url, `${T('qrLabel')} ${shortUrl}`);
  const nres = (t.resources || []).length;
  // One scannable line instead of seven boxes: date · time · venue · track.
  const metaBits = [dateLabel(t), t.time, where(t), t.track && T('trackMeta').replace('{t}', t.track)].filter(Boolean).map((v) => `<span>${esc(v)}</span>`);
  const details = [
    [T('level'), t.level ? (UI[LANG].levels || {})[t.level] || t.level : ''],
    [T('formatL'), fmtLabel(t.format)],
    [T('languageL'), t.language ? langName(t.language) : ''],
  ].filter(([, v]) => v);
  const orig = t._orig || t;
  const showOrig = LANG === 'pt' && t.language && !/^pt/i.test(t.language) && orig.title !== t.title;
  // Time-aware bits: rendered for the build moment, then corrected in the browser (site.js) from data-start/data-end.
  const timeAttrs = t.start && t.end ? ` data-start="${esc(t.start)}" data-end="${esc(t.end)}" data-fb-lead="${t.feedbackLead ?? 10}" data-id="${esc(t.id)}"` : '';
  const primary = t.feedback ? ext(t.feedback, T('fbBtn'), 'btn btn-primary q-fb').replace('<a ', '<a data-fb-window ')
    : t.slides ? ext(t.slides, T('openSlides'), 'btn btn-primary q-fb') : '';
  const slidesBtn = t.slides ? ext(t.slides, `${T('qSlides')} ↗`, 'btn') : `<a class="btn" href="#mat">${T('qSlides')}</a>`;
  const relHref = (o) => mainHref(o, prefix);
  return `${head({ title: `${t.title} · ${site.name}`, description: desc, prefix, canonical: url, og: `${site.baseUrl}og/${LANG === 'pt' ? 'pt/' : ''}${t.id}.png`, htmlAttrs: t.start && t.end ? ` data-talk-start="${esc(t.start)}" data-talk-end="${esc(t.end)}" data-fb-lead="${t.feedbackLead ?? 10}"` : '' })}
<body class="talk-page">
${header(prefix)}
<main id="main" class="wrap talk-layout">
<div class="talk">
  <p class="crumb"><a href="${prefix}">${T('crumb')}</a></p>
  <header class="talk-head"${timeAttrs}>
    <p class="eyebrow mono"><span data-status hidden><span class="pulse" aria-hidden="true">●</span> <span data-status-label>${T('upcoming')}</span> · </span>${t.eventUrl ? ext(t.eventUrl, esc(t.event), 'eyebrow-link') : esc(t.event)}</p>
    <h1 class="talk-title">${esc(t.title)}</h1>
    ${showOrig ? `<p class="orig-title"><strong>${T('sessionIn').replace('{l}', langName(t.language).toLowerCase())}</strong> · <span lang="en">${esc(orig.title)}</span></p>` : ''}
    <p class="talk-meta">${metaBits.join('<span class="sep" aria-hidden="true"> · </span>')}</p>
    <nav class="quick" aria-label="${T('quickNav')}">
      ${upcoming && t.start ? `<a class="btn btn-primary q-fb" href="talk.ics" data-before>${T('addCal')}</a>${ext(gcalUrl(t, url), T('gcal'), 'lnk q-alt').replace('<a ', '<a data-before ')}` : ''}
      ${primary}
      ${slidesBtn}
      <a class="btn" href="#res">${T('qRes')}${nres ? ` <span class="q-count mono">${nres}</span>` : ''}</a>
    </nav>
  </header>

  <section class="talk-section" aria-labelledby="abs">
    <h2 id="abs" class="section-title">${t.abstract ? T('abstract') : T('summary')}</h2>
    <div class="prose">${(t.abstract || (t.summary ? [t.summary] : [])).map((p) => `<p>${esc(p)}</p>`).join('\n      ')}</div>
    ${LANG === 'pt' && t.abstractTranslated ? `<p class="note">${T('translated')}</p>` : ''}
  </section>

  <section class="talk-section materials" id="mat" aria-labelledby="mat-h">
    <h2 id="mat-h" class="section-title" data-only-slides="${esc(T('slidesF'))}">${T('slidesRec')}</h2>
    <div class="mat-grid">
      <div class="mat">
        <p class="mat-k mono">${T('slidesF')}</p>
        ${t.slides ? ext(t.slides, T('openSlides'), 'btn btn-primary') : `<p class="muted" data-slides-note data-after-text="${esc(T('slidesSoon'))}">${upcoming ? T('slidesAfter') : T('slidesSoon')}</p><p class="muted save-hint">${T('saveHint')}</p><button type="button" class="btn btn-small" data-copy="${esc(url)}" data-share-title="${esc(t.title)}" hidden>${T('copy')}</button>`}
      </div>
      <div class="mat"${t.video ? '' : ' data-rec'}>
        <p class="mat-k mono">${T('recording')}</p>
        ${t.video ? ext(t.video, T('watch'), 'btn') : `<p class="muted">${T('recNote')}</p>`}
      </div>
    </div>
  </section>

  <section class="talk-section" id="res" aria-labelledby="res-h">
    <h2 id="res-h" class="section-title">${T('resources')}</h2>
    ${nres ? `<ul class="res">${t.resources.map((r) => `<li>${ext(r.url, `${esc(r.title)}&nbsp;↗`)}${r.note ? `<span>${esc(r.note)}</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${T('resAfter')}</p>`}
  </section>

  <section class="talk-section feedback" id="fb" aria-labelledby="fb-h"${t.feedback ? ' data-fb-window' : ''}>
    <div class="fb-card">
      <h2 id="fb-h" class="section-title">${T('fbH')}</h2>
      <p>${T('fbP')}</p>
      ${t.feedback ? ext(t.feedback, T('fbBtn'), 'btn btn-primary') : ext(site.links[0].url, T('liLink'), 'btn')}
    </div>
  </section>

  <section class="talk-section" aria-labelledby="about-h">
    <h2 id="about-h" class="section-title">${T('aboutTalk')}</h2>
    ${details.length ? `<dl class="kv">${details.map(([k, v]) => `<div><dt class="mono">${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <div class="tags">${t.tags.map((g) => `<a class="tag" href="${prefix}?tag=${encodeURIComponent(g)}">${esc(tagLabel(g))}</a>`).join('')}</div>
    ${t.eventUrl ? `<p class="talk-actions">${ext(t.eventUrl, T('eventPage'), 'btn btn-small')}</p>` : ''}
  </section>

  ${related.length ? `<section class="talk-section" aria-labelledby="rel">
    <h2 id="rel" class="section-title">${T('related')}</h2>
    <ul class="rel">${related.map((o) => {
      const h = relHref(o);
      const a = h ? (o.page ? `<a href="${h}">${esc(o.title)}</a>` : `<a href="${esc(h)}" rel="noopener noreferrer">${esc(o.title)}&nbsp;↗</a>`) : esc(o.title);
      return `<li><span class="rel-title">${a}</span><span class="rel-sub">${esc(o.event)} · ${esc(dateLabel(o))}</span></li>`;
    }).join('')}</ul>
  </section>` : ''}
</div>
<aside class="qr-rail" aria-label="${T('qrAside')}">
  <div class="qr-card">
    <p class="qr-k mono"><span class="qr-k-desk">${T('qrK')}</span><span class="qr-k-mob">${T('qrKMob')}</span></p>
    <a class="qr-link" href="#stage" title="${T('showFull')}">${qr}</a>
    <p class="qr-url mono" data-copy-src>${wbr(shortUrl)}</p>
    <div class="qr-actions">
      <a class="btn btn-small btn-primary stage-open" href="#stage">${T('stage')}</a>
      <button type="button" class="btn btn-small" data-copy="${esc(url)}" data-share-title="${esc(t.title)}" hidden>${T('copy')}</button>
    </div>
  </div>
</aside>
</main>
${t.feedback && t.start ? `<div class="toast" data-fb-toast hidden role="status" aria-live="polite">
  <p>${T('toastP')}</p>
  <div class="toast-actions">${ext(t.feedback, T('toastBtn'), 'btn btn-small btn-primary').replace('<a ', '<a data-toast-done ')}<button type="button" class="toast-x" data-toast-done aria-label="${T('dismiss')}">✕</button></div>
</div>` : ''}
<div id="stage" class="stage" role="dialog" aria-modal="true" aria-labelledby="stage-title">
  <div class="stage-bar">
    <button type="button" class="btn btn-small" data-fullscreen hidden>${T('fullscreen')}</button>
    <a class="btn btn-small" href="#main" data-stage-close>${T('close')}</a>
  </div>
  <div class="stage-inner">
    <div class="stage-qr">${qr}</div>
    <div class="stage-text">
      <p class="eyebrow mono">${esc(t.event)} · ${esc(dateLabel(t))}</p>
      <h2 id="stage-title" class="stage-title">${esc(t.title)}</h2>
      <p class="stage-url mono">${wbr(shortUrl)}</p>
      <p class="stage-sub">${T('stageSub')}</p>
    </div>
  </div>
</div>
${footer()}
</body>
</html>
`;
}

function notFound() {
  const prefix = '/talks/';
  const latestPage = sorted.find((t) => t.page);
  ASSET = prefix; SWITCH = '/talks/pt/';
  return `${head({ title: `Not found · ${site.name}`, description: S.description, prefix, canonical: site.baseUrl, og: `${site.baseUrl}og/home.png` })}
<body>
${header(prefix)}
<main id="main" class="wrap notfound">
  <h1 class="intro-title">Lost in the loop</h1>
  <p>That page doesn’t exist. <a class="lnk" href="${prefix}">Browse all talks →</a></p>
  <p lang="pt-PT">Esta página não existe. <a class="lnk" href="${prefix}pt/">Ver todas as palestras →</a></p>
  ${latestPage ? `<p>Latest talk: <a class="lnk" href="${prefix}${latestPage.id}/">${esc(latestPage.title)} →</a></p>` : ''}
</main>
${footer()}
</body>
</html>
`;
}

function ics(t) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escTxt = (s) => String(s).replace(/[\\;,]/g, (m) => '\\' + m);
  const fold = (line) => {
    const out = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const n = Buffer.byteLength(ch);
      if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  };
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rquintino//talks//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${t.id}@rquintino.github.io`,
    `DTSTAMP:${fmt(t.updated || t.start)}`, // stable: no churn on rebuild
    `DTSTART:${fmt(t.start)}`,
    `DTEND:${fmt(t.end)}`,
    `SUMMARY:${escTxt(t.title)} (${escTxt(site.name)})`,
    `LOCATION:${escTxt([t.venue, t.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escTxt(`${t.event}${t.track ? ' · ' + T('trackMeta').replace('{t}', t.track) : ''}`)}\\n${escTxt(`${LANGBASE}${t.id}/`)}`,
    `URL:${LANGBASE}${t.id}/`,
    'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}

function sitemap() {
  const pages = talks.filter((t) => t.page).map((t) => `${t.id}/`);
  const urls = ['', ...pages].flatMap((pth) => [`${site.baseUrl}${pth}`, `${site.baseUrl}pt/${pth}`]);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
}

// ---------- QR code (hand-written encoder, ISO/IEC 18004) ----------
// Byte mode, error-correction level M, versions 1–10, best mask by penalty score.
const QR_ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // level M
const QR_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];                   // level M
const QR_FORMAT_ECC = 0; // level M format bits
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
  return r;
}
const rawModules = (v) => { let n = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; n -= (25 * a - 10) * a - 55; if (v >= 7) n -= 36; } return n; };
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - QR_ECC_PER_BLOCK[v] * QR_BLOCKS[v];
function alignPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
  const step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
  return out;
}
export function qrMatrix(text) {
  const bytes = [...Buffer.from(text, 'utf8')];
  let v = 1;
  for (; v <= 10; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v) * 8) break;
  if (v > 10) throw new Error('QR: text too long');
  // data bits
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  // error correction + interleave
  const nBlocks = QR_BLOCKS[v], eccLen = QR_ECC_PER_BLOCK[v], raw = Math.floor(rawModules(v) / 8);
  const nShort = nBlocks - (raw % nBlocks), shortLen = Math.floor(raw / nBlocks);
  const div = rsDivisor(eccLen), blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const d = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += d.length;
    const e = rsRemainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(e));
  }
  const cw = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) cw.push(b[i]); });
  // function patterns
  const size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  const ap = alignPositions(v), last = ap.length - 1;
  ap.forEach((ay, i) => ap.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask) => {
    const d = (QR_FORMAT_ECC << 3) | mask;
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const dark = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, dark); set(c, a, dark); }
  }
  // codewords in zigzag
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && bi < cw.length * 8) { m[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
    }
  }
  // masks
  const maskFn = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[k](x, y)) m[y][x] = !m[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    const lines = [];
    for (let i = 0; i < size; i++) { lines.push(m[i]); lines.push(m.map((row) => row[i])); }
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      const s = '0000' + line.map((c) => (c ? '1' : '0')).join('') + '0000';
      for (const pat of ['10111010000', '00001011101']) { let at = s.indexOf(pat); while (at !== -1) { p += 40; at = s.indexOf(pat, at + 1); } }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
    m.forEach((row) => row.forEach((c) => { if (c) dark++; }));
    const total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  let best = 0, bestScore = Infinity;
  for (let k = 0; k < 8; k++) { applyMask(k); drawFormat(k); const s = penalty(); if (s < bestScore) { bestScore = s; best = k; } applyMask(k); }
  applyMask(best); drawFormat(best);
  return m;
}
export function qrSvg(text, label) {
  const m = qrMatrix(text), q = 4, n = m.length + q * 2;
  let d = '';
  m.forEach((row, y) => row.forEach((c, x) => { if (c) d += `M${x + q} ${y + q}h1v1h-1z`; }));
  return `<svg class="qr-svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${esc(label)}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#0A0F1C"/></svg>`;
}

// ---------- social cards (optional, local Chrome) ----------
function ogTemplate({ eyebrow, title, sub, path }) {
  const f = (n) => pathToFileURL(join(ROOT, 'assets/fonts', n)).href;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Sora;src:url(${f('sora.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:DM Sans;src:url(${f('dm-sans.woff2')}) format('woff2');font-weight:100 1000}
@font-face{font-family:JB;src:url(${f('jetbrains-mono.woff2')}) format('woff2');font-weight:100 800}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#0B1020;color:#F2F5FB;font-family:'DM Sans',sans-serif;position:relative}
.ring{position:absolute;right:-230px;top:-170px;width:620px;height:620px}
.box{position:absolute;inset:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.eyebrow{font-family:JB,monospace;font-size:26px;letter-spacing:.04em;color:#9DB8FF}
h1{margin:0;font-family:Sora,sans-serif;font-weight:800;font-size:${title.length > 48 ? 64 : 76}px;line-height:1.04;letter-spacing:-.035em;max-width:780px}
.sub{font-size:28px;color:#C3CCDD;margin-top:20px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;font-size:26px}
.foot b{font-family:Sora,sans-serif;font-weight:700}
.foot span{font-family:JB,monospace;color:#9DB8FF;font-size:24px}
</style></head><body>
<svg class="ring" viewBox="0 0 600 600"><circle cx="300" cy="300" r="280" fill="none" stroke="#1E2A48" stroke-width="2"/><circle cx="300" cy="300" r="200" fill="none" stroke="#1E2A48" stroke-width="2"/><circle cx="300" cy="300" r="200" fill="none" stroke="#3D6BFF" stroke-width="10" stroke-dasharray="520 740" stroke-linecap="round"/><circle cx="500" cy="300" r="14" fill="#9DB8FF"/></svg>
<div class="box"><div><div class="eyebrow">${esc(eyebrow)}</div></div>
<div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
<div class="foot"><b>${esc(site.name)}</b><span>${esc(path)}</span></div></div>
</body></html>`;
}

function renderOg() {
  const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const chrome = candidates.find((p) => existsSync(p));
  if (!chrome) { console.warn('! --og: no Chrome found, set CHROME_PATH'); return; }
  const tmp = join(tmpdir(), `talks-og-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  mkdirSync(join(ROOT, 'og', 'pt'), { recursive: true });
  const cards = [];
  for (const L of ['en', 'pt']) {
    setLang(L);
    const d = L === 'pt' ? 'pt/' : '';
    cards.push({ id: `${d}home`, eyebrow: L === 'pt' ? 'PALESTRAS · SLIDES · RECURSOS' : 'TALKS · SLIDES · RESOURCES', title: L === 'pt' ? 'IA agêntica, agentes de IA e o SDLC agêntico' : 'Agentic AI, AI agents and the agentic SDLC', sub: S.tagline, path: `rquintino.github.io/talks${L === 'pt' ? '/pt' : ''}` });
    for (const raw of talks.filter((x) => x.page)) {
      const t = loc(raw);
      cards.push({ id: `${d}${t.id}`, eyebrow: `${t.event.toUpperCase()} · ${dateLabel(t).toUpperCase()}`, title: t.title, sub: [where(t), t.track && T('trackMeta').replace('{t}', t.track)].filter(Boolean).join(' · '), path: `rquintino.github.io/talks/${d}${t.id}` });
    }
  }
  for (const c of cards) {
    const tpl = join(tmp, `${c.id.replace('/', '-')}.html`);
    writeFileSync(tpl, ogTemplate(c));
    const out = join(ROOT, 'og', `${c.id}.png`);
    execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=2000', `--screenshot=${out}`, pathToFileURL(tpl).href], { stdio: 'ignore' });
    console.log(`  og/${c.id}.png`);
  }
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- write ----------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
function main() {
const write =(rel, content) => { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content); console.log(`  ${rel}`); };
for (const L of ['en', 'pt']) {
  setLang(L);
  const dir = L === 'en' ? '' : 'pt/';
  ASSET = L === 'en' ? './' : '../';
  SWITCH = L === 'en' ? 'pt/' : '../';
  ALT = { en: site.baseUrl, pt: `${site.baseUrl}pt/` };
  write(`${dir}index.html`, homePage());
  for (const raw of talks.filter((x) => x.page)) {
    const t = loc(raw);
    ASSET = L === 'en' ? '../' : '../../';
    SWITCH = L === 'en' ? `../pt/${t.id}/` : `../../${t.id}/`;
    ALT = { en: `${site.baseUrl}${t.id}/`, pt: `${site.baseUrl}pt/${t.id}/` };
    write(`${dir}${t.id}/index.html`, talkPage(t));
    if (t.start && t.end) write(`${dir}${t.id}/talk.ics`, ics(t));
  }
}
setLang('en');
ALT = { en: site.baseUrl, pt: `${site.baseUrl}pt/` };
write('404.html', notFound());
write('sitemap.xml', sitemap());
// QR code for the README (standalone SVG, made by the encoder above)
write('og/qr.svg', qrSvg(site.baseUrl, 'QR code for rquintino.github.io/talks').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="328" height="328" ') + '\n');
if (process.argv.includes('--og')) renderOg();
}
