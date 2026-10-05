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
  const CHECK = location.hash === "#check";

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
  <dt><kbd>→</kbd></dt><dd>Next screen, or the dark <b>Next</b> button</dd>
  <dt><kbd>←</kbd></dt><dd>Previous screen</dd>
  <dt>${sw(34, 8, '<rect width="34" height="7" rx="3.5" style="fill:var(--accent)"/>')}</dt><dd>The bar at the bottom: one segment per screen. Click a segment to jump.</dd>
  <dt>${sw(10, 26, '<rect x="3" width="4" height="26" rx="2" style="fill:var(--accent-mid)"/>')}</dt><dd>Drag the bar between text and figure to resize. Double-click it to reset.</dd>
  <dt><kbd>?</kbd></dt><dd>Open or close this panel</dd>
  <dt><kbd>g</kbd></dt><dd>Open or close the glossary</dd>
  <dt><kbd>Esc</kbd></dt><dd>Close this panel</dd>
</dl><p class="hint">Screens never scroll sideways. If a column is taller than your window, it scrolls up and down inside itself.</p></section>
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
  const setFs = v => {
    fs = Math.max(FS.min, Math.min(FS.max, v)); root.style.setProperty("--fs", fs + "px");
    try { localStorage.setItem("cognia:fs", String(fs)); } catch {}
    if (typeof redraw === "function") requestAnimationFrame(redraw);
  };
  root.style.setProperty("--fs", fs + "px");
  const fsBtn = $("#fsDown"); if (fsBtn) { fsBtn.onclick = () => setFs(fs - 1); $("#fsUp").onclick = () => setFs(fs + 1); }

  /* ---------- C: live figures ---------- */
  const figs = [];
  const size = svg => { const r = svg.getBoundingClientRect(); return { w: Math.max(340, Math.round(r.width)), h: Math.max(240, Math.round(r.height)) }; };
  // A plot (a figure that drew an .axes group) is at most PLOT_ASPECT x its width tall, so a tall plate
  // does not stretch it. The leftover height falls below the caption and controls. data-fill opts out.
  const PLOT_ASPECT = 0.68;
  const run = f => {
    f.svg.style.flex = f.svg.style.height = "";
    let { w, h } = size(f.svg);
    const paint = () => { f.svg.setAttribute("viewBox", `0 0 ${w} ${h}`); f.draw(f.svg, w, h); mathify(f.svg); };
    paint();
    const cap = Math.round(w * PLOT_ASPECT);
    if (!f.svg.hasAttribute("data-fill") && f.svg.querySelector(".axes") && h > cap && !matchMedia("(max-width: 860px)").matches) {
      h = Math.max(240, cap);
      f.svg.style.flex = "0 0 auto"; f.svg.style.height = h + "px";
      paint();
    }
  };
  // Fixed label size: a drawing scaled by its viewBox keeps its labels at LABEL px on screen.
  const LABEL = 12.5;
  const fixText = svg => {
    const vb = (svg.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number), r = svg.getBoundingClientRect();
    if (vb.length !== 4 || !vb[2] || !r.width) return;
    const sc = Math.min(r.width / vb[2], r.height / vb[3] || Infinity);
    svg.style.setProperty("--fz", (LABEL / sc).toFixed(2) + "px");
  };
  const redraw = () => { figs.forEach(run); $$("figure > svg").forEach(fixText); };
  // cognia.fig("#figId", (svg, w, h) => { svg.innerHTML = ... }, ["#slider1", "#slider2"])
  function fig(sel, draw, inputs = []) {
    const f = { svg: $(sel), draw };
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
    const yt = ticksOf(o.y[0], o.y[1], o.ny || 5);
    const yw = Math.max(...yt.map(v => yf(v).length)) * 7.9;  // width of the widest y tick label (13px mono)
    const m = Object.assign({ l: Math.max(56, Math.ceil(yw + 9 + 8 + 16)), r: 28, t: 18, b: 48 }, o.margin);
    const X = v => m.l + (v - x0) / (x1 - x0) * (w - m.l - m.r), Y = v => h - m.b - (v - y0) / (y1 - y0) * (h - m.t - m.b);
    const xt = cats ? cats.map((_, k) => k + 0.5) : ticksOf(x0, x1, o.nx || 5);
    const cut = cats ? Array.from({ length: cats.length + 1 }, (_, k) => k) : xt;  // tick marks: category edges, or the ticks themselves
    let g = `<g class="axes" data-xtitle="${esc(o.xTitle || "")}" data-ytitle="${esc(o.yTitle || "")}">`;
    cut.forEach(v => { g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${Y(y0)}" y2="${Y(y1)}"/><line class="axis" x1="${X(v)}" x2="${X(v)}" y1="${Y(y0)}" y2="${Y(y0) + 5}"/>`; });
    xt.forEach((v, k) => { g += `<text class="tm tick-x" x="${X(v)}" y="${Y(y0) + 21}" text-anchor="middle">${cats ? esc(cats[k]) : xf(v)}</text>`; });
    yt.forEach(v => { g += `<line class="grid" x1="${X(x0)}" x2="${X(x1)}" y1="${Y(v)}" y2="${Y(v)}"/><line class="axis" x1="${X(x0) - 5}" x2="${X(x0)}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tm tick-y" x="${X(x0) - 9}" y="${Y(v) + 4}" text-anchor="end">${yf(v)}</text>`; });
    g += `<line class="axis" x1="${X(x0)}" x2="${X(x1)}" y1="${Y(y0)}" y2="${Y(y0)}"/><line class="axis" x1="${X(x0)}" x2="${X(x0)}" y1="${Y(y0)}" y2="${Y(y1)}"/>`;
    g += `<text class="ts" x="${(X(x0) + X(x1)) / 2}" y="${Y(y0) + 40}" text-anchor="middle">${esc(o.xTitle || "")}</text>`;
    g += `<text class="ts" transform="translate(${X(x0) - Math.ceil(yw) - 18} ${(Y(y0) + Y(y1)) / 2}) rotate(-90)" text-anchor="middle">${esc(o.yTitle || "")}</text></g>`;
    return { X, Y, axes: g, box: { l: X(x0), r: X(x1), t: Y(y1), b: Y(y0) } };
  };

  /* ---------- C: side panels (help or glossary, one at a time) ---------- */
  const openPanel = () => !help.hidden ? "help" : !gloss.hidden ? "gloss" : null;
  function setPanel(name) {
    const was = openPanel();
    help.hidden = name !== "help"; gloss.hidden = name !== "gloss";
    $("#helpBtn").setAttribute("aria-pressed", String(name === "help"));
    $("#glossBtn").setAttribute("aria-pressed", String(name === "gloss"));
    state.panel = name; save();
    if (was !== name) requestAnimationFrame(() => { go(cur, true); redraw(); });
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
  let split = SPLIT.def, frame = 0;
  const handles = [];
  const setSplit = (v, keep = true) => {
    split = Math.max(SPLIT.min, Math.min(SPLIT.max, Math.round(v * 10) / 10));
    body.style.setProperty("--split", split + "%");
    handles.forEach(h => h.setAttribute("aria-valuenow", String(Math.round(split))));
    if (keep) try { localStorage.setItem("cognia:split", String(split)); } catch {}
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(redraw);
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
    h.addEventListener("dblclick", () => setSplit(SPLIT.def));
    h.addEventListener("keydown", e => {
      const step = { ArrowLeft: -2, ArrowRight: 2 }[e.key];
      if (step) setSplit(split + step); else if (e.key === "Home") setSplit(SPLIT.def); else return;
      e.preventDefault(); e.stopPropagation();
    });
    $(".text", s).after(h); handles.push(h);
  });
  if (!CHECK) try { const v = parseFloat(localStorage.getItem("cognia:split")); if (v >= SPLIT.min && v <= SPLIT.max) setSplit(v, false); } catch {}
  let cur = -1;
  function go(i, force = false) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    if (i === cur && !force) return;
    cur = i;
    rail.style.transform = `translateX(${-100 * i}%)`;
    screens.forEach((s, j) => { s.inert = j !== i; s.setAttribute("aria-hidden", String(j !== i)); });
    if (!state.seen.includes(i)) state.seen.push(i);
    segBtns.forEach((b, j) => { b.setAttribute("aria-current", String(j === i)); b.classList.toggle("seen", state.seen.includes(j)); });
    const title = k => screens[k] ? screens[k].dataset.title : "";
    $("#prev").disabled = i === 0;
    $("#next").disabled = i === screens.length - 1;
    $("#prevLabel").textContent = title(i - 1);
    $("#nextLabel").textContent = title(i + 1);
    $("#storyTitle").textContent = `${i === 0 ? "Start" : i + " of " + (screens.length - 1)} · ${title(i)}`;
    $("#timeLeft").textContent = `~${screens.slice(i).reduce((m, s) => m + +(s.dataset.min || 0), 0)} min left`;
    state.last = i; save();
    if (!CHECK) history.replaceState(null, "", "#" + i);
  }
  $("#prev").onclick = () => go(cur - 1);
  $("#next").onclick = () => go(cur + 1);
  addEventListener("keydown", e => {
    if (e.key === "Escape" && openPanel()) { setPanel(null); return; }
    if (e.target.closest("textarea, input, [role=separator]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "?" || e.key === "h" || e.key === "H") { e.preventDefault(); toggle("help"); return; }
    if ((e.key === "g" || e.key === "G") && entries.length) { e.preventDefault(); toggle("gloss"); return; }
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(cur + 1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(cur - 1); }
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

  /* ---------- C: self-check (open the page with #check; vault.py check reads the result) ---------- */
  function selfCheck() {
    redraw();
    const out = [], hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const marks = new Set($$("#help [data-mark]").map(el => el.dataset.mark));
    screens.forEach((s, i) => {
      go(i, true);
      const where = `screen ${i} (${s.dataset.title})`;
      $$(".text, .fig", s).forEach(col => {
        const over = col.scrollHeight - col.clientHeight;
        if (over > 2) out.push(`${over > col.clientHeight * 0.15 ? "" : "warning: "}${where}: ${col.className} column overflows by ${over}px (${Math.round(over / col.clientHeight * 100)}%); split it into a figure screen and a reading screen`);
      });
      $$("figure > svg", s).forEach(svg => {
        if (!svg.getAttribute("aria-label")) out.push(`${where}: figure svg has no aria-label`);
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
        const ts = $$("text", svg).map(t => ({ t, r: t.getBoundingClientRect() })).filter(o => o.r.width > 0 && o.r.height > 0);
        ts.forEach((a, j) => {
          const r = a.r;
          if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)
            out.push(`${where}: label "${a.t.textContent.trim()}" leaves the figure`);
          ts.slice(j + 1).forEach(b => {
            if (hit(r, b.r)) out.push(`${where}: labels overlap: "${a.t.textContent.trim()}" / "${b.t.textContent.trim()}"`);
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
      $$(".eq", s).forEach(e => { if (e.scrollWidth > e.clientWidth + 2) out.push(`screen ${i} (${s.dataset.title}): an equation is wider than its column by ${e.scrollWidth - e.clientWidth}px`); });
    });
    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      if (n.parentElement.closest("script, style, textarea, .katex")) continue;
      const tz = /\b(next (?:\w+ )?(?:screens?|sections?|slides?)|coming up|we['\u2019]ll see|let['\u2019]s|in this section|stay tuned)\b/i.exec(n.nodeValue);
      if (tz && !n.parentElement.closest("#help, .nav, button")) out.push(`transition points at the page ("${tz[0]}"), so name the concept that comes next instead: "${n.nodeValue.trim().slice(0, 60)}"`);
      if (/[A-Za-z0-9\u0370-\u03FF][_^]/.test(n.nodeValue)) out.push(`unrendered sub/superscript in: "${n.nodeValue.trim().slice(0, 60)}"`);
    }
    if (document.fonts && !document.fonts.check('16px "Atkinson Hyperlegible Next"')) out.push("fonts did not load (offline?), so sizes are measured with fallback fonts");
    const pre = document.createElement("pre");
    pre.id = "cognia-check";
    pre.textContent = JSON.stringify({ vw: innerWidth, vh: innerHeight, problems: out });
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
    const fromHash = /^#(\d+)$/.exec(location.hash);
    const saved = state.panel || (state.help ? "help" : null);
    help.hidden = gloss.hidden = true;
    if (saved && !CHECK && (saved !== "gloss" || entries.length)) {
      (saved === "help" ? help : gloss).hidden = false;
      $(saved === "help" ? "#helpBtn" : "#glossBtn").setAttribute("aria-pressed", "true");
    }
    $$(".screen figure svg").forEach(mathify);
    go(fromHash ? +fromHash[1] : (CHECK ? 0 : +state.last || 0));
    redraw();
    gates.forEach((g, k) => { if (state.pred[k]) unlockGate(g, k, state.pred[k]); });
    new ResizeObserver(() => redraw()).observe($(".stage"));
    if (window.renderMathInElement) renderMathInElement(body, {
      delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }]
    });
    if (CHECK) {
      const ready = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(selfCheck, 100));
      document.readyState === "complete" ? ready() : addEventListener("load", ready);
    } else requestAnimationFrame(() => requestAnimationFrame(() => { rail.style.transition = ""; }));
  });

  window.cognia = { $, $$, fig, curve, plot, redraw, state, showEntry };
})();
