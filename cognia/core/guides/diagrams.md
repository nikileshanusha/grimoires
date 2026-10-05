# Guide: diagrams

A diagram earns its place when it shows a mechanism the reader would otherwise assemble from
prose: what causes what, what moves, what changes between two cases. If a sentence says it
faster, write the sentence. Draw the mechanism, not its name.

**Medium.** Vault markdown uses Mermaid, which Obsidian renders. HTML explainers use
hand-built inline SVG, never default Mermaid boxes. Load the `artifact-diagramming` skill
before drawing SVG.

## Route by intent, not by subject

- **Illustrative**: a mechanism that is hard to feel from equations (a shock spreading, a
  balance tipping, an optimum moving). This is usually the most valuable kind for a reader
  who is weak in math, so prefer it whenever the point is dynamic.
- **Structural**: the precise shape of something (a network, a tax schedule, a distribution).
- **Argument flow**: the structure of the reasoning itself (assumptions, model, result),
  kept separate from any picture of the subject.

A graph-shaped subject does not make a structural diagram the default.

## Figure patterns

| Idea shape | HTML figure | Markdown |
|---|---|---|
| Cause → several effects → outcome | a source card, effect cards with small before/after glyphs, an outcome object such as a balance | `flowchart LR` |
| How concepts depend on each other | a concept map in columns (inputs → effects → result), with a verb on every arrow and recall mode | `flowchart` with edge labels |
| A quantity that changes with a parameter | a live plot drawn at the size of its box, with a slider and a big readout | — |
| One number scaling another | linked bars: the lost piece of bar 1, a labelled connector, the lost piece of bar 2 | — |
| A trade-off with an optimum | two curves that cross, the regions on each side shaded, the crossing marked | — |
| Real-world context | a real chart from the subject with the part the source is about in solid | — |
| The shape of a whole topic | a mind map: one centre, up to 6 branches, up to 4 leaves each | `mindmap` |

## Complexity budget

- Box subtitles of 5 words or fewer; arrow labels of 1 to 3 words.
- At most 3 encodings per figure. If an encoding carries meaning, it must appear in the
  explainer's help panel.
- At most 4 boxes per row. Beyond that, split into an overview and a detail figure.
- Never present a complex figure cold: first a small one with real numbers, then a sentence,
  then the general one. Never stack two complex figures back to back.

## Encoding (one mapping per explainer)

Meaning lives in fill, hatch, outline and dash, never in hue.

- solid = a gain, or the thing being explained
- hatched = a loss, or what goes away
- outlined box = context or a step in the chain; shaded box = the result
- dashed line = a reference level or a what-if
- evidence tags use their own shapes (`guides/evidence.md`)

Every colour is a CSS token so it flips with the theme. Never hard-code a hex value.

## Craft

- One figure, one claim, matching the screen's headline.
- Label every arrow with a verb ("sizes", "discounts", "raises") on a chip the line passes behind.
- Align to a grid: shared baselines, equal card sizes, equal gaps.
- Use real units and values from the source, not placeholders.
- Text in figures is 11 to 14px. Sentences go in the caption.
- Every figure gets a "What to notice" caption saying where to look.
- Live plots redraw at their box size and clip curves to the plot area.
- Draw a cycle as a labelled step sequence with "returns to step 1", never a literal ring.

## Interactivity

Add a control only when it unlocks a reasoning task a static figure cannot, and you can name
that task in one sentence. At most 3 controls per figure. Always show the key number as text.

**Prediction gate.** When a slider tests an intuition, lock it behind a prediction: a concrete
either/or about direction or size, 2 to 4 options, one of them the most common misconception
("If e doubles, the rate… halves / falls by less than half / stays the same"). Keep the first
answer; a wrong prediction followed by the right result is the most durable learning event a
page can produce, and it becomes a target for review.

**Fidelity.** A figure driven by numbers you chose is labelled "illustration, not a result
from the paper". Quote numbers from the figure only after reading them from it running. If a
figure uses randomness, seed it so every visit shows the same draws.

## Maps

A **mind map** gives the whole territory at a glance before linear reading starts, which
suits an ADHD reader. A **concept map** shows how ideas cause or depend on each other, usually
the dependency chain from the worksheet. Every arrow needs support in the source, or it is
drawn dashed as interpretation. In explainers, maps get a recall mode that hides the labels so
the reader names each box before checking it.
