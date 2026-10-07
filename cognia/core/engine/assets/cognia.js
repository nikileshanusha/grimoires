/* cognia explainer shell: shared by every lesson. Pages never copy this; vault.py refreshes it.
   It injects the header, navigation, SVG defs and the generic help sections, and wires every
   control from markup alone. A page supplies only its screens, its "Symbols on this page"
   help section, and cognia.fig(...) calls for live figures. Contract: explainer/screens.md. */
(() => {
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement, body = document.body;
  // Per-viewer conveniences only. Durable progress lives in the vault.
  const KEY = "cognia:" + location.pathname;
  const state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  // #check runs the self-check for vault.py; "#check-layout" adds the layout probes (evals/layout.py),
  // and "fs=17" in the hash sets the text size for that run.
  const CHECK = location.hash.startsWith("#check"), LAYOUT = location.hash.startsWith("#check-layout");

  /* ---------- C: injected chrome ---------- */
  body.insertAdjacentHTML("afterbegin", `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" style="fill:var(--plate)"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--c-clay)" stroke-width="1.6"/></pattern>
  <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-2)"/></marker>
  <marker id="arrA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--c-slate)"/></marker>
</defs></svg>
<header class="head">
  <span class="wordmark">cognia</span>
  <span class="src"></span>
  <span id="timeLeft" class="num"></span>
  <button class="tool" id="fsDown" type="button" aria-label="Smaller text">A−</button><button class="tool" id="fsUp" type="button" aria-label="Larger text">A+</button>
  <button class="tool" id="themeBtn" type="button" aria-label="Switch theme">Dark</button>
  <button class="tool" id="glossBtn" type="button" aria-pressed="false" aria-controls="gloss">Glossary <kbd>g</kbd></button>
  <button class="tool" id="helpBtn" type="button" aria-pressed="false" aria-controls="help">Help <kbd>?</kbd></button>
</header>`);
  $(".head .src").textContent = body.dataset.source || document.title;
  $(".stage").insertAdjacentHTML("afterend", `
<nav class="nav" aria-label="Screens">
  <button class="navbtn" id="prev" data-arrow="←"><kbd>←</kbd><span id="prevLabel"></span></button>
  <div class="story"><div class="story-title" id="storyTitle"></div><div class="story-segs" id="segs"></div></div>
  <button class="navbtn" id="next" data-arrow="→"><span id="nextLabel"></span><kbd>→</kbd></button>
</nav>`);

  /* ---------- C: help panel, the shared legend (page terms live in the glossary) ---------- */
  const help = $("#help");
  const sw = (w, h, inner) => `<svg width="${w}" height="${h}" aria-hidden="true">${inner}</svg>`;
  help.insertAdjacentHTML("afterbegin", `
<header><h2 style="font-size:1.15rem">Help</h2><button class="tool" id="helpClose" type="button">Close <kbd>Esc</kbd></button></header>
<section><h3>Moving</h3><dl>
  <dt><kbd>→</kbd></dt><dd>Next page or screen, or the dark <b>Next</b> button</dd>
  <dt><kbd>←</kbd></dt><dd>Previous page or screen</dd>
  <dt>${sw(34, 8, '<rect width="34" height="7" rx="3.5" style="fill:var(--accent)"/>')}</dt><dd>The bar at the bottom: one segment per screen. Click a segment to jump.</dd>
  <dt>${sw(10, 26, '<rect x="3" width="4" height="26" rx="2" style="fill:var(--accent-mid)"/>')}</dt><dd>Drag the bar between text and figure to resize. Double-click it to reset.</dd>
  <dt><kbd>?</kbd></dt><dd>Open or close this panel</dd>
  <dt><kbd>g</kbd></dt><dd>Open or close the glossary</dd>
  <dt><kbd>Esc</kbd></dt><dd>Close this panel</dd>
  <dt><b>A− A+</b></dt><dd>Smaller or larger text. Every screen refits to it.</dd>
</dl><p class="hint">On a laptop or desktop, screens do not scroll. When one holds more than your window shows, its text turns into pages: <b>Continue</b> and <kbd>→</kbd> step through them, and the bar shows "page 2 of 3". A <b>▸</b> line opens an aside that was folded to make room.</p></section>
<section><h3>Parts of a screen</h3><dl>
  <dt><span class="num">3 / 8</span></dt><dd>Where you are in the argument</dd>
  <dt>${sw(14, 22, '<rect width="3" height="22" style="fill:var(--accent-mid)"/>')}</dt><dd><b>So far</b>: what the last screen established</dd>
  <dt><b>Aa</b></dt><dd>The headline is the screen's one claim</dd>
  <dt><strong class="key">term</strong></dt><dd>A key term, defined in that sentence</dd>
  <dt>${sw(22, 14, '<line x1="0" y1="1" x2="22" y2="1" style="stroke:var(--rule)" stroke-width="2"/>')}</dt><dd>The note under the text: an aside you can skip</dd>
  <dt><b>What to notice</b></dt><dd>Under each figure: where to look</dd>
</dl></section>
<section><h3>Marks in the figures</h3><dl>
  <dt>${sw(22, 14, '<rect width="22" height="14" class="acc-fill"/>')}</dt><dd><b>Solid</b>: a gain, or the thing being explained</dd>
  <dt>${sw(22, 14, '<rect width="22" height="14" class="hatch"/>')}</dt><dd><b>Hatched</b>: a loss, or what goes away</dd>
  <dt>${sw(22, 14, '<rect x="1" y="1" width="20" height="12" rx="3" class="card"/>')}</dt><dd><b>Outlined box</b>: context or a step in the chain</dd>
  <dt>${sw(22, 14, '<rect x="1" y="1" width="20" height="12" rx="3" class="card-acc"/>')}</dt><dd><b>Shaded box</b>: the result</dd>
  <dt>${sw(22, 10, '<line x1="0" y1="5" x2="22" y2="5" class="dash"/>')}</dt><dd><b>Dashed line</b>: a reference level or a what-if</dd>
  <dt>${sw(26, 10, '<line x1="0" y1="5" x2="22" y2="5" class="ink2" marker-end="url(#arr)"/>')}</dt><dd><b>Arrow</b>: one idea feeds the next; the word on it says how</dd>
  <dt>${sw(16, 16, '<circle cx="8" cy="8" r="6" class="acc-fill"/>')}</dt><dd><b>Dot</b>: where two curves cross, the answer</dd>
</dl><p class="hint">Colour only groups things. Shape and labels say what each one is, so the page reads in black and white too.</p></section>
<section><h3>Evidence tags</h3><dl>
  <dt><span class="tag established"><i></i></span></dt><dd><b>Established</b>: shown directly in the source</dd>
  <dt><span class="tag derived"><i></i></span></dt><dd><b>Derived</b>: follows from the source by arithmetic</dd>
  <dt><span class="tag interpretation"><i></i></span></dt><dd><b>Interpretation</b>: a reading of the results, or a judgment</dd>
  <dt><span class="tag external"><i></i></span></dt><dd><b>External</b>: from outside the source</dd>
  <dt><span class="tag open"><i></i></span></dt><dd><b>Open</b>: not settled by the source</dd>
</dl></section>
<section><h3>Things you can do</h3><dl>
  <dt>${sw(34, 14, '<line x1="0" y1="7" x2="34" y2="7" style="stroke:var(--rule)" stroke-width="4"/><circle cx="12" cy="7" r="6" class="acc-fill"/>')}</dt><dd><b>Slider</b>: change a number; the figure and the big readout follow</dd>
  <dt><b>Predict</b></dt><dd>Some sliders unlock only after you guess. A wrong guess is useful: it shows exactly what to rethink.</dd>
  <dt><span style="filter:blur(2.5px)">01 abc</span></dt><dd><b>Blurred step</b>: click it, or press Next step, to reveal it</dd>
  <dt><b>Recall</b></dt><dd>Recall mode hides labels; name each one, then click to check</dd>
  <dt><span class="gl">term</span></dt><dd><b>Dotted underline</b>: a glossary term. Click it for a short definition; Show more gives the full explanation and an example.</dd>
  <dt><b>Copy</b></dt><dd>Copy for Claude sends your explanation to chat for feedback</dd>
</dl></section>`);
  help.insertAdjacentHTML("beforeend", `
<section><h3>Theme and progress</h3><p class="hint">The <b>Dark / Light</b> button switches the page colours. This browser remembers your theme, your screen, revealed steps and your draft. Your real progress is kept in your vault by Claude.</p></section>`);

  /* ---------- C: glossary (the page writes <article class="entry">; the shell builds the rest) ---------- */
  const gloss = $("#gloss") || Object.assign(document.createElement("aside"), { id: "gloss", className: "gloss", hidden: true });
  if (!gloss.isConnected) { body.appendChild(gloss); $("#glossBtn").hidden = true; }
  const entries = $$(".entry", gloss);
  const ename = e => $("h4", e).textContent.trim();
  entries.sort((a, b) => ename(a).localeCompare(ename(b)));
  entries.forEach(e => {
    const more = $(".more", e);
    if (more) {
      more.hidden = true;
      const b = Object.assign(document.createElement("button"), { className: "btn small", type: "button", textContent: "Show more" });
      b.setAttribute("aria-expanded", "false");
      b.onclick = () => setMore(e, more.hidden);
      more.before(b);
    }
  });
  function setMore(e, open) {
    const more = $(".more", e), b = $(":scope > button", e);
    if (!more) return;
    more.hidden = !open; b.textContent = open ? "Show less" : "Show more"; b.setAttribute("aria-expanded", String(open));
  }
  const syms = entries.filter(e => e.dataset.sym);
  let letter = "";
  const indexHtml = (syms.length ? `<div class="gi-group"><span class="label">Symbols</span>${syms.map(e => `<a href="#${e.id}">\\(${e.dataset.sym}\\)</a>`).join("")}</div>` : "") +
    `<div class="gi-group">${entries.map(e => {
      const L = ename(e)[0].toUpperCase(), head = L !== letter ? `<span class="label">${(letter = L)}</span>` : "";
      return `${head}<a href="#${e.id}">${ename(e)}</a>`;
    }).join("")}</div>`;
  entries.forEach(e => { if (e.dataset.sym) $("h4", e).insertAdjacentHTML("afterbegin", `<span class="gsym">\\(${e.dataset.sym}\\)</span>`); });
  gloss.insertAdjacentHTML("afterbegin", `
<header><h2 style="font-size:1.15rem">Glossary</h2><button class="tool" id="glossClose" type="button">Close <kbd>Esc</kbd></button></header>
<input type="search" class="gfilter" placeholder="Filter terms" aria-label="Filter the glossary">
<div class="row"><button class="btn small" type="button" data-gall="1">Show all detail</button><button class="btn small" type="button" data-gall="0">Hide all detail</button></div>
<nav class="gindex" aria-label="Glossary index">${indexHtml}</nav>
<div class="gentries"></div>`);
  entries.forEach(e => $(".gentries", gloss).appendChild(e));
  $$("[data-gall]", gloss).forEach(b => b.onclick = () => entries.forEach(e => setMore(e, b.dataset.gall === "1")));
  $(".gfilter", gloss).oninput = ev => {
    const q = ev.target.value.trim().toLowerCase();
    entries.forEach(e => { e.hidden = !!q && !e.textContent.toLowerCase().includes(q); });
    $$(".gindex a", gloss).forEach(a => { const e = gloss.querySelector(a.getAttribute("href")); a.hidden = !!(e && e.hidden); });
  };
  function showEntry(id) {
    const e = gloss.querySelector("#" + CSS.escape(id));
    if (!e) return;
    setPanel("gloss");
    e.hidden = false;
    requestAnimationFrame(() => { gloss.scrollTop += e.getBoundingClientRect().top - gloss.getBoundingClientRect().top - 8; e.classList.remove("flash"); void e.offsetWidth; e.classList.add("flash"); });
  }
  document.addEventListener("click", ev => {
    const a = ev.target.closest("a.gl, .gindex a");
    if (!a) return;
    const id = (a.getAttribute("href") || "").slice(1);
    if (!id) return;
    ev.preventDefault();
    showEntry(id);
  });

  /* ---------- C: math in figures: z_m, x^2, z_{top} become real sub/superscripts in the math font ---------- */
  const MATH = /([A-Za-z\u0370-\u03FF]\u0304?)?([_^])(\{([^}]*)\}|([^\s{}]))/g;
  function mathify(svg) {
    const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT), nodes = [];
    for (let n; (n = walk.nextNode());) if (/[_^]/.test(n.nodeValue) && n.parentElement.closest("text")) nodes.push(n);
    nodes.forEach(n => {
      const NS = "http://www.w3.org/2000/svg", frag = document.createDocumentFragment(), t = n.nodeValue;
      const span = (txt, cls, shift) => {
        const el = document.createElementNS(NS, "tspan");
        el.setAttribute("class", cls);
        if (shift) { el.setAttribute("baseline-shift", shift); el.setAttribute("font-size", "72%"); }
        el.textContent = txt;
        return el;
      };
      let last = 0;
      for (const m of t.matchAll(MATH)) {
        frag.append(t.slice(last, m.index));
        if (m[1]) frag.append(span(m[1], "tx"));
        frag.append(span(m[4] ?? m[5], "tx", m[2] === "_" ? "sub" : "super"));
        last = m.index + m[0].length;
      }
      frag.append(t.slice(last));
      n.replaceWith(frag);
    });
  }

  /* ---------- C: theme (light / dark, neutral) ---------- */
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const themeLabel = () => { $("#themeBtn").textContent = isDark() ? "Light" : "Dark"; };
  $("#themeBtn").onclick = () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("cognia:theme", root.dataset.theme); } catch {}
    themeLabel();
  };
  themeLabel();

  /* ---------- C: text density (A- / A+), kept per viewer ---------- */
  const FS = { min: 13, max: 18 };
  let fs = 15;
  try { const v = parseFloat(localStorage.getItem("cognia:fs")); if (v >= FS.min && v <= FS.max) fs = v; } catch {}
  const hashFs = /fs=(\d+(?:\.\d+)?)/.exec(location.hash);
  if (hashFs) fs = Math.max(FS.min, Math.min(FS.max, +hashFs[1])); else if (CHECK) fs = 15;
  // Every size in the shell is in rem, and the root size follows --fs (cognia.css), so one variable moves them all.
  const setFs = v => {
    fs = Math.max(FS.min, Math.min(FS.max, v)); root.style.setProperty("--fs", fs + "px");
    try { localStorage.setItem("cognia:fs", String(fs)); } catch {}
    relayout();
  };
  root.style.setProperty("--fs", fs + "px");
  const fsBtn = $("#fsDown"); if (fsBtn) { fsBtn.onclick = () => setFs(fs - 1); $("#fsUp").onclick = () => setFs(fs + 1); }

  /* ---------- C: live figures ---------- */
  const figs = [];
  const size = svg => { const r = svg.getBoundingClientRect(); return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) }; };
  // A plot (a figure that drew an .axes group) is at most PLOT_ASPECT x its width tall, so a tall plate
  // does not stretch it. The leftover height falls below the caption and controls. data-fill opts out.
  const PLOT_ASPECT = 0.68;
  const run = f => {
    f.svg.style.flex = f.svg.style.height = "";
    let { w, h } = size(f.svg);
    const paint = () => { f.svg.setAttribute("viewBox", `0 0 ${w} ${h}`); f.draw(f.svg, w, h); mathify(f.svg); fitLabels(f.svg); };
    paint();
    const cap = Math.round(w * PLOT_ASPECT);
    if (!f.svg.hasAttribute("data-fill") && f.svg.querySelector(".axes") && h > cap && !matchMedia("(max-width: 860px)").matches) {
      h = cap;
      f.svg.style.flex = "0 0 auto"; f.svg.style.height = h + "px";
      paint();
    }
  };
  const drawFigs = scope => figs.filter(f => !scope || scope.contains(f.svg)).forEach(run);
  // cognia.fig("#figId", (svg, w, h) => { svg.innerHTML = ... }, ["#slider1", "#slider2"])
  function fig(sel, draw, inputs = []) {
    const f = { svg: $(sel), draw };
    f.svg.style.setProperty("--u", "1rem");
    figs.push(f);
    inputs.forEach(i => $(i).addEventListener("input", () => run(f)));
  }
  // Path through y = fn(x) for x from x0 to x1 in n steps, in screen units via X and Y.
  const curve = (fn, x0, x1, n, X, Y) => {
    let d = "";
    for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n; d += `${k ? "L" : "M"}${X(x).toFixed(1)},${Y(fn(x)).toFixed(1)}`; }
    return d;
  };

  // A plot with both axes drawn: titles, numeric ticks at round values, a light grid, zero marked.
  //   const p = plot(w, h, { x: [0, 1], y: [0, 100], xTitle: "Tax rate τ (%)", yTitle: "Revenue (US$ bn)" });
  //   svg.innerHTML = p.axes + `<path class="acc-line" d="${curve(f, 0, 1, 100, p.X, p.Y)}"/>`;
  // Use p.X and p.Y for every mark so ticks and data share one scale. Options: nx, ny (about how many
  // ticks), xFmt, yFmt (value -> label), margin {l, r, t, b} (use it to place several plots in one svg),
  // xCats [labels] for bars (x then runs 0..n; put bar k at X(k + 0.5)).
  const niceStep = (span, n) => {
    const raw = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  };
  const ticksOf = (lo, hi, n) => {
    const st = niceStep(hi - lo, n), out = [];
    for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) out.push(+v.toPrecision(12));
    return out;
  };
  const fmt = v => String(+v.toPrecision(6)).replace("-", "−");
  const plot = (w, h, o) => {
    const cats = o.xCats, [x0, x1] = cats ? [0, cats.length] : o.x, [y0, y1] = o.y;
    const xf = o.xFmt || fmt, yf = o.yFmt || fmt, esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    // as many ticks as the plot has room for: a tick label needs about two lines of height, or its width plus a gap
    const kk = parseFloat(getComputedStyle(root).fontSize) / 16;
    const yRoom = Math.max(2, Math.floor((h - 66 * kk) / (34 * kk)));
    const yt = ticksOf(o.y[0], o.y[1], Math.min(o.ny || 5, yRoom));
    const k = parseFloat(getComputedStyle(root).fontSize) / 16;  // labels follow A-/A+, so every offset scales with them
    const yw = Math.max(...yt.map(v => yf(v).length)) * 7.9 * k;  // width of the widest y tick label (mono)
    const m = Object.assign({ l: Math.max(56 * k, Math.ceil(yw + (9 + 8 + 16) * k)), r: 28 * k, t: 18 * k, b: 48 * k }, o.margin);
    const X = v => m.l + (v - x0) / (x1 - x0) * (w - m.l - m.r), Y = v => h - m.b - (v - y0) / (y1 - y0) * (h - m.t - m.b);
    const xChars = Math.max(xf(x0).length, xf(x1).length, xf((x0 + x1) / 3).length);
    const xRoom = Math.max(2, Math.floor((w - m.l - m.r) / ((xChars * 7.9 + 24) * kk)));
    const xt = cats ? cats.map((_, k) => k + 0.5) : ticksOf(x0, x1, Math.min(o.nx || 5, xRoom));
    const cut = cats ? Array.from({ length: cats.length + 1 }, (_, k) => k) : xt;  // tick marks: category edges, or the ticks themselves
    let g = `<g class="axes" data-xtitle="${esc(o.xTitle || "")}" data-ytitle="${esc(o.yTitle || "")}">`;
    cut.forEach(v => { g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${Y(y0)}" y2="${Y(y1)}"/><line class="axis" x1="${X(v)}" x2="${X(v)}" y1="${Y(y0)}" y2="${Y(y0) + 5}"/>`; });
    xt.forEach((v, j) => { g += `<text class="tm tick-x" x="${X(v)}" y="${Y(y0) + 21 * k}" text-anchor="middle">${cats ? esc(cats[j]) : xf(v)}</text>`; });
    yt.forEach(v => { g += `<line class="grid" x1="${X(x0)}" x2="${X(x1)}" y1="${Y(v)}" y2="${Y(v)}"/><line class="axis" x1="${X(x0) - 5}" x2="${X(x0)}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tm tick-y" x="${X(x0) - 9 * k}" y="${Y(v) + 4 * k}" text-anchor="end">${yf(v)}</text>`; });
    g += `<line class="axis" x1="${X(x0)}" x2="${X(x1)}" y1="${Y(y0)}" y2="${Y(y0)}"/><line class="axis" x1="${X(x0)}" x2="${X(x0)}" y1="${Y(y0)}" y2="${Y(y1)}"/>`;
    g += `<text class="ts" x="${(X(x0) + X(x1)) / 2}" y="${Y(y0) + 40 * k}" text-anchor="middle">${esc(o.xTitle || "")}</text>`;
    g += `<text class="ts" transform="translate(${X(x0) - Math.ceil(yw) - 18 * k} ${(Y(y0) + Y(y1)) / 2}) rotate(-90)" text-anchor="middle">${esc(o.yTitle || "")}</text></g>`;
    return { X, Y, axes: g, box: { l: X(x0), r: X(x1), t: Y(y1), b: Y(y0) } };
  };

  // Bars from data, on plot()'s axes: bars(w, h, { cats: ["A", "B"], values: [3, 5], y: [0, 6], xTitle, yTitle, acc: [1] })
  // returns { svg, X, Y, box }. acc lists the bars that are the thing explained (solid); the rest are mid-grey.
  const bars = (w, h, o) => {
    const p = plot(w, h, { xCats: o.cats, y: o.y, xTitle: o.xTitle, yTitle: o.yTitle, ny: o.ny, yFmt: o.yFmt });
    const acc = new Set(o.acc || []), fmtv = o.yFmt || fmt, gap = o.gap ?? 0.18;
    let g = p.axes;
    o.values.forEach((v, k) => {
      const x0 = p.X(k + gap / 2), x1 = p.X(k + 1 - gap / 2), y = p.Y(Math.max(v, o.y[0])), y0 = p.Y(Math.max(0, o.y[0]));
      g += `<rect x="${x0}" y="${Math.min(y, y0)}" width="${x1 - x0}" height="${Math.abs(y0 - y)}" class="${acc.has(k) ? "acc-fill" : "mid-fill"}"/>`;
      if (o.labels !== false) g += label((x0 + x1) / 2, Math.min(y, y0) - 6, fmtv(v), { cls: "tm", anchor: "middle" });
    });
    return { svg: g, X: p.X, Y: p.Y, box: p.box };
  };

  // A figure label the shell fits after drawing: label(x, y, "text", { maxWidth, cls, anchor, bg })
  // wraps at maxWidth (in drawing units), and bg puts a paper-coloured backing behind it.
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const label = (x, y, text, o = {}) =>
    `<text x="${x}" y="${y}" class="${o.cls || "ts"}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.maxWidth ? ` data-wrap="${o.maxWidth}"` : ""}${o.bg ? " data-bg" : ""}>${esc(text)}</text>`;

  /* ---------- C: label fitting, after every paint ----------
     A label wraps to its data-wrap width, or to the card it sits on (the first rect in its <g>). A label
     that still does not fit shrinks; colliding free labels move apart; anything outside the drawing
     grows the viewBox. Every pass starts from the label's original state, so it can run on each resize. */
  const NS = "http://www.w3.org/2000/svg";
  const textLen = t => { try { return t.getComputedTextLength(); } catch { return 0; } };
  const bbox = el => { try { return el.getBBox(); } catch { return null; } };
  const overlaps = (a, b, pad = 1) => a.x < b.x + b.width - pad && b.x < a.x + a.width - pad && a.y < b.y + b.height - pad && b.y < a.y + a.height - pad;
  function wrapText(t, maxW) {
    const words = t.textContent.trim().split(/\s+/);
    if (words.length < 2) return;
    const x = t.getAttribute("x") || 0, probe = document.createElementNS(NS, "tspan");
    t.textContent = ""; t.appendChild(probe);
    const lines = [];
    let line = "";
    words.forEach(w => {
      probe.textContent = line ? line + " " + w : w;
      if (line && textLen(probe) > maxW) { lines.push(line); line = w; } else line = probe.textContent;
    });
    lines.push(line);
    t.textContent = "";
    const lh = 1.2, first = -(lines.length - 1) * lh / 2;
    lines.forEach((l, i) => {
      const sp = document.createElementNS(NS, "tspan");
      sp.setAttribute("x", x); sp.setAttribute("dy", (i ? lh : first) + "em"); sp.textContent = l;
      t.appendChild(sp);
    });
  }
  function fitLabels(svg) {
    const texts = $$("text", svg).filter(t => !t.closest("defs, .axes") && !t.closest("[transform*=rotate]"));
    // reset to the authored state
    texts.forEach(t => {
      if (t.dataset.t0 !== undefined) t.textContent = t.dataset.t0;
      if (t.dataset.y0 !== undefined) t.setAttribute("y", t.dataset.y0);
      t.style.fontSize = "";
    });
    $$("rect[data-y0]", svg).forEach(r => r.setAttribute("y", r.dataset.y0));
    $$("rect.fitbg", svg).forEach(r => r.remove());
    if (svg.dataset.vb0) svg.setAttribute("viewBox", svg.dataset.vb0);
    // wrap or shrink each label to its room
    texts.forEach(t => {
      const g = t.parentElement, card = g && g.tagName === "g" && g !== svg ? $(":scope > rect, :scope > circle", g) : null;
      const room = t.dataset.wrap ? +t.dataset.wrap : card ? (card.tagName === "rect" ? +card.getAttribute("width") : 2 * card.getAttribute("r")) - 12 : 0;
      if (!room) return;
      const plain = !t.childElementCount || t.dataset.t0 !== undefined;
      if (textLen(t) > room && plain) { if (t.dataset.t0 === undefined) t.dataset.t0 = t.textContent; wrapText(t, room); }
      const b = bbox(t), w = b ? b.width : textLen(t);
      if (w > room) t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * room / w).toFixed(2) + "px";
      if (card && card.tagName === "rect") {
        const tb = bbox(t), ch = +card.getAttribute("height") - 6;
        if (tb && tb.height > ch && !$$(":scope > text", g).some(o => o !== t)) t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * ch / tb.height).toFixed(2) + "px";
      }
    });
    // backings for data-bg labels
    texts.filter(t => t.hasAttribute("data-bg")).forEach(t => {
      const b = bbox(t); if (!b) return;
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("class", "bg fitbg"); r.setAttribute("rx", 3);
      r.setAttribute("x", b.x - 3); r.setAttribute("y", b.y - 1); r.setAttribute("width", b.width + 6); r.setAttribute("height", b.height + 2);
      t.before(r);
    });
    // move colliding free labels apart (labels on cards stay with their card)
    const free = texts.filter(t => !(t.parentElement.tagName === "g" && $(":scope > rect, :scope > circle", t.parentElement)));
    const placed = $$(".axes text", svg).map(bbox).filter(b => b && b.width);
    free.forEach(t => {
      let b = bbox(t);
      if (!b || !b.width) return;
      for (let k = 0; k < 12; k++) {
        const hit = placed.find(p => overlaps(b, p));
        if (!hit) break;
        const d = hit.y + hit.height - b.y + 1;
        if (t.dataset.y0 === undefined) t.dataset.y0 = t.getAttribute("y") || 0;
        t.setAttribute("y", (+t.getAttribute("y") + d).toFixed(1));
        const back = t.previousElementSibling;
        if (back && back.tagName === "rect" && back.classList.contains("bg")) {
          if (back.dataset.y0 === undefined) back.dataset.y0 = back.getAttribute("y");
          back.setAttribute("y", (+back.getAttribute("y") + d).toFixed(1));
        }
        b = bbox(t);
      }
      placed.push(b);
    });
    // nothing is clipped: grow the drawing to hold everything
    const vb = (svg.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number), all = bbox(svg);
    if (vb.length === 4 && all && all.width) {
      const x0 = Math.min(vb[0], all.x - 2), y0 = Math.min(vb[1], all.y - 2);
      const x1 = Math.max(vb[0] + vb[2], all.x + all.width + 2), y1 = Math.max(vb[1] + vb[3], all.y + all.height + 2);
      if (x0 < vb[0] || y0 < vb[1] || x1 > vb[0] + vb[2] || y1 > vb[1] + vb[3]) {
        if (!svg.dataset.vb0) svg.dataset.vb0 = svg.getAttribute("viewBox");
        svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
      }
    }
  }

  /* ---------- C: declared diagrams ----------
     <div class="diagram" data-flow="right|down" role="img" aria-label="…">
       <div class="node acc|loss|ref" id="a"><b>\(a\)</b> Pareto tail</div> …
       <span class="edge acc" data-from="a" data-to="b">sets</span> … </div>
     Nodes are ranked by the edges (a node sits one rank after everything that points to it; data-rank
     overrides), ordered within a rank by where their sources sit, and the arrows are drawn from the
     measured boxes. The page never gives a coordinate. */
  const plainText = el => { const c = el.cloneNode(true); $$(".katex-mathml", c).forEach(m => m.remove()); return c.textContent; };
  const words = el => { const c = el.cloneNode(true); $$(".katex", c).forEach(m => m.remove()); return c.textContent.replace(/\s+/g, " ").trim() || plainText(el); };
  function buildDiagram(d) {
    const nodes = $$(":scope > .node", d), edges = $$(":scope > .edge", d), byId = new Map(nodes.map(n => [n.id, n]));
    const ok = edges.filter(e => byId.has(e.dataset.from) && byId.has(e.dataset.to) && e.dataset.from !== e.dataset.to);
    // An edge that closes a cycle (found by a depth-first walk in page order) is drawn as a loop back
    // and does not rank; every other edge puts its target at least one rank after its source.
    const back = new Set(), state = new Map();
    const walk = n => {
      state.set(n, 1);
      ok.filter(e => byId.get(e.dataset.from) === n).forEach(e => {
        const b = byId.get(e.dataset.to);
        if (state.get(b) === 1) back.add(e); else if (!state.get(b)) walk(b);
      });
      state.set(n, 2);
    };
    nodes.forEach(n => { if (!state.get(n)) walk(n); });
    const fwd = ok.filter(e => !back.has(e));
    const rank = new Map(nodes.map(n => [n, n.dataset.rank !== undefined ? +n.dataset.rank : 0]));
    for (let k = 0; k < nodes.length; k++)  // longest path from the sources
      fwd.forEach(e => {
        const a = byId.get(e.dataset.from), b = byId.get(e.dataset.to);
        if (b.dataset.rank === undefined && rank.get(b) <= rank.get(a)) rank.set(b, rank.get(a) + 1);
      });
    const nr = Math.max(0, ...rank.values()) + 1, ranks = Array.from({ length: nr }, () => []);
    d._nr = nr;
    nodes.forEach(n => ranks[rank.get(n)].push(n));
    for (let r = 1; r < nr; r++) {  // order by the mean position of each node's sources (barycentre)
      const pos = new Map(ranks[r - 1].map((n, i) => [n, i]));
      const bc = n => { const s = ok.filter(e => byId.get(e.dataset.to) === n && pos.has(byId.get(e.dataset.from))).map(e => pos.get(byId.get(e.dataset.from))); return s.length ? s.reduce((a, b) => a + b) / s.length : Infinity; };
      ranks[r] = ranks[r].map((n, i) => [n, bc(n), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
    }
    const titles = (d.dataset.ranks || "").split("|");
    ranks.forEach((list, r) => {
      const col = Object.assign(document.createElement("div"), { className: "rank" });
      if (titles[r]) col.appendChild(Object.assign(document.createElement("div"), { className: "rank-title label", textContent: titles[r] }));
      list.forEach(n => col.appendChild(n)); d.appendChild(col);
    });
    ok.forEach(e => { e.dataset.label = e.textContent.trim(); e.textContent = ""; d.appendChild(e); });
    // once the math is set, each edge reads as a sentence for screen readers: "Pareto tail sets income above the line."
    d._speak = () => ok.forEach(e => { e.textContent = `${words(byId.get(e.dataset.from))} ${e.dataset.label || "leads to"} ${words(byId.get(e.dataset.to))}.`; });
    d._edges = ok.map(e => ({ el: e, a: byId.get(e.dataset.from), b: byId.get(e.dataset.to), back: rank.get(byId.get(e.dataset.to)) <= rank.get(byId.get(e.dataset.from)) }));
    const wires = document.createElementNS(NS, "svg");
    wires.setAttribute("class", "wires"); wires.setAttribute("aria-hidden", "true");
    d.prepend(wires);
    if (!d.getAttribute("role")) d.setAttribute("role", "group");
  }
  function drawDiagram(d) {
    const wires = $(":scope > svg.wires", d);
    if (!wires || !d._edges) return;
    const rem = parseFloat(getComputedStyle(root).fontSize);
    // the gap between ranks holds the edge labels; across, it is capped and the labels wrap to it
    wires.innerHTML = "";
    const widest = Math.max(0, ...d._edges.map(e => { const t = document.createElementNS(NS, "text"); t.textContent = e.el.dataset.label; wires.appendChild(t); const w = textLen(t); t.remove(); return w; }));
    const base = 0.9 * rem;  // .diagram text is .9rem
    // lay out one direction: set the gap, then shrink the text until every node fits (to about half size)
    const tryDir = dir => {
      d.dataset.dir = dir;
      d.style.fontSize = "";
      d.style.setProperty("--rank-gap", (dir === "down" ? 3.2 * rem : Math.max(2.5 * rem, Math.min(widest + 2 * rem, 0.16 * d.clientWidth))) + "px");
      // rank titles sit above their column; the columns start below the tallest title
      const titled = () => d.style.setProperty("--title-h", (dir === "down" ? 0 : Math.max(0, ...$$(".rank-title", d).map(t => t.offsetHeight))) + "px");
      const over = () => { titled(); return d.scrollHeight > d.clientHeight + 1 || d.scrollWidth > d.clientWidth + 1; };
      for (let k = 0; k < 9 && over(); k++) d.style.fontSize = (parseFloat(getComputedStyle(d).fontSize) * 0.92).toFixed(2) + "px";
      return { dir, fits: !over(), scale: parseFloat(getComputedStyle(d).fontSize) / base, size: d.style.fontSize };
    };
    // direction: as written (data-flow), else across when each rank gets at least 11em, else down; if that
    // only fits by shrinking the text below 80%, the other direction is tried and the better one kept
    const first = d.dataset.flow || (d.clientWidth / Math.max(1, d._nr) >= 11 * rem ? "right" : "down");
    let pick = tryDir(first);
    if (!pick.fits || pick.scale < 0.8) {
      const other = tryDir(first === "down" ? "right" : "down");
      if ((other.fits && !pick.fits) || (other.fits === pick.fits && other.scale > pick.scale + 0.01)) pick = other;
      tryDir(pick.dir);
    }
    const down = d.dataset.dir === "down", gap = parseFloat(d.style.getPropertyValue("--rank-gap"));
    const o = d.getBoundingClientRect(), box = n => { const r = n.getBoundingClientRect(); return { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top, cx: (r.left + r.right) / 2 - o.left, cy: (r.top + r.bottom) / 2 - o.top }; };
    const nodeBoxes = $$(".node", d).map(box).map(b => ({ x: b.l, y: b.t, width: b.r - b.l, height: b.b - b.t }));
    wires.setAttribute("viewBox", `0 0 ${o.width} ${o.height}`);
    let paths = "";
    const curves = [];
    d._edges.forEach(({ el, a, b, back }) => {
      const A = box(a), B = box(b), acc = el.classList.contains("acc");
      let p0, p1, c0, c1;
      if (back) {  // same or earlier rank: loop out below (or to the right) of both boxes
        if (down) { p0 = [A.r, A.cy]; p1 = [B.r + 4, B.cy]; const x = Math.max(A.r, B.r) + 40; c0 = [x, A.cy]; c1 = [x, B.cy]; }
        else { p0 = [A.cx, A.b]; p1 = [B.cx, B.b + 4]; const y = Math.max(A.b, B.b) + 40; c0 = [A.cx, y]; c1 = [B.cx, y]; }
      } else if (down) { p0 = [A.cx, A.b]; p1 = [B.cx, B.t - 4]; const m = (p0[1] + p1[1]) / 2; c0 = [p0[0], m]; c1 = [p1[0], m]; }
      else { p0 = [A.r, A.cy]; p1 = [B.l - 4, B.cy]; const m = (p0[0] + p1[0]) / 2; c0 = [m, p0[1]]; c1 = [m, p1[1]]; }
      paths += `<path d="M${p0} C${c0} ${c1} ${p1}" class="${acc ? "acc-line" : "ink2"}"${el.classList.contains("dash") ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#${acc ? "arrA" : "arr"})"/>`;
      if (el.dataset.label) curves.push({ label: el.dataset.label, at: t => [0, 1].map(i => (1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * c0[i] + 3 * (1 - t) * t * t * c1[i] + t ** 3 * p1[i]) });
    });
    wires.innerHTML = paths + curves.map(c => `<g class="elabel"><text x="0" y="0" text-anchor="middle" dominant-baseline="central" data-wrap="${Math.max(3 * rem, gap - 0.6 * rem)}">${esc(c.label)}</text></g>`).join("");
    // each label sits on its curve: at the middle if that is clear of every node and earlier label, else the
    // nearest clear point along the curve
    const taken = [...nodeBoxes];
    $$("g.elabel", wires).forEach((g, i) => {
      const t = $("text", g);
      if (textLen(t) > +t.dataset.wrap) wrapText(t, +t.dataset.wrap);
      const tb = bbox(t);
      if (!tb) return;
      const back = document.createElementNS(NS, "rect");
      back.setAttribute("class", "bg"); back.setAttribute("rx", 3);
      back.setAttribute("x", tb.x - 3); back.setAttribute("y", tb.y - 1); back.setAttribute("width", tb.width + 6); back.setAttribute("height", tb.height + 2);
      g.prepend(back);
      // candidates from the middle outwards; if none is clear, the one that covers least
      const area = r => taken.reduce((m, q) => m + Math.max(0, Math.min(r.x + r.width, q.x + q.width) - Math.max(r.x, q.x)) * Math.max(0, Math.min(r.y + r.height, q.y + q.height) - Math.max(r.y, q.y)), 0);
      let best = null;
      for (const s of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8, 0.15, 0.85]) {
        const [x, y] = curves[i].at(s), r = { x: x + tb.x - 3, y: y + tb.y - 1, width: tb.width + 6, height: tb.height + 2 }, c = area(r);
        if (!best || c < best.c) best = { x, y, r, c };
        if (!c) break;
      }
      g.setAttribute("transform", `translate(${best.x.toFixed(1)} ${best.y.toFixed(1)})`);
      taken.push(best.r);
    });
  }

  /* ---------- C: equations never run wider than their column ---------- */
  function fitEquations(scope) {
    $$(".eq", scope).forEach(e => {
      e.style.fontSize = "";
      const over = e.scrollWidth / Math.max(1, e.clientWidth);
      if (over > 1.01) e.style.fontSize = (parseFloat(getComputedStyle(e).fontSize) / over * 0.98).toFixed(2) + "px";
    });
  }

  /* ---------- C: side panels (help or glossary, one at a time) ---------- */
  const openPanel = () => !help.hidden ? "help" : !gloss.hidden ? "gloss" : null;
  function setPanel(name) {
    const was = openPanel();
    help.hidden = name !== "help"; gloss.hidden = name !== "gloss";
    $("#helpBtn").setAttribute("aria-pressed", String(name === "help"));
    $("#glossBtn").setAttribute("aria-pressed", String(name === "gloss"));
    state.panel = name; save();
    if (was !== name) relayout();
  }
  const toggle = name => setPanel(openPanel() === name ? null : name);
  $("#helpBtn").onclick = () => toggle("help");
  $("#glossBtn").onclick = () => toggle("gloss");
  $("#helpClose").onclick = () => setPanel(null);
  $("#glossClose").onclick = () => setPanel(null);

  /* ---------- C: navigation, discrete, no scrolling ---------- */
  const rail = $("#rail"), screens = $$(".screen"), segs = $("#segs");
  if (!Array.isArray(state.seen)) state.seen = [];
  screens.forEach((s, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", `${i}. ${s.dataset.title}`);
    b.title = s.dataset.title;
    b.onclick = () => go(i);
    segs.appendChild(b);
  });
  const segBtns = [...segs.children];
  screens.forEach(s => s.classList.toggle("solo", !$(".fig", s)));  // no figure: a centred reading column

  /* ---------- C: movable split between text and figure (a viewer convenience, never vault state) ---------- */
  const SPLIT = { min: 25, max: 65, def: 42 }, stage = $(".stage");
  let split = SPLIT.def, userSplit = false;
  const handles = [];
  const setSplit = (v, keep = true) => {
    split = Math.max(SPLIT.min, Math.min(SPLIT.max, Math.round(v * 10) / 10));
    body.style.setProperty("--split", split + "%");
    handles.forEach(h => h.setAttribute("aria-valuenow", String(Math.round(split))));
    if (keep) { userSplit = true; try { localStorage.setItem("cognia:split", String(split)); } catch {} }
    relayout();
  };
  screens.forEach(s => {
    if (!$(".text", s) || !$(".fig", s)) return;
    const h = Object.assign(document.createElement("div"), { className: "split", tabIndex: 0 });
    h.setAttribute("role", "separator"); h.setAttribute("aria-orientation", "vertical");
    h.setAttribute("aria-label", "Resize text and figure (arrow keys, Home resets)");
    h.setAttribute("aria-valuemin", SPLIT.min); h.setAttribute("aria-valuemax", SPLIT.max); h.setAttribute("aria-valuenow", SPLIT.def);
    h.addEventListener("pointerdown", e => {
      h.setPointerCapture(e.pointerId); h.classList.add("drag");
      const move = ev => { const r = stage.getBoundingClientRect(); setSplit((ev.clientX - r.left) / r.width * 100); };
      const up = () => { h.classList.remove("drag"); h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
      e.preventDefault();
    });
    h.addEventListener("dblclick", () => { setSplit(SPLIT.def, false); userSplit = false; try { localStorage.removeItem("cognia:split"); } catch {} relayout(); });
    h.addEventListener("keydown", e => {
      const step = { ArrowLeft: -2, ArrowRight: 2 }[e.key];
      if (step) setSplit(split + step); else if (e.key === "Home") { setSplit(SPLIT.def, false); userSplit = false; try { localStorage.removeItem("cognia:split"); } catch {} relayout(); } else return;
      e.preventDefault(); e.stopPropagation();
    });
    $(".text", s).after(h); handles.push(h);
  });
  if (!CHECK) try { const v = parseFloat(localStorage.getItem("cognia:split")); if (v >= SPLIT.min && v <= SPLIT.max) { setSplit(v, false); userSplit = true; } } catch {}

  /* ---------- C: fit ladder ----------
     Every screen is fitted from measurements, so no screen relies on its author counting words.
     The shell tries each step in order, keeping what it did, until the text column fits:
       1. balance the split (unless the reader dragged it), giving the text just the width it needs;
       2. move the note and evidence blocks under the figure, while the figure keeps half its column;
       3. fold the note, the evidence strength line and long symbol lists into one-line disclosures;
       4. page the text: the column becomes pages the reader turns with Next, the figure staying put.
     Then the figure column: a caption that leaves the figure under 40% of its column is clamped. */
  const PHONE = () => matchMedia("(max-width: 860px)").matches;
  const fitsY = el => !el || el.scrollHeight <= el.clientHeight + 1;
  const mainOf = fig => fig && $("figure > svg, figure > .diagram", fig);
  const figRoom = fig => { const m = mainOf(fig); return !m || m.getBoundingClientRect().height >= 0.5 * fig.clientHeight; };
  function unfit(s) {
    (s._undo || []).reverse().forEach(f => f());
    s._undo = [];
    s._pages = 1;
    s.style.removeProperty("--split");
  }
  function fold(el, title, s) {
    const d = Object.assign(document.createElement("details"), { className: "fold" });
    d.innerHTML = `<summary>${title}</summary>`;
    el.replaceWith(d); d.appendChild(el);
    let folded = true;
    const open = () => { if (folded) { d.replaceWith(el); folded = false; } }, close = () => { if (!folded) { el.replaceWith(d); d.appendChild(el); folded = true; } };
    s._undo.push(open);
    return { open, close };
  }
  // Page one column (text, or a figure column that holds text): the browser's own multi-column layout
  // breaks it into column-sized pages, so the page size is whatever the column measures right now.
  function paginate(s, col) {
    const flow = Object.assign(document.createElement("div"), { className: "flow" });
    const kids = [...col.childNodes];
    kids.forEach(k => flow.appendChild(k));
    col.appendChild(flow); col.classList.add("paged");
    const cs = getComputedStyle(col), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const W = col.clientWidth - padX, H = col.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), G = padX + 8;
    Object.assign(flow.style, { height: H + "px", columnWidth: W + "px", columnGap: G + "px", width: W + "px" });
    flow._pages = Math.max(1, Math.round((flow.scrollWidth + G) / (W + G)));
    flow._step = W + G;
    const pager = Object.assign(document.createElement("span"), { className: "pager" });
    if (flow._pages > 1) col.appendChild(pager);
    const keepLeft = () => { col.scrollLeft = 0; };
    col.addEventListener("scroll", keepLeft);
    s._undo.push(() => {
      col.removeEventListener("scroll", keepLeft);
      pager.remove(); kids.forEach(k => col.insertBefore(k, flow)); flow.remove(); col.classList.remove("paged");
    });
    s._pages = Math.max(s._pages || 1, flow._pages);
  }
  function showPage(s, p) {
    s._page = p;
    $$(".flow", s).forEach(flow => {
      const q = Math.min(p, flow._pages - 1), pager = $(":scope > .pager", flow.parentElement);
      flow.style.transform = `translateX(${-q * flow._step}px)`;
      if (pager) pager.textContent = `${q + 1} / ${flow._pages}`;
      // only the page in view takes focus and is read out (positions relative to the flow, so the slide does not matter)
      const f = flow.getBoundingClientRect();
      $$(":scope > *", flow).forEach(el => {
        const rs = [...el.getClientRects()];
        if (!rs.length) return;
        const first = Math.floor((rs[0].left - f.left + 1) / flow._step), last = Math.floor((rs[rs.length - 1].right - f.left - 1) / flow._step);
        el.inert = q < first || q > last;
      });
    });
  }
  function fitScreen(s) {
    unfit(s);
    const text = $(".text", s), fig = $(".fig", s);
    $$("figcaption.clamped", s).forEach(c => c.classList.remove("clamped"));
    $$(".capmore", s).forEach(b => b.remove());
    const statics = () => $$("figure > svg", s).filter(svg => !figs.some(f => f.svg === svg)).forEach(fitLabels);
    $$(".diagram", s).forEach(drawDiagram);
    fitEquations(s);
    if (!text || PHONE()) { drawFigs(s); statics(); return; }
    // 0. a crowded figure column: clamp the captions, then move the prediction gate to the end of the text
    const crowded = () => { const m = mainOf(fig); return !!m && m.getBoundingClientRect().height < 0.4 * fig.clientHeight; };
    if (fig && crowded()) {
      $$("figcaption", fig).forEach(c => {
        c.classList.add("clamped");
        const b = Object.assign(document.createElement("button"), { className: "btn small capmore", type: "button", textContent: "Full caption" });
        b.onclick = () => { c.classList.remove("clamped"); b.remove(); };
        c.after(b);
      });
      if (crowded()) $$(":scope > .gate", fig).forEach(g => {
        const mark = document.createComment("gate");
        g.replaceWith(mark); text.appendChild(g);
        s._undo.push(() => mark.replaceWith(g));
      });
    }
    const set = v => { s.style.setProperty("--split", v + "%"); return fitsY(text); };
    if (!fitsY(text) && fig && !userSplit) {  // 1. balance the split: the text takes only the width it needs
      if (set(SPLIT.max)) {
        let lo = split, hi = SPLIT.max;
        while (hi - lo > 0.5) { const mid = (lo + hi) / 2; if (set(mid)) hi = mid; else lo = mid; }
        set(hi);
      } else s.style.removeProperty("--split");
      fitEquations(s);
    } else if (fig && !userSplit && $$(".diagram", fig).some(d => d.style.fontSize)) {
      // the other way: a diagram had to shrink and the text has room, so the figure takes the spare width
      let lo = SPLIT.min, hi = split;
      while (hi - lo > 0.5) { const mid = (lo + hi) / 2; if (set(mid)) hi = mid; else lo = mid; }
      set(hi);
      $$(".diagram", fig).forEach(drawDiagram);
      fitEquations(s);
    }
    if (!fitsY(text) && fig) {  // 2. move asides under the figure
      for (const el of $$(":scope > .note, :scope > div.evidence", text).reverse()) {
        const mark = document.createComment("aside");
        el.replaceWith(mark); fig.appendChild(el); el.classList.add("moved");
        if (!figRoom(fig) || !fitsY(fig)) { mark.replaceWith(el); el.classList.remove("moved"); continue; }
        s._undo.push(() => { el.classList.remove("moved"); mark.replaceWith(el); });
        if (fitsY(text)) break;
      }
    }
    if (!fitsY(text)) {  // 3. fold what can be skimmed past
      const folds = [...$$(":scope > .note", text).map(el => [el, "Note"]),
                     ...$$("div.evidence > .strength", text).map(el => [el, "Strength"]),
                     ...$$(".equation .where", text).filter(dl => dl.children.length > 6).map(el => [el, "Symbols"])];
      const done = [];
      for (const [el, title] of folds) { done.push(fold(el, title, s)); if (fitsY(text)) break; }
      if (fitsY(text)) done.slice(0, -1).reverse().forEach(f => { f.open(); if (!fitsY(text)) f.close(); });
    }
    if (!fitsY(text)) paginate(s, text);  // 4. page the text
    if (fig) {
      // the figure keeps at least 40% of its column; whatever else does not fit pages like the text
      const m = mainOf(fig);
      if (crowded()) { m.style.minHeight = 0.4 * fig.clientHeight + "px"; s._undo.push(() => { m.style.minHeight = ""; }); }
      if (!fitsY(fig)) paginate(s, fig);
      $$(".diagram", fig).forEach(drawDiagram);
      drawFigs(s); statics();
    }
    showPage(s, Math.min(s._page || 0, (s._pages || 1) - 1));
  }
  let pending = 0;
  function relayout() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { screens.forEach(fitScreen); if (cur >= 0) go(cur, true, screens[cur]._page || 0); });
  }
  const redraw = relayout;
  let cur = -1;
  // go(i, force, page): page -1 opens the screen's last page (moving back).
  function go(i, force = false, page = 0) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    if (i === cur && !force) return;
    cur = i;
    const s = screens[i], pages = s._pages || 1;
    showPage(s, page < 0 ? pages - 1 : Math.min(page, pages - 1));
    rail.style.transform = `translateX(${-100 * i}%)`;
    screens.forEach((s, j) => { s.inert = j !== i; s.setAttribute("aria-hidden", String(j !== i)); });
    if (!state.seen.includes(i)) state.seen.push(i);
    segBtns.forEach((b, j) => { b.setAttribute("aria-current", String(j === i)); b.classList.toggle("seen", state.seen.includes(j)); });
    const title = k => screens[k] ? screens[k].dataset.title : "";
    const p = s._page || 0, more = p < pages - 1;
    $("#prev").disabled = i === 0 && p === 0;
    $("#next").disabled = i === screens.length - 1 && !more;
    $("#prevLabel").textContent = p > 0 ? "Back a page" : title(i - 1);
    $("#nextLabel").textContent = more ? "Continue" : title(i + 1);
    $("#storyTitle").textContent = `${i === 0 ? "Start" : i + " of " + (screens.length - 1)} · ${title(i)}${pages > 1 ? ` · page ${p + 1} of ${pages}` : ""}`;
    $("#timeLeft").textContent = `~${screens.slice(i).reduce((m, s) => m + +(s.dataset.min || 0), 0)} min left`;
    state.last = i; state.page = s._page || 0; save();
    if (!CHECK) history.replaceState(null, "", "#" + i);
  }
  // Next turns the screen's pages first, then moves on; Prev does the reverse.
  const step = d => {
    const s = screens[cur], p = (s._page || 0) + d;
    if (p >= 0 && p < (s._pages || 1)) go(cur, true, p);
    else if (cur + d >= 0 && cur + d < screens.length) go(cur + d, false, d < 0 ? -1 : 0);
  };
  $("#prev").onclick = () => step(-1);
  $("#next").onclick = () => step(1);
  addEventListener("keydown", e => {
    if (e.key === "Escape" && openPanel()) { setPanel(null); return; }
    if (e.target.closest("textarea, input, [role=separator]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "?" || e.key === "h" || e.key === "H") { e.preventDefault(); toggle("help"); return; }
    if ((e.key === "g" || e.key === "G") && entries.length) { e.preventDefault(); toggle("gloss"); return; }
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); step(1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); step(-1); }
  });

  /* ---------- C: glossary "Used on" buttons, from the term links in each screen ---------- */
  entries.forEach(e => {
    const used = [...new Set($$(`a.gl[href="#${e.id}"]`).map(a => screens.indexOf(a.closest(".screen"))).filter(i => i >= 0))].sort((a, b) => a - b);
    if (!used.length) return;
    const div = document.createElement("div");
    div.className = "used";
    div.innerHTML = `<span class="label">Used on</span>` + used.map(i => `<button class="btn small" type="button" data-go="${i}">${i ? "screen " + i : "start"} · ${screens[i].dataset.title}</button>`).join("");
    $$("[data-go]", div).forEach(b => b.onclick = () => { go(+b.dataset.go); if (matchMedia("(max-width: 860px)").matches) setPanel(null); });
    e.appendChild(div);
  });

  /* ---------- C: prediction gates (first answer is kept) ----------
     <div class="gate" data-answer="b" data-unlocks="#s1 #s2" data-reveals="#notice">
       <p>Predict first: …</p><div class="opts"><button class="btn" data-choice="a" data-why="…">…</button>…</div>
       <div class="verdict" hidden></div></div> */
  if (typeof state.pred !== "object" || !state.pred) state.pred = {};
  const gates = $$(".gate");
  function unlockGate(g, k, choice) {
    const btns = $$("[data-choice]", g), picked = btns.find(b => b.dataset.choice === choice);
    btns.forEach(b => {
      b.disabled = true;
      if (b.dataset.choice === g.dataset.answer) b.classList.add("right");
      else if (b === picked) b.classList.add("wrong");
    });
    const v = $(".verdict", g);
    v.textContent = `You predicted “${picked ? picked.textContent : choice}”. ${picked ? picked.dataset.why || "" : ""}`;
    v.hidden = false;
    (g.dataset.unlocks || "").split(/\s+/).filter(Boolean).forEach(s => $(s).disabled = false);
    (g.dataset.reveals || "").split(/\s+/).filter(Boolean).forEach(s => $(s).hidden = false);
    requestAnimationFrame(redraw);
  }
  gates.forEach((g, k) => {
    $$("[data-choice]", g).forEach(b => b.onclick = () => {
      if (!state.pred[k]) { state.pred[k] = b.dataset.choice; save(); }
      unlockGate(g, k, state.pred[k]);
    });
  });

  /* ---------- C: step reveal ----------
     <ol class="steps">…</ol> plus, in the same screen, buttons [data-step="next"] and [data-step="all"]
     and a <span class="hint step-count">. */
  if (typeof state.steps !== "object" || !state.steps) state.steps = {};
  $$("ol.steps").forEach((ol, k) => {
    const items = $$("li", ol), scr = ol.closest(".screen");
    let shown = +state.steps[k] || 1;
    const show = () => {
      items.forEach((li, i) => li.classList.toggle("locked", i >= shown));
      const c = $(".step-count", scr); if (c) c.textContent = `${shown} of ${items.length}`;
      const n = $('[data-step="next"]', scr); if (n) n.disabled = shown >= items.length;
      state.steps[k] = shown; save();
    };
    items.forEach((li, i) => li.onclick = () => { if (i >= shown) { shown = i + 1; show(); } });
    const n = $('[data-step="next"]', scr), a = $('[data-step="all"]', scr);
    if (n) n.onclick = () => { shown = Math.min(items.length, shown + 1); show(); };
    if (a) a.onclick = () => { shown = items.length; show(); };
    show();
  });

  /* ---------- C: concept map recall mode ----------
     <button class="btn" data-recall="cmapId">Recall mode</button> <span class="hint recall-hint">…</span>
     map nodes: <g class="node"> … <text class="lbl">…</text><text class="qm">?</text></g> */
  $$("[data-recall]").forEach(btn => {
    const map = $("#" + btn.dataset.recall), hint = $(".recall-hint", btn.parentElement);
    btn.setAttribute("aria-pressed", "false");
    btn.onclick = () => {
      const on = !map.classList.contains("recall");
      map.classList.toggle("recall", on);
      $$(".node", map).forEach(n => n.classList.remove("shown"));
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "Show all labels" : "Recall mode";
      if (hint) hint.textContent = on ? "Name each box, then click it to check." : "Hides every box label; the arrows stay as clues.";
    };
    $$(".node", map).forEach(n => n.addEventListener("click", () => { if (map.classList.contains("recall")) n.classList.add("shown"); }));
  });

  /* ---------- C: checks + explain-back ----------
     <button data-reveal="r1">Reveal</button> … <div class="reveal" id="r1" hidden>
     <textarea id="explain" data-concept="[[slug]]" data-source="Author Year explainer"> + #copyExplain + #copied */
  $$("[data-reveal]").forEach(b => b.onclick = () => { $("#" + b.dataset.reveal).hidden = false; b.disabled = true; });
  const ta = $("#explain");
  if (ta) {
    ta.value = state.explain || "";
    ta.oninput = () => { state.explain = ta.value; save(); };
    $("#copyExplain").onclick = async () => {
      const preds = gates.map((g, k) => {
        const c = state.pred[k]; if (!c) return "";
        const n = screens.indexOf(g.closest(".screen"));
        return `\n(Prediction on screen ${n}: ${c}${c === g.dataset.answer ? "" : ", wrong"})`;
      }).join("");
      const msg = `Explain-back for ${ta.dataset.concept || ""} (${ta.dataset.source || document.title}):\n\n${ta.value}${preds ? "\n" + preds : ""}`;
      try { await navigator.clipboard.writeText(msg); $("#copied").textContent = "Copied. Paste it to Claude."; }
      catch { ta.select(); $("#copied").textContent = "Text selected. Press Ctrl+C."; }
    };
  }

  /* ---------- C: self-check (open the page with #check; vault.py check reads the result) ----------
     Content and accessibility problems go to the author. Layout is the shell's job, so its probes run
     only with #check-layout (evals/layout.py): a hit there is a bug in the shell, not in the page. */
  function selfCheck() {
    screens.forEach(fitScreen);
    const out = [], hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const lay = msg => { if (LAYOUT) out.push("layout: " + msg); };
    const marks = new Set($$("#help [data-mark]").map(el => el.dataset.mark));
    screens.forEach((s, i) => {
      go(i, true);
      const where = `screen ${i} (${s.dataset.title})`;
      const text = $(".text", s), fig = $(".fig", s), flow = $(".flow", s);
      if (flow && flow.scrollHeight > flow.clientHeight + 1) lay(`${where}: a block is taller than the text column (${flow.scrollHeight - flow.clientHeight}px), so that page scrolls`);
      else if (text && !flow && !PHONE() && !fitsY(text)) lay(`${where}: text column overflows by ${text.scrollHeight - text.clientHeight}px`);
      if (fig && !PHONE() && !fitsY(fig)) lay(`${where}: figure column overflows by ${fig.scrollHeight - fig.clientHeight}px`);
      const m = mainOf(fig);
      if (m && !PHONE() && m.getBoundingClientRect().height < 0.3 * fig.clientHeight) lay(`${where}: the figure has only ${Math.round(m.getBoundingClientRect().height)}px of a ${fig.clientHeight}px column`);
      $$(".diagram", s).forEach(d => {
        const db = d.getBoundingClientRect(), ns = $$(".node", d).map(n => ({ n, r: n.getBoundingClientRect() }));
        ns.forEach((a, j) => {
          if (a.r.left < db.left - 1 || a.r.right > db.right + 1 || a.r.top < db.top - 1 || a.r.bottom > db.bottom + 1) lay(`${where}: diagram node "${plainText(a.n)}" leaves the diagram (by ${[db.left - a.r.left, a.r.right - db.right, db.top - a.r.top, a.r.bottom - db.bottom].map(Math.round).join("/")}px left/right/top/bottom)`);
          ns.slice(j + 1).forEach(b => { if (hit(a.r, b.r)) lay(`${where}: diagram nodes overlap: "${plainText(a.n)}" / "${plainText(b.n)}"`); });
          $$("svg.wires text", d).forEach(t => { if (hit(a.r, t.getBoundingClientRect())) lay(`${where}: arrow label "${t.textContent}" covers node "${plainText(a.n)}"`); });
        });
      });
      $$("figure > svg, .diagram > svg.wires", s).forEach(svg => {
        if (!svg.getAttribute("aria-label") && !svg.classList.contains("wires")) out.push(`${where}: figure svg has no aria-label`);
        if ((figs.some(f => f.svg === svg) || svg.hasAttribute("data-plot")) && !svg.hasAttribute("data-schematic")) {
          const ax = $(".axes", svg), tx = $$(".tick-x", svg).length, ty = $$(".tick-y", svg).length;
          if (!ax) out.push(`${where}: plot has no axes (build it with plot(), or mark a schematic data-schematic)`);
          else {
            if (!ax.dataset.xtitle) out.push(`${where}: plot has no x-axis title`);
            if (!ax.dataset.ytitle) out.push(`${where}: plot has no y-axis title`);
            if (tx < 2 || ty < 2) out.push(`${where}: plot needs at least 2 numeric ticks on each axis (has ${tx} and ${ty})`);
          }
          const cap = svg.parentElement.querySelector("figcaption");
          if (cap && !/source:/i.test(cap.textContent)) out.push(`${where}: plot caption has no "Source:" line`);
        }
        const box = svg.getBoundingClientRect();
        const ts = $$("text", svg).filter(t => getComputedStyle(t).display !== "none" && getComputedStyle(t).visibility !== "hidden").map(t => ({ t, r: t.getBoundingClientRect() })).filter(o => o.r.width > 0 && o.r.height > 0);
        ts.forEach((a, j) => {
          const r = a.r;
          if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)
            lay(`${where}: label "${a.t.textContent.trim()}" leaves the figure`);
          ts.slice(j + 1).forEach(b => {
            if (hit(r, b.r)) lay(`${where}: labels overlap: "${a.t.textContent.trim()}" / "${b.t.textContent.trim()}"`);
          });
        });
      });
      $$("a.gl", s).forEach(a => {
        const id = (a.getAttribute("href") || "").slice(1);
        if (!id || !gloss.querySelector("#" + CSS.escape(id))) out.push(`${where}: glossary link "${a.textContent.trim()}" points to no entry (${id || "empty"})`);
      });
      $$("[data-mark]", s).forEach(el => {
        if (!marks.has(el.dataset.mark)) out.push(`${where}: mark "${el.dataset.mark}" has no help entry`);
      });
    });
    entries.forEach(e => {
      if (!$(".short", e) || !$(".more", e)) out.push(`glossary entry "${ename(e)}" needs a .short line and a .more block`);
      if (!$(`a.gl[href="#${e.id}"]`)) out.push(`glossary entry "${ename(e)}" is never linked from a screen`);
    });
    $$(".katex-error").forEach(e => out.push(`equation does not parse (KaTeX error): "${e.textContent.trim().slice(0, 60)}"`));
    screens.forEach((s, i) => {
      go(i, true);
      $$(".eq", s).forEach(e => { if (e.scrollWidth > e.clientWidth + 2) lay(`screen ${i} (${s.dataset.title}): an equation is wider than its column by ${e.scrollWidth - e.clientWidth}px`); });
    });
    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      if (n.parentElement.closest("script, style, textarea, .katex")) continue;
      const tz = /\b(next (?:\w+ )?(?:screens?|sections?|slides?)|coming up|in this section|stay tuned)\b/i.exec(n.nodeValue);
      if (tz && !n.parentElement.closest("#help, .nav, button")) out.push(`transition points at the page ("${tz[0]}"), so name the concept that comes next instead: "${n.nodeValue.trim().slice(0, 60)}"`);
      if (/[A-Za-z0-9\u0370-\u03FF][_^]/.test(n.nodeValue)) out.push(`unrendered sub/superscript in: "${n.nodeValue.trim().slice(0, 60)}"`);
    }
    if (document.fonts && !document.fonts.check('16px "Atkinson Hyperlegible Next"')) out.push("fonts did not load (offline?), so sizes are measured with fallback fonts");
    const pre = document.createElement("pre");
    pre.id = "cognia-check";
    pre.textContent = JSON.stringify({ vw: innerWidth, vh: innerHeight, fs, pages: screens.map(s => s._pages || 1), problems: out });
    body.appendChild(pre);
    go(0, true);
  }

  /* ---------- start (page scripts have registered their figures by now) ---------- */
  addEventListener("DOMContentLoaded", () => {
    rail.style.transition = "none";
    // Equation blocks: number them "(1)", "(2)" per page and print the source location from data-src.
    $$(".equation").forEach((q, k) => {
      const eq = $(".eq", q);
      if (!eq) return;
      eq.insertAdjacentHTML("afterend", `<span class="eq-n" aria-label="equation ${k + 1}">(${k + 1})</span>` + (q.dataset.src ? `<span class="eq-src">(${q.dataset.src.replace(/&/g, "&amp;").replace(/</g, "&lt;")})</span>` : ""));
    });
    const fromHash = /^#(\d+)(?:&|$)/.exec(location.hash);
    const saved = state.panel || (state.help ? "help" : null);
    help.hidden = gloss.hidden = true;
    if (saved && !CHECK && (saved !== "gloss" || entries.length)) {
      (saved === "help" ? help : gloss).hidden = false;
      $(saved === "help" ? "#helpBtn" : "#glossBtn").setAttribute("aria-pressed", "true");
    }
    $$(".diagram").forEach(buildDiagram);
    $$(".screen figure svg").forEach(mathify);
    gates.forEach((g, k) => { if (state.pred[k]) unlockGate(g, k, state.pred[k]); });
    if (window.renderMathInElement) renderMathInElement(body, {
      delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }]
    });
    $$(".diagram").forEach(d => d._speak && d._speak());
    // Lay out only once the fonts (ours and KaTeX's) are in, so every measurement uses the real metrics.
    const start = fromHash ? +fromHash[1] : (CHECK ? 0 : +state.last || 0);
    go(start, true);
    const ready = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      screens.forEach(fitScreen);
      go(start, true, CHECK ? 0 : +(state.page || 0));
      new ResizeObserver(relayout).observe($(".stage"));
      // a font that arrives later (KaTeX loads its faces only when math is first set) changes sizes, so lay out again
      if (document.fonts) document.fonts.addEventListener("loadingdone", relayout);
      if (CHECK) setTimeout(selfCheck, 100);
      else requestAnimationFrame(() => requestAnimationFrame(() => { rail.style.transition = ""; }));
    });
    document.readyState === "complete" ? ready() : addEventListener("load", ready);
  });

  window.cognia = { $, $$, fig, curve, plot, bars, label, redraw, state, showEntry };
})();
