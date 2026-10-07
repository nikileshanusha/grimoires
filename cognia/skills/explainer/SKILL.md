---
name: explainer
description: "Builds the interactive HTML explainer for a source or one concept, with figures, math decoder and glossary."
when_to_use: "Use when the user picks the explainer or asks for an interactive lesson."
argument-hint: "[source-slug]"
effort: medium
allowed-tools: Bash(python *) PowerShell(python *)
---

# Explainer spec

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context explainer $ARGUMENTS`

Build an explainer only when the reader asks for it (or says go to the offer at the end of ingest).
It is a view of the vault, never the only place anything lives.

## The one rule: it is a lecture

The explainer is one lecture by a patient professor, told in screens: one story, in order, where
the important idea gets the spotlight and everything else gets only the time it has earned. The
reader spends effort on the idea, never on the page. If they have to work out how the page works,
what a mark means, or why a screen is there, the page has failed. It succeeds when the reader
remembers the one thing a year from now and can answer the six questions in `/cognia:ingest`
without notes.

## First, the lecture plan

Before any screen, write or reuse the `## Lecture plan` in the worksheet
(`core/guides/lecture.md`): the source's stated contribution, quoted; the one thing; the arc;
the ranked load-bearing ideas; the weight of each supporting idea; the running example; what
was left out; the three-sentence test. Do not ask the reader to approve it; write it and build.
Every choice below follows the plan.

## Build

1. `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" lesson <vault> <source-slug> --title "<Author Year>" --source "<full citation>"`
   (add `--concept <slug>` for a concept explainer). It makes a fragment,
   `writing/<topic>/<slug>/<slug>-explainer.html`, holding only the screens, glossary entries and
   figure code, in the regions its comments mark. The look, header, navigation, help legend and
   every control are built around it into the site folder by `vault.py build` (or `check`), so
   never copy or edit them.
2. Load `core/guides/lecture.md` and `core/guides/writing.md`, then
   `${CLAUDE_PLUGIN_ROOT}/skills/explainer/screens.md` for the markup patterns and
   `core/guides/diagrams.md`. Load `core/guides/math.md` only if there are equations and
   `core/guides/evidence.md` for the doubt screen; load the domain file if one exists.
3. Write the lecture plan (above) if the worksheet lacks one. Build from
   `library/<topic>/<slug>/<slug>-worksheet.md`; do not reread the source.
4. Write the **screen plan**: the headlines alone, one line each, in order, with "figure: none"
   or the one claim the figure makes. Do the headline read (`lecture.md`) on this list before
   writing any prose; it is the cheapest place to fix emphasis. Then write the screens into
   `#rail`, one glossary entry per term or symbol, and one `fig(...)` call per live figure.
5. Self-check (below), then hand off.

## The screen arc

The screens follow the plan's arc, in four parts. One screen per **step of the argument**, at
the depth recorded on the source page (`depth:`; table in `/cognia:ingest`). There is no screen
limit and no fixed count: a hard step gets its own screen, an easy one shares.

**Before: the question.**

1. **The question**: the opening tension. Why anyone cares and what the source answers, with a
   real-world figure. The running example appears here.

**The build: the load-bearing ideas, in the order the argument needs them.**

2. **The mechanism in one picture**: the turn, the key insight, with the moving parts before any
   detail.
3. **One screen per step of the argument**: each load-bearing idea gets the screens it needs,
   ordered by the worksheet's dependency chain. A prerequisite gets the weight the plan gave it:
   most are a clause or a paragraph inside the screen that needs them (`known` ones a clause).
   Only a `new` prerequisite the one thing cannot be understood without gets its own screen.
   Teach findings; concepts serve them, and evidence supports them. A number is never the topic
   of a screen.

**The payoff.**

4. **Where it comes together**: the one thing, as a picture (a crossing, a balance, a flow),
   with a prediction gate on its slider. This is the heart of the lecture; say so.
5. **In symbols**: the math decoder (`core/guides/math.md`): the equation as written with its
   location, a symbol table with "where you met it", and step-reveal derivation, each step
   pointing back to its screen.

**After class: the Q&A.**

6. **What to doubt**: assumptions, scope and limitations (`core/guides/evidence.md`), an evidence
   table, and how far the answer moves if the weakest input is wrong.
7. **The whole picture**: a concept map with recall mode, the one thing in one sentence, and
   where the references lead.
8. **Check yourself**: predict-then-reveal questions that refer back to the figures (at least
   one "why", one prediction, one about doubt), and the explain-back box.

At Skim, merge the build into 2 to 4 screens and skip the derivation. At Deep, give each `new`
prerequisite in the supporting cast a paragraph or its own screen, each derivation step that
carries an idea its own screen, and add a screen on what each key reference contributes. Depth
never changes which idea leads.

A plan unit after the first opens with a warm-up screen of recall questions on earlier
concepts. **Concept explainer** (`writing/<topic>/<slug>/<slug>-<concept>-explainer.html`):
the build screens for that concept, "In symbols" if there is an equation, and "Check yourself".

## Emphasis

- The title and the "where it comes together" screen carry the one thing. The three-sentence
  test supplies the most prominent headlines.
- No supporting idea gets more screens, a bigger figure or a livelier one than a load-bearing
  idea. If a definition seems to need a slider, ask whether it is really supporting.
- Say plainly what matters ("This is the heart of the paper."), once, where it is true.

## Inside a screen

A screen is one step of the lecture, not a form to fill in. A good default for a finding is
the puzzle, then the mechanism (why it should be true: an incentive, a trade-off, a sign
argument or a limiting case), then the finding in plain words, then a compact `.evidence` block
(design, result, strength; the number appears as its meaning, the raw estimate in the margin
note), then what it implies. Use it when it helps, and drop the beats a step does not need. A
screen that recaps at a turning point, heads off a confusion, or works the running example is a
good screen.

