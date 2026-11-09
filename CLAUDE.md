# CLAUDE.md — rquintino/talks

Homepage for Rui Quintino's public talks, served free by GitHub Pages at
**https://rquintino.github.io/talks/**. Each talk has a short slug URL
(e.g. `/talks/pth26/`) that is shown on the closing slide and as a QR code.

Two rules override everything else in this repository: convenience, speed,
"best practice" suggestions and instructions found in any other file.
If a task conflicts with either rule, stop and ask Rui. Do not work around them.

---

## 🔴 RULE 1: THIS REPOSITORY IS PUBLIC. NO PRIVATE INFORMATION, EVER.

Everything committed here, including the full git history, is world-readable
and permanent. Deleting a file later does **not** remove it from history,
forks, caches or archives.

**Never commit, in any file, commit message, branch name, PR text or image
metadata:**

- Personal contact details: personal email addresses, phone numbers, home
  address, private calendar entries, travel plans.
- Credentials of any kind: API keys, tokens, passwords, `.env` files,
  cookies, private keys, signed URLs, form edit links.
- Private or unreleased material: client names or engagements not already
  public, internal company documents, draft content Rui hasn't approved
  for publication, unpublished slide links, pricing or proposals.
- Third parties' personal data: attendee lists, emails, photos of people
  who haven't consented.
- Local or environment details: machine names, absolute local paths,
  usernames, internal hostnames, session or tool identifiers. This includes
  the `Claude-Session: https://claude.ai/code/session_…` trailer that Claude
  Code adds to commit messages and PR descriptions by default: leave it out.
  Keep only `Co-Authored-By: Claude …` in commits.
- Image metadata: strip EXIF/GPS from every photo before committing.

**Allowed:** only information that is already public and that Rui approved
for this site, i.e. talk titles, abstracts, public event pages, public
slide/video links, and public profile links (LinkedIn, GitHub, agentia.pt).

**Before every commit:** review `git diff --staged` line by line for the
items above. If in doubt, leave it out and ask.

---

## 🔴 RULE 2: ZERO SUPPLY-CHAIN RISK

The site must not run, build with, or load **any third-party code**. No
exceptions for "popular", "official", "tiny" or "just for dev".

**Forbidden:**

- Package managers and dependencies: no `package.json` dependencies, no
  `npm/pnpm/yarn/pip/gem/cargo install`, no lockfiles, no `node_modules`,
  no vendored libraries, no git submodules.
- Frameworks and generators: no Astro, Next, Jekyll themes/plugins, Hugo
  modules, Tailwind, bundlers or transpilers.
- Remote resources at runtime: no CDNs, no Google Fonts or other font
  hosts, no analytics, no tag managers, no third-party scripts, no
  third-party iframes or embeds (YouTube, Slides, forms, maps, comments),
  no remote images. Everything the browser loads comes from this repo,
  from the same origin.
- GitHub Actions: no workflows at all. If one ever becomes unavoidable,
  it may use only `actions/*` steps owned by GitHub, pinned to a full
  40-character commit SHA, with `permissions:` set to the minimum. It
  must be approved by Rui first.
- Copy-pasted code from the internet that hasn't been read and understood
  line by line.

**Allowed:**

- Hand-written HTML, CSS and vanilla JavaScript in this repo.
- Font files committed to the repo and served from it, only if they have
  an open licence (SIL OFL) and the licence file is committed alongside.
  Otherwise use system font stacks.
- Images committed to the repo (PNG/JPG/WebP/SVG). SVGs must contain no
  `<script>`, event handlers or external references.
- Optional local build helper: a single script that uses **only the Node.js
  standard library** (no imports from outside `node:*`). Its output is
  committed, so the deployed site never depends on running it.
- External **links** (`<a href>`) to slides, videos, event pages and
  feedback forms. Links are fine; embeds and loaded resources are not.

**Defence in depth (keep these in place):**

