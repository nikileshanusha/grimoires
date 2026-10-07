# Screen patterns

Copy-ready markup for the page made by `vault.py lesson`. The shell (`assets/cognia.js`) wires
every control from these attributes, so a page needs no JS beyond `fig(...)` calls. Classes
for SVG text and shapes are listed at the end. `core/engine/examples/saez-2001-explainer.html` shows all of
them in use; open it only to see how a finished screen looks.

## Contents

- Equation (the first component to copy)
- Claim screen (every screen starts from this)
- Live figure with controls
- Diagram: boxes and arrows, declared
- Bars and labels
- Prediction gate
- Step-reveal math (the "In symbols" screen)
- Evidence table (the "What to doubt" screen)
- Concept map with recall
- Check yourself and explain-back
- Glossary
- Math in figures
- SVG classes (shared legend already explains these)

## Equation (the first component to copy)

Every equation with `=`, `<`, `>` or more than a few symbols is one `.equation` block. Never
write it inline in a paragraph.

```html
<div class="equation" data-src="slide 9">
  <p class="eq">\[ \mathrm{gap}_i = \alpha + \beta_1\,\mathrm{tax}_i + u_i \]</p>
  <dl class="where">
    <dt>\(\mathrm{gap}_i\)</dt><dd>log export value minus log import value for good \(i\)</dd>
    <dt>\(\beta_1\)</dt><dd>extra gap per unit of tax rate; estimate 2.93 (s.e. 0.74)</dd>
  </dl>
</div>
```

- `data-src` is where the equation sits in the source ("slide 9", "eq. 4, p. 12"). The shell
  prints it as a tag and numbers the equation "(1)", "(2)", so prose can say "equation (1)".
- `.where` lists every symbol in the equation, one `dt`/`dd` each, in plain words with units.
- Inline `\( \)` is for one symbol or a short expression with no `=`.

## Claim screen (every screen starts from this)

The markup is fixed; the beats inside `.prose` are a default, not a mold. Drop the evidence
block or the puzzle when the step does not need them.

```html
<section class="screen" data-title="The loss" data-min="4">
  <div class="text">
    <div class="kicker"><b>Finding 2 of 4</b> · evasion and the rate</div>
    <h2>The loss depends on how much reported income shrinks.</h2>
    <div class="prose"><p>(bridge sentence from the open question)</p><p>(the step of the argument; by default puzzle, mechanism, the finding in plain words)</p></div>
    <div class="evidence" data-src="Author Year, slide 20">
      <p class="design">What was compared, in one sentence.</p>
      <p class="result">What it showed, with the number as its meaning ("about 29% more missing").</p>
      <p class="strength">How well it holds, and what else moves it.</p>
    </div>
    <div class="prose"><p>(what it implies, ending in the question it raises)</p></div>
    <div class="note"><b>Illustration.</b> (a source or example note) …</div>
  </div>
  <div class="fig">
    <figure>
      <svg viewBox="0 0 800 500" role="img" aria-label="(the figure's one claim)">…</svg>
      <figcaption><b>Figure 1.</b> (the claim). <b>What to notice:</b> … <small>Source: Table 2 of the paper.</small></figcaption>
    </figure>
  </div>
</section>
```

**Length** is the argument's call, not the page's: a screen holds one step, however many words
that takes. The shell fits it (widens the column, moves or folds the asides, then pages the text),
so never trim or split for space. The `.evidence` block is for the test behind a finding
(`data-src`, `p.design`, `p.result`, optional `p.strength`); an equation that is the concept stays
in `.equation`.

A reading screen has no `.fig` div: write only `.text` (kicker, `h2`, `.prose`, and an
equation block, evidence table or steps if needed). The shell centres it in one column.

Screen 0 uses `<div class="kicker"><b>Start</b></div>` and an `<h1>`. Later screens open with a
bridge sentence, not a recap line.
Glossary terms: `<a class="gl" href="#g-slug">term</a>` (see Glossary). Emphasis that is not a
glossary term: `<strong class="key">`. Math: `\( \)` inline for one symbol, the `.equation` block above for any equation.

## Live figure with controls

```html
<figure>
  <svg id="figLoss" role="img" aria-label="Tax lost per top earner rises with elasticity e"></svg>
  <div class="controls">
    <div class="readout"><small>tax lost per top earner</small><span id="lostOut"></span></div>
    <label for="e1"><span>elasticity <span class="sym">e</span></span><b id="e1Val"></b><input type="range" id="e1" min="0" max="1.5" step="0.05" value="0.25"></label>
  </div>
  <figcaption><b>Figure 2.</b> Revenue lost grows linearly in e. <b>What to notice:</b> … <small>Source: illustration with chosen values, not from the paper.</small></figcaption>
</figure>
```

```js
fig("#figLoss", (svg, w, h) => {
  const e = +$("#e1").value;
  $("#e1Val").textContent = e.toFixed(2);
  const p = plot(w, h, { x: [0, 1], y: [0, 1.5], xTitle: "Tax rate τ", yTitle: "Revenue lost (share of base)" });
  svg.innerHTML = p.axes + `<path class="acc-line" d="${curve(x => x * e, 0, 1, 100, p.X, p.Y)}"/>` +
    `<text class="ts" x="${p.X(1) - 6}" y="${p.Y(e) - 8}" text-anchor="end">e = ${e.toFixed(2)}</text>`;
}, ["#e1"]);
```

