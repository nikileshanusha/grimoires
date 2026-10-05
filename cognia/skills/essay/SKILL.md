---
name: essay
description: >
  Write the on-the-go essay (Markdown for Obsidian) or the one-page essay web page for a source. Use for "write it as an essay", "something to read on my phone".
argument-hint: "[source-slug]"
---

# Essay spec

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context essay $ARGUMENTS`

The essay is the on-the-go reading: one argument told as a Substack post or a chapter of
Scott Cunningham's *Mixtape*, in Markdown that reads in Obsidian on a phone. It teaches the
same thing as the explainer, at the same depth, without needing a desk.

Two modes, both from one file:

- **essay**: write `writing/<topic>/<slug>/<slug>-essay.md`. Done.
- **essay page**: write the essay if it does not exist, then run
  `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" essay <vault> <slug>`. It builds `<slug>-essay.html` in the site folder beside the vault: one
  scrolling column in cognia's light and dark themes, with math, diagrams, folding questions,
  tap-to-peek glossary terms and an A to Z glossary at the end. You write nothing extra.

Before writing, load `core/guides/writing.md`, plus `core/guides/math.md` if there are equations and
`core/guides/evidence.md`. Build from `library/<topic>/<slug>/<slug>-worksheet.md` at the source's recorded `depth:`
(table in `/cognia:ingest`); do not reread the source.

## Shape

```markdown
# How high should the top tax rate be?

*Three measurable numbers settle one of the oldest fights in tax policy.*

Saez (2001) · Standard depth

(Hook: one concrete number or scene, then the question in one sentence.)

## Raise the rate a little, and three things happen
(One claim per section heading. Short paragraphs, one idea each.)

## …each moving part, in dependency order…

## The whole argument in symbols
$$ \tau^* = \frac{1-\bar g}{1-\bar g + a e} $$
1. Each step, with what it means and where it came from.

## What to doubt
## In one sentence
## Check yourself
## Explain it back
```

- **Title** is the source's question; the italic line under it is the dek (one sentence).
- **Sections**: each `##` heading is a claim, never a topic label. Order them by the
  worksheet's dependency chain. Length follows depth; there is no word count.
- **Terms**: link the first mention of each concept as `[[concept-slug|words in the text]]`.
  These become Obsidian links in the vault and tap-to-peek terms with a glossary in the page.
- **Figures**: a ` ```mermaid ` diagram or a small table, each followed by one italic line
  starting *What to notice:*. Keep diagrams to the moving parts (`core/guides/diagrams.md`) and
  draw them top-down (`flowchart TD`): it reads on a phone, where left-to-right shrinks to
  unreadable. The page shows reading time itself, so the essay does not state it.
- **Math**: `$…$` inline, `$$…$$` on its own line, then numbered decoding steps. Copy the
  source's equation exactly and say where it is.
- **Pull quote**: one `>` blockquote for the single sentence the reader should keep.
- **Asides**: footnotes `[^1]`, never long parentheses.
- **What to doubt**: assumptions, scope, the three limitation buckets, each claim tagged in
  words (Established, Derived, Interpretation, External, Open).
- **Check yourself**: 3 questions as folding callouts, answer inside:
  ```markdown
  > [!question]- If top earners stopped responding, what would the best rate be?
  > 100% when ḡ = 0, because raising the rate would never lose revenue.
  ```
- **Explain it back**: one prompt, and "Paste your answer to Claude".
- Then update the source page's `essay:` field.

## Self-check

- Could the reader answer the six questions in `/cognia:ingest` from the essay alone?
- Every heading is a claim, and consecutive sections read as consecutive sentences.
- Equations copied exactly; numeric examples verified by hand.
- No em dashes; prose follows `core/guides/writing.md`.
- For the essay page: open it once at phone width and check that the math and diagrams render.

`core/engine/examples/saez-2001-essay.md` shows every element in use; open it only to see one.
