# Screen patterns

Copy-ready markup for the page made by `vault.py lesson`. The shell (`assets/cognia.js`) wires
every control from these attributes, so a page needs no JS beyond `fig(...)` calls. Classes
for SVG text and shapes are listed at the end. `core/engine/examples/saez-2001-explainer.html` shows all of
them in use; open it only to see how a finished screen looks.

## Claim screen (every screen starts from this)

```html
<section class="screen" data-title="The loss" data-min="4">
  <div class="text">
    <div class="kicker"><b>3</b> / 8 · The loss</div>
    <p class="sofar">So far: the gain is the slice above the line.</p>
    <h2>The loss depends on how much reported income shrinks.</h2>
    <div class="prose"><p>…</p><p>…</p></div>
    <div class="note"><b>Same person as screen 2.</b> …</div>
  </div>
  <div class="fig">
    <figure>
      <svg viewBox="0 0 800 500" role="img" aria-label="(the figure's one claim)">…</svg>
      <figcaption><b>What to notice:</b> …</figcaption>
    </figure>
  </div>
</section>
```

Screen 0 uses `<div class="kicker"><b>Start</b></div>`, an `<h1>`, and no "So far" line.
Glossary terms: `<a class="gl" href="#g-slug">term</a>` (see Glossary). Emphasis that is not a
glossary term: `<strong class="key">`. Math: `\( \)` inline, `<p class="eq">\[ \]</p>` display.

## Live figure with controls

```html
<figure>
  <svg id="figLoss" role="img" aria-label="…"></svg>
  <div class="controls">
    <div class="readout"><small>tax lost per top earner</small><span id="lostOut"></span></div>
    <label for="e1"><span>elasticity <span class="sym">e</span></span><b id="e1Val"></b><input type="range" id="e1" min="0" max="1.5" step="0.05" value="0.25"></label>
  </div>
  <figcaption><b>What to notice:</b> …</figcaption>
</figure>
```

```js
fig("#figLoss", (svg, w, h) => {
  const e = +$("#e1").value;
  $("#e1Val").textContent = e.toFixed(2);
  const X = x => 40 + x * (w - 60), Y = y => h - 40 - y * (h - 80);
  svg.innerHTML = `<path class="acc-line" d="${curve(x => x * e, 0, 1, 100, X, Y)}"/>`;
}, ["#e1"]);
```

`fig` sizes the viewBox to the box and redraws on resize and on input. `curve(fn, x0, x1, n, X, Y)`
returns a path. Draw at the box size; never stretch a fixed viewBox.

## Prediction gate

Put it above the figure whose sliders it locks; give those sliders `disabled`.

```html
<div class="gate" data-answer="less" data-unlocks="#e1 #a1" data-reveals="#meetNotice">
  <p>Predict first: if \(e\) doubles, the best rate…</p>
  <div class="opts">
    <button class="btn" data-choice="half" data-why="Not quite. It falls from 73% to 57%.">halves</button>
    <button class="btn" data-choice="less" data-why="Right. It falls from 73% to 57%.">falls, but by less than half</button>
  </div>
  <div class="verdict" hidden></div>
</div>
```

The figcaption that gives the answer away gets `id="meetNotice" hidden`.

## Step-reveal math (the "In symbols" screen)

```html
<div class="label">Read it step by step · click a step or use the button</div>
<ol class="steps">
  <li><span>Mechanical gain: \(d\tau\,(z_m - \bar z)\).</span><span class="why">The slice, taxed at the extra rate.<span class="ref">screen 2</span></span></li>
</ol>
<div class="row"><button class="btn solid" data-step="next">Next step</button><button class="btn" data-step="all">Show all</button><span class="hint step-count"></span></div>
```

Symbol table: a plain `<table>` with columns Symbol, Meaning, Where you met it.

## Evidence table (the "What to doubt" screen)

```html
<table class="evidence">
  <tr><th>Evidence</th><th>Claim</th><th>Basis</th></tr>
  <tr><td><span class="tag established"><i></i>Established</span></td><td>…</td><td>…</td></tr>
</table>
```

Tags: `established`, `derived`, `interpretation`, `external`, `open`.

