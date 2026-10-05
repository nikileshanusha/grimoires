---
name: explainer
description: >
  Build the interactive HTML explainer for a source or one concept, with figures, math decoder and glossary. Use when the user picks the explainer or asks for an interactive lesson.
argument-hint: "[source-slug]"
---

# Explainer spec

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

The explainer is Karpathy's top rung that cognia uses: an interactive HTML page. It is a view
of the vault and is never the only place anything lives. Build one only when the reader asks
for it (or says go to the offer at the end of ingest).

## The one rule

The reader spends effort on the idea, never on the page. The explainer is one argument told
in screens, the way a good essay reads (Substack, Scott Cunningham's *Mixtape*). If the
reader has to work out how the page works, what a mark means, or how two screens relate,
the page has failed. It succeeds when the reader can answer the six questions in
`/cognia:ingest` without notes.

## Build

1. `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" lesson <vault> <source-slug> --title "<Author Year>" --source "<full citation>"`
   (add `--concept <slug>` for a concept explainer). It makes the page and refreshes
   `lessons/_shell/`, which holds the look, header, navigation, help legend and every control.
   Never copy or edit the shell from a lesson.
2. Read `${CLAUDE_PLUGIN_ROOT}/skills/explainer/screens.md` for the markup patterns. Load `core/guides/writing.md` and
   `core/guides/diagrams.md`; load `core/guides/math.md` only if there are equations and
   `core/guides/evidence.md` for the doubt screen; load the domain file if one exists.
3. Plan the screens from `raw/<slug>/worksheet.md` (do not reread the source) at the depth
   recorded on the source page (`depth:`; table in `/cognia:ingest`). Write them into
   `#rail`, one glossary entry per term or symbol, and one `fig(...)` call per live figure.
4. Self-check (below), then hand off.

## Screen sequence for a source

There is no screen limit. Use as many screens as the argument needs at the chosen depth, and
no more: one claim per screen, so a hard step gets its own screen and an easy one shares.
Order the middle screens by the worksheet's dependency chain. At Skim, merge 2 to 4 and skip
the derivation; at Deep, give every `shaky` or `new` prerequisite and every derivation step
that carries an idea its own screen, and add a screen on what each key reference contributes.

1. **The question**: what the source answers and why it matters, with a real-world figure.
2. **The mechanism in one picture**: the moving parts, before any detail.
3. **One screen per moving part**: each teaches its prerequisites in place (rated `shaky` or
   `new`; `known` ones get a one-line reminder), with a live figure where a parameter matters.
4. **Where it comes together**: the result as a picture (a crossing, a balance, a flow), with
   a prediction gate on its slider.
5. **In symbols**: the math decoder (`core/guides/math.md`): the equation as written with its
   location, a symbol table with "where you met it", and step-reveal derivation, each step
   pointing back to its screen.
6. **What to doubt**: assumptions, scope and limitations (`core/guides/evidence.md`), an evidence
   table, and how far the answer moves if the weakest input is wrong.
7. **The whole picture**: a concept map with recall mode, a one-sentence summary, and where
   the references lead.
8. **Check yourself**: predict-then-reveal questions that refer back to the figures (at least
   one "why", one prediction, one about doubt), and the explain-back box.

A plan unit after the first opens with a warm-up screen of recall questions on earlier
concepts. **Concept explainer** (`lessons/<source-slug>/<concept>.html`):
screens 3, 5 if there is an equation, and 8.

## Continuity

- The headline is a claim ("The loss depends on how much reported income shrinks."), never a
  topic label. Each "So far:" line states what the previous screen established.
- Later screens refer back by number ("the slice from screen 2"), and numbers carry through:
  the person on screen 2 is the person on screen 3.
- No learning-management chrome: no status pills, mastery colours or reference cards. That
  state lives in the vault and in chat.

## Layout

- The shell gives each screen a text column (about 37%) and a figure plate (about 63%).
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

Neutral graphite, light and dark themes, Lexend and Atkinson Hyperlegible: all in the shell.
Meaning comes from fill, hatch, outline and dash, never hue. Illustrations with chosen numbers
say so.

## Self-check before delivering

1. `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" check <page>` and fix everything it prints until it says
   `OK`. It finds column overflow at 1366×768, overlapping or clipped figure labels, missing
   "So far" lines and `aria-label`s, marks with no legend entry, glossary links to missing
   entries and unlinked entries, sub/superscripts showing as raw text, and em dashes.
2. Then screenshot only: each screen `check` flagged, one screen with a live figure in the
   other theme, and one at phone width. Look for what a script cannot judge: does each figure
   show its one claim?
3. Read back against the writing, math and evidence checklists you loaded: claims as
   headlines, equations copied exactly and decoded at their tier, numeric examples verified by
   hand, every claim about the source tagged, nothing fabricated.