Labels follow the reader's text size, so do not set `font-size` (the lint rejects values above
14). `fig` sizes the viewBox to the box and redraws on resize, on A-/A+ and on input; after each
draw the shell wraps labels that carry a width, moves colliding labels apart and grows the drawing
to hold anything at its edge. `curve(fn, x0, x1, n, X, Y)` returns a path. Draw at the box size;
never stretch a fixed viewBox.

**Plots always use `plot(w, h, {x, y, xTitle, yTitle})`.** It draws both axes, titles, 3 to 6
numeric ticks at round values, a light grid and zero, and returns `p.X`, `p.Y` (use them for every
mark so ticks and data share one scale) and `p.axes` (the SVG to put first). Name the unit in the
title ("Reported income z (US$ thousands)"). Label each series directly and annotate the one or
two points that matter with their exact values. Options: `nx`, `ny` (about how many ticks),
`xFmt`, `yFmt` (value to label), `margin`. A static plot adds `data-plot` to its `<svg>` and uses
the same `.axes` group classes. A live figure that is a schematic (cards, bars drawn to scale)
rather than a plot adds `data-schematic`. `check` fails a plot with no axes, a missing axis
title, fewer than 2 numeric ticks per axis, or a caption with no "Source:" line.

## Diagram: boxes and arrows, declared

Any figure of boxes and arrows (a mechanism, a chain of ideas, the concept map) is written as
nodes and edges. The shell ranks the nodes into columns, sizes each box to its text, chooses
across or down from the space it has, and draws every arrow and its label from the measured boxes.
Never give a coordinate.

```html
<figure>
  <div class="diagram" id="cmap" data-ranks="You measure or choose|It drives|You get" role="group" aria-label="(the figure's one claim)">
    <div class="node" id="m-a"><b>\(a\)</b> Pareto tail</div>
    <div class="node gain" id="m-gain">Mechanical gain <small>more tax, same income</small></div>
    <div class="node loss" id="m-loss" data-rank="1">Behavioural loss <small>less income to tax</small></div>
    <div class="node acc" id="m-rate"><b>\(\tau^*\)</b> best top rate</div>
    <span class="edge" data-from="m-a" data-to="m-gain">sizes</span>
    <span class="edge acc" data-from="m-gain" data-to="m-rate">raises</span>
    <span class="edge dash" data-from="m-loss" data-to="m-rate">lowers</span>
  </div>
  <figcaption><b>Figure 6.</b> … <b>What to notice:</b> … <small>Source: …</small></figcaption>
</figure>
```

- A node sits one rank after everything that points to it; `data-rank="n"` pins it. An edge that
  closes a loop is drawn as a loop back.
- Node roles: plain (context or a step), `gain` (solid edge), `loss` (hatched), `ref` (dashed),
  `acc` (the result, shaded). `<b>` holds a symbol or short name; `<small>` a subtitle of 5 words
  or fewer. Math works inside nodes.
- Edge text is its verb, 1 to 3 words. `acc` marks the arrow that carries the result, `dash` a
  weaker or opposing link. Each edge is read to screen readers as a sentence.
- `data-ranks` titles the columns; `data-flow="right"` or `"down"` sets a direction (otherwise the
  shell chooses). Recall mode works on it: `<button class="btn" data-recall="cmap">`.

## Bars and labels

```js
fig("#figRates", (svg, w, h) => {
  const b = bars(w, h, { cats: ["10", "22", "37"], values: [10, 22, 37], y: [0, 40], xTitle: "Bracket (%)", yTitle: "Marginal rate (%)", acc: [2] });
  svg.innerHTML = b.svg + label(b.X(2.5), b.Y(37) - 24, "the top bracket the paper is about", { maxWidth: 120, anchor: "middle", bg: true });
});
```

`bars` draws on `plot()`'s axes; `acc` lists the bars that are the thing explained (solid), the
rest are grey, and each bar gets its value. `label(x, y, text, { maxWidth, cls, anchor, bg })`
returns a label the shell wraps at `maxWidth`, backs with paper colour if `bg`, and moves clear of
other labels and of the axes.

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

The concept map is a declared diagram (above) with a recall button over it:

```html
<div class="row"><button class="btn" data-recall="cmap">Recall mode</button><span class="hint recall-hint">Hides every box label; the arrows stay as clues.</span></div>
<figure><div class="diagram" id="cmap" data-ranks="…" role="group" aria-label="…"> nodes and edges </div><figcaption>…</figcaption></figure>
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
Lines: `axis`, `grid`, `ink`, `ink2`, `dash` (reference, ochre), `acc-line` (the thing explained, slate).
Fills: `acc-fill` solid = the thing explained, `hatch` = loss (clay), `card` outlined = context,
`card-acc` shaded = the result box, `soft-fill`, `mid-fill`, `bg` (label backing).
Hues for marks: `s-1`..`s-8` (line), `f-N` (fill), `fs-N` (soft fill), `tc-N` (text), in the order of the
table in `core/guides/diagrams.md`. At most 3 hues per figure; shape still carries the meaning.
Arrowheads: `marker-end="url(#arr)"`, accent `url(#arrA)`.