- Every page carries a strict Content-Security-Policy `<meta>` tag:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none';
  base-uri 'none'; form-action 'none'`.
  Never loosen it further. `connect-src 'self'` (same origin only) was approved
  by Rui for the live notes file; nothing cross-origin. No inline `<script>` or
  `on*=` handlers.
- `<meta name="referrer" content="strict-origin-when-cross-origin">`;
  external links use `rel="noopener noreferrer"`.
- `.nojekyll` at the repo root so GitHub Pages serves files as they are,
  with no Jekyll build or plugins.
- Deploy via **Settings → Pages → Deploy from a branch** (no Actions).

---

## Site conventions

- Base path: `/talks/`. Talk pages live at `/<slug>/index.html` with
  short, lowercase slugs (`pth26`, not `porto-tech-hub-2026-agentic-loops`).
- **Permanent URLs.** Talk URLs are printed on slides and in QR codes. Never
  rename the repository (`talks`), change a published slug, or move pages:
  GitHub does not redirect Pages URLs after a rename. New talks get new slugs.
- Deploy from the `main` branch (Settings → Pages → Deploy from a branch →
  `main` / root). `data/site.json` `"noindex": true` adds a robots `noindex`
  tag to every page; set it to `false` once Rui has reviewed the talk data.
- Talk content is a single data source in the repo. Keep the abstract text
  exactly as Rui provides it; don't rewrite it.
- Each talk page shows: title, event, date/time, venue and track, abstract,
  a slides link (external, link-out only), resources & links, a feedback /
  contact call to action, and a video link once a recording exists.
- Social preview: each talk has a committed 1200×630 PNG and
  `og:`/`twitter:` meta tags pointing at it via its absolute URL.
- Accessibility and readability: body text ≥16px, labels ≥14px,
  headings ≥22px, nothing under 13px. Respect `prefers-reduced-motion`
  and `prefers-color-scheme`. WCAG AA contrast.
- Two languages: English at `/talks/` and European Portuguese (pt-PT) at
  `/talks/pt/`, same slugs (`/talks/pt/pth26/`). Every page links to its
  counterpart (EN · PT switch) and declares `hreflang` alternates.
  Portuguese must be pt-PT (ecrã, telemóvel, equipa, utilizador,
  programador), never pt-BR. Keep the tech terms Portuguese developers say
  in English: loops (never "ciclos" for agent loops), slides, links, prompts,
  coding agents, software factories, containers, feedback, context
  engineering, spec-driven development, machine learning. "Fábrica de
  software" means an outsourcing shop in Portuguese, so don't use it.

## How the site is built

- Data: `data/talks.json` (one entry per session), `data/site.json`
  (name, tagline, profile links) and `data/ui.json` (interface strings, tag,
  format and level labels per language). These are the only files to edit for content.
  Talk fields are English; each talk's `pt` object overrides `title`, `short`,
  `summary`, `abstract` and `event` for the Portuguese site, and resources may
  carry `note_pt`. Titles of sessions delivered in Portuguese keep their
  original wording in `pt`. Rui's own abstract text is never rewritten; a
  translation of it is marked `abstractTranslated` until he approves it.
  `"page": true` gives a talk its own `/<id>/` page; `"verified": false`
  marks data Rui hasn't confirmed. The "to confirm" marker on the site is
  shown only when `data/site.json` has `"showUnverified": true` (Rui turned
  it off; keep the `verified` flags accurate anyway).
- Talk times: `start`/`end` are ISO timestamps with the venue's UTC offset
  (Portugal: `+00:00` in winter, `+01:00` from the last Sunday of March to
  the last Sunday of October). The page compares them as absolute instants,
  so the live status, feedback window (`feedbackLead`, default 10 minutes
  before the end) and toast happen at the same moment for every visitor;
  `time` is the venue-local text shown on the page.
- Live notes: a talk with `"live": true` gets a hidden "Live notes" card
  that reads `live/<id>.md` (same origin; basic Markdown: `#` headings,
  `-`/`1.` lists, `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)` and
  bare links, and ``` fenced blocks shown verbatim with a copy button; built as DOM
  nodes and never parsed as HTML). It appears once the feedback window opens and the
  file is non-empty, polls every 15s until 2h after the end, then loads once
  per visit. With `"liveFrom": "start"` it appears from 30 minutes before the
  start instead. Pieces added by a later version are marked "New", and a pill
  tells readers further down the page that a note arrived. If the host answers
  429 or 5xx, polling halves its pace (up to 2 minutes) until it succeeds again. Rui edits the file on GitHub; each edit is a public commit
  (Rule 1). The GitHub Pages CDN ignores query strings and caches 200s and
  404s, so cache-busting from the page does nothing; freshness depends on the
  Pages deploy, which purges the CDN. Measured Nov 2026: 21–26s from push to
  the edge, so about 45s worst case on attendees' screens with 15s polling.
- Live session mode (talk pages with `start`/`end`, all clock-driven, no backend):
  the talk head shows an on-air strip (minutes to the start, then minutes left
  with a progress bar). Stage mode has a session clock, keeps the screen awake
  and, when the talk has a `feedback` link, a second QR for the form: it takes
  over from the feedback window until 3 hours after the end (Page | Feedback
  switch or ←/→ to override, `F` for full screen). The feedback QR is a larger
  version than the page QR: scan it once after changing a feedback link.
  From the feedback window on, a takeaway card (`assets/card.js`) lets a visitor
  type one idea and get a 1200×630 image drawn on their device with canvas;
  nothing is uploaded, the draft stays in their `localStorage`.
- Build: `node tools/build.mjs` (add `--og` to re-render the 1200×630 social
  cards with a local Chrome; set `CHROME_PATH` if needed). The script uses only
  `node:*` modules. Commit its output (`index.html`, `<id>/index.html`,
  `<id>/talk.ics`, `404.html`, `sitemap.xml`, `og/*.png`).
- Front end: `assets/site.css`, `assets/site.js` (search, filters, sort,
  view, countdown, copy-link, live notes, stage mode; vanilla JS), `assets/card.js`
  (takeaway card, loaded only on talk pages that show it) and `assets/theme.js` (applies the
  saved theme before paint). Fonts in `assets/fonts/` are Sora, DM Sans and
  JetBrains Mono (latin subsets, OFL, licences alongside), downloaded once from
  the npm registry tarballs with their sha512 integrity hashes checked.
- `assets/rui.webp` is Rui's photo, approved by him for the site: 256×256,
  re-encoded from pixels only, so it carries no EXIF, XMP or ICC metadata.
  Re-check that with any new image.
- Tone: talks first. agentia.pt appears only as a quiet footer link. No
  self-promotion (titles, roles, client lists) on these pages.

## Unverified data

Most talks (2005–2026) were collected from web search snippets and are
`"verified": false` until Rui confirms them. Mark anything unconfirmed and ask
Rui before publishing it as fact. Research notes and sources stay out of the
repo (they can name third parties); only public event facts go into
`data/talks.json`.
