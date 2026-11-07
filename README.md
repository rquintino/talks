<p align="center"><img src="og/qr.svg" width="164" alt="QR code for rquintino.github.io/talks"></p>

<h1 align="center">talks</h1>

<p align="center">
Slides, resources and a QR code for every talk.<br>
<a href="https://rquintino.github.io/talks/"><b>rquintino.github.io/talks</b></a> · <a href="https://rquintino.github.io/talks/pt/">em português</a>
</p>

<p align="center"><code>0</code> dependencies · <code>0</code> trackers · <code>0</code> bytes from other hosts · <code>2</code> languages · <code>1</code> permanent URL per talk</p>

---

### The loop

Talks here ship the way agents work: in a loop.

```
observe   a talk happens          → its URL is already on the last slide
reason    edit data/talks.json    → English, plus a "pt" object for Portuguese
act       node tools/build.mjs    → pages, QR codes, calendar files
repeat    open a PR into main     → live on GitHub Pages about a minute later
```

### Inside

Hand-written HTML, CSS and vanilla JS. One build script on Node's standard library,
including the QR encoder, written from scratch so no third-party code runs, not even at
build time. The generated pages are committed; GitHub only serves files.

`data/` content · `tools/` build · `assets/` styles, scripts, OFL fonts · `<id>/` `pt/` generated pages

### House rules

Public repo: only public, approved facts. No personal data, credentials or private
material, not even in commit messages. Talk URLs are forever, so never rename the repo or a
slug. The full rules are in [CLAUDE.md](CLAUDE.md).
