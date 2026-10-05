/* cognia essay page renderer. vault.py essay embeds the Markdown (#md) and a glossary map built
   from the vault's concept pages (#gl); this turns them into one Substack-style column.
   Handles: $ and $$ math, ```mermaid, [[wikilinks]] (tap for the gist), > [!type]- callouts,
   [^n] footnotes, a dek under the title, and an A to Z glossary at the end. */
(() => {
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const esc = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const gloss = JSON.parse($("#gl").textContent || "{}");
  let md = $("#md").textContent.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

  /* 1. pull math out so Markdown cannot mangle it */
  const math = [];
  const keep = (tex, display) => `MATH${math.push({ tex, display }) - 1}X`;
  md = md.replace(/```[\s\S]*?```/g, m => m.replace(/\$/g, "\u0001"));          // leave code fences alone
  md = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t.trim(), true));
  md = md.replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g, (_, pre, t) => pre + keep(t, false));
  md = md.replace(/\u0001/g, "$");

  /* 2. footnotes: definitions out, references to superscripts */
  const notes = {}, order = [];
  md = md.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_, id, text) => { notes[id] = text; return ""; });
  md = md.replace(/\[\^([^\]]+)\]/g, (_, id) => {
    if (!order.includes(id)) order.push(id);
    const n = order.indexOf(id) + 1;
    return `<sup class="fn"><a href="#fn-${n}" id="fnref-${n}">${n}</a></sup>`;
  });

  /* 3. wikilinks: [[slug]], [[slug|text]], [[slug#part|text]] */
  const used = new Map();
  const label = slug => (gloss[slug] && gloss[slug].title) || slug.replace(/-/g, " ");
  md = md.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, target, text) => {
    const slug = (gloss.__alias && gloss.__alias[target.trim().toLowerCase()]) || target.trim();
    used.set(slug, true);
    return `<a class="gl" href="#g-${encodeURIComponent(slug)}" data-g="${esc(slug)}">${text || label(slug)}</a>`;
  });

  /* 4. Markdown to HTML */
  const art = $("#essay");
  art.innerHTML = marked.parse(md, { gfm: true, breaks: false });

  /* 5. put math back, for KaTeX */
  art.innerHTML = art.innerHTML
    .replace(/<p>\s*MATH(\d+)X\s*<\/p>/g, (_, i) => `<div class="math-block">\\[${esc(math[i].tex)}\\]</div>`)
    .replace(/MATH(\d+)X/g, (_, i) => math[i].display ? `<div class="math-block">\\[${esc(math[i].tex)}\\]</div>` : `\\(${esc(math[i].tex)}\\)`);

  /* 5b. a display equation, its "Where:" list and "(Source: ...)" line become one numbered block */
  $$(".math-block", art).forEach((m, k) => {
    const box = document.createElement("div");
    box.className = "equation";
    m.before(box);
    box.appendChild(m);
    const n = document.createElement("span");
    n.className = "eq-n"; n.textContent = `(${k + 1})`;
    m.after(n);
    let el = box.nextElementSibling;
    if (el && el.tagName === "P" && /^Where:?$/i.test(el.textContent.trim())) { el.className = "where-h"; box.appendChild(el); el = box.nextElementSibling; }
    if (el && (el.tagName === "UL" || el.tagName === "OL") && box.querySelector(".where-h")) { el.className = "where"; box.appendChild(el); el = box.nextElementSibling; }
    if (el && el.tagName === "P" && /^\(Source:/i.test(el.textContent.trim())) { el.className = "eq-src"; box.appendChild(el); }
  });

  /* 6. structure: dek, callouts, mermaid, tables */
  const h1 = $("h1", art), next = h1 && h1.nextElementSibling;
  if (h1) document.title = h1.textContent + " · Cognia";
  if (h1) $(".ttl").textContent = h1.textContent;
  if (next && next.tagName === "P" && next.children.length === 1 && next.firstElementChild.tagName === "EM" && next.textContent.trim() === next.firstElementChild.textContent.trim()) next.classList.add("dek");
  $$("blockquote", art).forEach(q => {
    const p = q.firstElementChild, m = p && /^\[!(\w+)\]([+-]?)\s*(.*)/.exec(p.innerHTML.split("\n")[0]);
    if (!m) return;
    const d = document.createElement("details");
    d.className = "callout " + m[1].toLowerCase();
    d.open = m[2] !== "-";
    const rest = p.innerHTML.split("\n").slice(1).join("\n");
    d.innerHTML = `<summary>${m[3] || m[1]}</summary>${rest ? `<p>${rest}</p>` : ""}`;
    [...q.children].slice(1).forEach(c => d.appendChild(c));
    q.replaceWith(d);
  });
  const mermaids = $$("pre > code.language-mermaid", art).map(code => {
    const fig = document.createElement("div");
    fig.className = "figure";
    fig.dataset.src = code.textContent;
    code.parentElement.replaceWith(fig);
    return fig;
  });
  $$("table", art).forEach(t => { const w = document.createElement("div"); w.className = "table-wrap"; t.before(w); w.appendChild(t); });

  /* 7. footnote list */
  if (order.length) {
    const sec = document.createElement("section");
    sec.className = "footnotes";
    sec.innerHTML = "<ol>" + order.map((id, k) => `<li id="fn-${k + 1}">${marked.parseInline(notes[id] || "")} <a href="#fnref-${k + 1}" aria-label="Back to text">↩</a></li>`).join("") + "</ol>";
    art.appendChild(sec);
  }

  /* 8. glossary at the end, plus tap-to-peek in the text */
  const slugs = [...used.keys()].sort((a, b) => label(a).localeCompare(label(b)));
  const gsec = $("#glossary");
  if (slugs.length) {
    gsec.innerHTML = `<h2>Glossary</h2><nav class="gindex" aria-label="Glossary index">${slugs.map(s => `<a href="#g-${encodeURIComponent(s)}">${esc(label(s))}</a>`).join("")}</nav>` +
      slugs.map(s => `<div class="gentry" id="g-${esc(s)}"><h3>${esc(label(s))}</h3><p>${esc((gloss[s] && gloss[s].gist) || "Not in your vault yet.")}</p></div>`).join("");
    gsec.hidden = false;
    $("#glossLink").hidden = false;
  }
  art.addEventListener("click", ev => {
    const a = ev.target.closest("a.gl");
    if (!a) return;
    ev.preventDefault();
    const open = a.nextElementSibling && a.nextElementSibling.classList.contains("pop");
    $$(".pop", art).forEach(p => p.remove());
    if (open) return;
    const s = a.dataset.g, pop = document.createElement("span");
    pop.className = "pop";
    pop.innerHTML = `<b>${esc(label(s))}.</b> ${esc((gloss[s] && gloss[s].gist) || "Not in your vault yet.")} <a href="#g-${encodeURIComponent(s)}">Glossary</a>`;
    a.after(pop);
  });
  gsec.addEventListener("click", ev => {
    const a = ev.target.closest(".gindex a"); if (!a) return;
    const e = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
    if (e) { e.classList.remove("flash"); void e.offsetWidth; e.classList.add("flash"); }
  });

  /* 9. theme, math, diagrams, progress */
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = v => getComputedStyle(root).getPropertyValue(v).trim();
  const HUES = ["slate", "clay", "sage", "ochre", "plum", "teal", "rose", "stone"];  // same order as s-1..s-8 in the explainer
  async function drawMermaid() {
    if (!window.mermaid || !mermaids.length) return;
    mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "strict", fontFamily: css("--f-body"),
      themeVariables: { primaryColor: css("--plate"), primaryTextColor: css("--ink"), primaryBorderColor: css("--ink-2"),
        lineColor: css("--ink-2"), secondaryColor: css("--accent-soft"), tertiaryColor: css("--paper"), background: css("--plate"),
        textColor: css("--ink"), fontSize: "15px",
        ...Object.fromEntries(HUES.map((h, i) => [`pie${i + 1}`, css("--c-" + h)])),
        xyChart: { plotColorPalette: HUES.map(h => css("--c-" + h)).join(","), backgroundColor: css("--plate"), titleColor: css("--ink"),
          xAxisLabelColor: css("--ink-2"), yAxisLabelColor: css("--ink-2"), xAxisTitleColor: css("--ink-2"), yAxisTitleColor: css("--ink-2"),
          xAxisLineColor: css("--ink-2"), yAxisLineColor: css("--ink-2") } } });
    for (const [k, fig] of mermaids.entries()) {
      try { const { svg } = await mermaid.render(`mmd${k}-${Date.now()}`, fig.dataset.src); fig.innerHTML = svg; }
      catch { fig.innerHTML = `<pre>${esc(fig.dataset.src)}</pre>`; }
    }
  }
  const themeLabel = () => { $("#themeBtn").textContent = isDark() ? "Light" : "Dark"; };
  $("#themeBtn").onclick = () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("cognia:theme", root.dataset.theme); } catch {}
    themeLabel(); drawMermaid();
  };
  themeLabel();
  const words = art.textContent.trim().split(/\s+/).length;
  $("#readTime").textContent = `${Math.max(1, Math.round(words / 230))} min read`;
  const bar = $(".progress");
  const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 100) + "%"; };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("DOMContentLoaded", () => {
    if (window.renderMathInElement) renderMathInElement(art, { delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }] });
    drawMermaid();
    onScroll();
  });
})();
