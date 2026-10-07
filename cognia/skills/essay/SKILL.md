---
name: essay
description: "Writes the on-the-go essay (Markdown for Obsidian) or the one-page essay web page for a source."
when_to_use: "Use for \"write it as an essay\", \"something to read on my phone\"."
argument-hint: "[source-slug]"
effort: medium
allowed-tools: Bash(python *) PowerShell(python *)
---

# Essay spec

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context essay $ARGUMENTS`

The essay is the on-the-go reading, in Markdown that reads in Obsidian on a phone, at the same
depth as the explainer. It is a lecture by a patient professor, written out: one story, told in
order, where the important idea gets the spotlight and every other idea gets only the space it
has earned. It is not a template with the sections filled in.

Two modes, both from one file:

- **essay**: write `writing/<topic>/<slug>/<slug>-essay.md`. Done.
- **essay page**: write the essay if it does not exist, then run
  `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" essay <vault> <slug>`. It builds `<slug>-essay.html` in the site folder beside the vault: one
  scrolling column in cognia's light and dark themes, with math, diagrams, folding questions,
  tap-to-peek glossary terms and an A to Z glossary at the end. You write nothing extra.

## Build

1. Load `core/guides/lecture.md` and `core/guides/writing.md`, plus `core/guides/math.md` if
   there are equations and `core/guides/evidence.md`.
2. Write or reuse the `## Lecture plan` in `library/<topic>/<slug>/<slug>-worksheet.md`
   (`lecture.md`). Do not ask the reader to approve it; write it and build. Build from the
   worksheet at the source's recorded `depth:` (table in `/cognia:ingest`); do not reread the source.
3. Write the headlines alone first, in order, and do the headline read (`lecture.md`) on them.
   Then write the prose.
4. Self-check (below), update the source page's `essay:` field, and hand off.

## The arc

The essay follows the plan's arc:

- **Title**: the source's question. The italic dek under it carries the one thing in a sentence.
- **Hook**: the opening tension, made concrete with the running example (one person, one number,
  one scene), then the question in one sentence.
- **The build**: one `##` section per load-bearing idea or step of the argument, in the
  worksheet's dependency order. A supporting idea gets the weight the plan gave it, usually a
  clause or a paragraph inside the section that needs it. Only a `new` prerequisite the one
  thing cannot be understood without gets its own section.
- **The payoff**: the section where the pieces come together carries the one thing, and says
  plainly that this is the heart of it. "The whole argument in symbols" follows when there is an equation.
- **After class**: what to doubt, in one sentence, check yourself, explain it back.
- **Pull quote**: one `>` blockquote, taken from the three-sentence test: the sentence the
  reader should keep.

The running example returns in every section where it can: the person in the hook is the person
in the worked numbers.

## Shape

```markdown
# How high should the top tax rate be?

*Three measurable numbers settle one of the oldest fights in tax policy.*

Saez (2001) · Standard depth

(Hook: the tension, made concrete with the running example, then the question in one sentence.)

## Raise the rate a little, and three things happen
(One claim per section heading. Short paragraphs, one idea each.)

## …each step of the argument, in dependency order…

## The whole argument in symbols
$$ \tau^* = \frac{1-\bar g}{1-\bar g + a e} $$
1. Each step, with what it means and where it came from.

## What to doubt
## In one sentence
## Check yourself
## Explain it back
```

- **Transitions**: a section ends with the consequence that makes the next idea necessary. It
  may signpost the argument ("Two things decide this. Take the first.") but never the page
  ("next section", "below"); `vault.py essay` and `build` warn on those phrases.
- **Sections**: each `##` heading is a claim, never a topic label. Length follows depth; there
  is no word count.
- **Plots**: Mermaid `xychart-beta` with `x-axis "title"` and `y-axis "title"`, ticks at round values,
  and a caption ending "Source: …" (`core/guides/diagrams.md`).
- **Terms**: link the first mention of each concept as `[[concept-slug|words in the text]]`.
  These become Obsidian links in the vault and tap-to-peek terms with a glossary in the page.
- **Figures**: a ` ```mermaid ` diagram or a small table, each followed by one italic line
  starting *What to notice:*. Keep diagrams to the moving parts (`core/guides/diagrams.md`) and
  draw them top-down (`flowchart TD`): it reads on a phone, where left-to-right shrinks to
  unreadable. The page shows reading time itself, so the essay does not state it.
- **Math**: `$…$` inline for one symbol or a short expression with no `=`. Every equation is
  `$$…$$` on its own lines, then a line `Where:` with a bullet per symbol, then
  `(Source: slide 9)`; then the numbered decoding steps. Copy the source's equation exactly.
  The page numbers it and sets it in a box.
- **Asides**: footnotes `[^1]`, never long parentheses.
- **What to doubt**: assumptions, scope, the three limitation buckets, each claim tagged in
  words (Established, Derived, Interpretation, External, Open).
- **Check yourself**: 3 questions as folding callouts, answer inside:
  ```markdown
  > [!question]- If top earners stopped responding, what would the best rate be?
  > 100% when ḡ = 0, because raising the rate would never lose revenue.
  ```
- **Explain it back**: one prompt, and "Paste your answer to Claude".

## Hard rules (checklist)

`vault.py check <essay.md> --static` tests each rule below, and a hook runs it after every save.

1. Every equation is `$$ ... $$` on its own lines, then `Where:` with a bullet per symbol, then `(Source: slide 9)` (`lint: equation`).
2. Inline `$ $` holds one symbol or a short expression with no `=` (`lint: inline equation`).
3. No em dashes and no pointing at the page such as "next section" (`lint: prose`).
4. Every `xychart-beta` has `x-axis` and `y-axis` titles (`lint: xychart`).
5. No diagram without a claim it shows better than a sentence; most sections need none.

## Self-check

1. **The headline read** (`core/guides/lecture.md`): the title, the dek and the `##` headings,
   in order, tell the story by themselves; the one thing is the most prominent; no supporting
   idea has a section it did not earn. Fix the emphasis first, then check the headlines against
   the quoted contribution line.
2. Could the reader answer the six questions in `/cognia:ingest` from the essay alone?
3. Consecutive sections read as consecutive sentences, in the lecturer's voice (`writing.md`).
4. Equations copied exactly; numeric examples verified by hand. No em dashes.
5. For the essay page: open it once at phone width and check that the math and diagrams render.

Hand off in two lines: the one thing in a sentence, and where in the source the contribution
line it rests on sits ("abstract, p. 1").

`core/engine/examples/saez-2001-essay.md` shows every element in use, in the lecture voice; open
it only to see one.