## Concept map with recall

```html
<div class="row"><button class="btn" data-recall="cmap">Recall mode</button><span class="hint recall-hint">Hides every box label; the arrows stay as clues.</span></div>
<figure>
  <svg class="cmap" id="cmap" viewBox="0 0 900 500" role="img" aria-label="…">
    <g class="node"><rect x="268" y="82" width="174" height="56" rx="10" class="card"/>
      <text x="355" y="106" text-anchor="middle" class="tb lbl">Income above the line</text>
      <text x="355" y="116" text-anchor="middle" class="tbig qm">?</text></g>
    <path d="M150,110 L262,110" class="ink2" marker-end="url(#arr)"/>
    <rect x="183" y="97" width="44" height="18" rx="4" class="bg"/><text x="205" y="110" text-anchor="middle" class="ts">sets</text>
  </svg>
</figure>
```

## Check yourself and explain-back

```html
<div class="check">
  <p>Question that points back to a figure…</p>
  <div class="row"><button class="btn" data-reveal="r1">Reveal</button></div>
  <div class="reveal" id="r1" hidden>Answer…</div>
</div>
…
<div class="label">Explain it back</div>
<h2>Why does the elasticity decide the top rate?</h2>
<textarea id="explain" data-concept="[[optimal-top-rate]]" data-source="Saez 2001 explainer" placeholder="…"></textarea>
<div class="row"><button class="btn solid" id="copyExplain">Copy for Claude</button><span class="hint" id="copied"></span></div>
```

## Glossary

Every term or symbol a reader might not know gets one entry in `<aside class="gloss">`. The
shell sorts them, builds the clickable index (symbols first, then A to Z), the filter box, the
Show more / Show all buttons and the "Used on" screen links. Write only the entries:

```html
<article class="entry" id="g-eti" data-sym="e">
  <h4>Elasticity of taxable income</h4>
  <p class="short">How much reported income shrinks when take-home pay per dollar falls.</p>
  <div class="more">
    <p><b>In plain words.</b> A ratio of percentages: the percent fall in reported income for each 1% fall in \(1-\tau\).</p>
    <p><b>Example.</b> With \(e = 0.25\), a 10% cut in the take-home share cuts reported income by 2.5%.</p>
    <p><b>Don't confuse with.</b> Labour supply; avoidance and timing count too.</p>
  </div>
</article>
```

- `.short`: one sentence, at most 20 words, no symbols the reader has not met.
- `.more`: bite-sized labelled chunks of 1 to 3 sentences: **In plain words**, **Example**
  (with numbers from this page), and when useful **Don't confuse with** and **Symbol**.
- `data-sym` (TeX) puts the symbol in the index and the heading. One entry per idea: the
  symbol and the term share it.
- Link the first use on each screen: `<a class="gl" href="#g-eti">elasticity of taxable income</a>`.
  `vault.py check` reports links to missing entries and entries no screen links to.

A figure mark not in the shared legend gets `data-mark="name"` on the figure element and a
`<section><dl><dt data-mark="name">(swatch)</dt><dd>meaning</dd></dl></section>` in the help aside.

## Math in figures

KaTeX does not reach inside SVG, so the shell sets figure math itself. In any `<text>`, write
`z_m`, `x^2`, `z_{top}` or `τ^*` and the shell draws a real subscript or superscript in the
KaTeX math font. Wrap a lone symbol in `<tspan class="tx">τ</tspan>` for the math font. In
HTML labels outside KaTeX (slider names, readouts) use `<span class="sym">a</span>`. `check`
flags any `_` or `^` left showing as text.

## SVG classes (shared legend already explains these)

Text: `t` body, `tb` bold, `ts` small, `tm` mono numbers, `tcap` caps label, `tbig` large.
Lines: `axis`, `grid`, `ink`, `ink2`, `dash` (reference), `acc-line` (the thing explained).
Fills: `acc-fill` solid = gain or result, `hatch` = loss, `card` outlined = context,
`card-acc` shaded = the result box, `soft-fill`, `mid-fill`, `bg` (label backing).
Arrowheads: `marker-end="url(#arr)"`, accent `url(#arrA)`.