A regression that is only evidence folds into the evidence block; the equation block is for
equations that are the concept. Figures show the finding (its direction, shape or mechanism),
never a slider over a coefficient. Sources go in `data-src` margin notes, and prose states the
idea itself. Pitch the level from the source and the diagnostic ratings (`writing.md`).

**A figure must earn its screen.** Give a screen a figure only if it shows what prose cannot do
as quickly: a quantity that varies (a plot), a mechanism with three or more moving parts (a
schematic), a comparison of cases (a small table or bars), or data from the source. Use the
running example in it where you can. Add a slider only when moving it teaches something, such
as a threshold or a sign change; otherwise the figure is static. A screen without a figure is a
reading screen: the shell sets it as one centred column about 68 characters wide, and an
equation block, an evidence table or a step list can sit in it. The question, the mechanism in
one picture, where it comes together, and the whole picture always have a figure.

## Continuity

- The headline is a claim ("The loss depends on how much reported income shrinks."), never a
  topic label. The first sentence of the screen is a bridge: it picks up the question the last
  screen left open. The kicker is a thread label ("Finding 2 of 4: evasion and the rate").
- Later screens refer back by concept or figure number ("the slice in Figure 2"), and the
  running example carries through: the person in Figure 2 is the person in Figure 3.
- A screen ends with the consequence that makes the next idea necessary. It may signpost the
  argument ("Two things decide this.") but never the page ("the next screen", "coming up");
  `check` flags those phrases.
- No learning-management chrome: no status pills, mastery colours or reference cards. That
  state lives in the vault and in chat.

## Layout

- The shell gives each screen a text column (about 42%) and a figure plate (about 58%). Body
  text is about 15px; the reader sets 13 to 18px with the A-/A+ buttons. Diagram labels render at
  a fixed 12 to 13px whatever the plate size, so draw for the viewBox and let it scale.
  Figures fill the plate. Controls sit in one row under their figure: a readout, at most 3
  sliders.
- Every screen must fit 1366×768 with the help panel closed. If one overflows, move an aside
  to the figure column or split the claim into two screens; never shrink the text.

## Glossary and legend

Two panels, one open at a time. **Help** is the shared legend the shell builds: moving, the
parts of a screen, figure marks, evidence tags, controls, theme. **Glossary** holds this page's
terms and symbols: a clickable index, a short line per entry, a Show more button for the full
explanation, and links back to the screens that use it. The page writes only the entries and
the dotted links (`screens.md`). If a page uses a term, symbol or mark that neither panel
explains, the page is not finished.

## Look

Graphite with eight muted hues for figure marks (at most 3 per figure), light and dark themes,
Lexend and Atkinson Hyperlegible: all in the shell. Meaning comes from fill, hatch, outline and
dash; hue only groups. Illustrations with chosen numbers say so.

## Hard rules (checklist)

`vault.py check <page> --static` tests each rule below, and a hook runs it after every save.

1. Every equation is one `.equation` block with `data-src` and a `.where` list (`lint: equation`).
2. Inline `\( \)` holds one symbol or a short expression with no `=` (`lint: inline equation`).
3. Every symbol in a displayed equation is in its `.where` list or a glossary `data-sym` (`lint: symbols`).
4. Every screen has a `.kicker` thread label, an `h2` (`h1` on screen 0) and `.prose`. There is no `.sofar`; the first sentence is a bridge from the open question (`lint: screen`).
5. Every figure caption has `<b>Figure n.</b>`, `What to notice:` and `Source:`, numbered 1, 2, 3 in page order (`lint: figure`).
6. Every glossary link has an entry, every entry is linked, and each `.short` is 20 words or fewer (`lint: glossary`).
7. No pointing at the page ("next screen", "coming up", "in this section"). Every punctuation mark does its own job (`writing.md`), and none is banned (`lint: prose`).
8. No figure without a claim it shows better than a sentence. A screen with no `.fig` is a reading screen (`lint: figure`, which warns when a figure only restates its heading).
9. A screen fits its word budget (about 250 words of prose, figure or not; `.where` rows, evidence blocks, table rows and steps count extra). Over budget: split into a figure screen and a reading screen (`lint: budget`).
10. An `.evidence` block has `data-src`, `p.design` and `p.result`; figure code sets no `font-size` above 14 (`lint: evidence`, `lint: figure`).
11. Then run `check <page>` without `--static` until it prints `OK`. Overflow up to 15% is a warning.

## Self-check before delivering

1. **The headline read** (`core/guides/lecture.md`): read only the title and the `h1`/`h2`s, in
   order. Do they tell the story? Is the one thing the most prominent? Did any low-level idea
   get a screen it did not earn? Fix the emphasis before anything else, then check the
   headlines against the quoted contribution line.
2. `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" check <page>` and fix everything it prints until it says
   `OK`. It finds column overflow at 1366×768 (a warning up to 15%, a failure beyond), overlapping
   or clipped figure labels, missing `aria-label`s, marks with no legend entry, glossary links to
   missing entries and unlinked entries, and sub/superscripts showing as raw text.
3. Then screenshot only: each screen `check` flagged, one screen with a live figure in the
   other theme, and one at phone width. Look for what a script cannot judge: does each figure
   show its one claim?
4. Read back against the writing, math and evidence checklists you loaded: claims as
   headlines, the lecturer's voice, equations copied exactly and decoded at their tier, numeric
   examples verified by hand, every claim about the source tagged, nothing fabricated.

Hand off in two lines: the one thing in a sentence, and where in the source the contribution
line it rests on sits ("abstract, p. 1").
