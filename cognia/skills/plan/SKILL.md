---
name: plan
description: "Plans a learning goal that spans several sources before anything is built: units, concepts to keep, spiral map."
when_to_use: "Use for \"teach me X properly\" or several sources at once."
argument-hint: "[goal]"
effort: medium
allowed-tools: Bash(python *)
---

# Plan a learning goal

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context plan $ARGUMENTS`

Use this when the request is a goal rather than one source ("teach me optimal taxation
properly", "build me a path from these three papers"). One paper stays in Ingest.

The rule is plan first, then build. A wrong plan is cheap to fix before anything exists and
expensive after three explainers do.

## Stage 1: the plan, in chat, then stop

Present:

- **Goal**: one sentence on what the reader can do at the end.
- **Depth**: skim, standard or deep (table in `/cognia:ingest`), asked once for the whole
  goal and recorded in the path file. It decides what each unit covers, not how many units.
- **Units**, as many as the goal needs at that depth: a title, a one-line summary, the concepts it introduces, and which
  earlier concepts it deepens. Each unit is about one sitting (25 to 45 minutes). If a unit
  needs more than one line to summarise, split it.
- **Concepts to keep**: 3 to 6 per unit that the reader should be able to explain or apply
  later, not just recognise. These are what review tracks.
- **Spiral map**: for the concepts that carry the goal, the later unit that revisits each one
  one rung higher on the depth ladder (`core/guides/learning.md`).
- **Sources**: what each unit draws on. A unit with no single source is marked as
  synthesised, and its claims carry the External tag (`core/guides/evidence.md`).

Order the units by the dependency chain: if unit 4 needs something unit 5 teaches, the
plan is wrong. Ask one question: does this match what you want? Adjust, then build.

## Stage 2: build one unit per turn

1. Write the confirmed plan to `wiki/paths/path-<goal-slug>.md` (format in `core/formats/path.md`).
2. Build one unit per turn unless the reader asks for more. A unit with a source runs
   `/cognia:ingest` at the plan's depth; a unit without one runs `/cognia:learn` for each
   of its concepts. Each unit then offers its reading: explainer, essay or essay page.
3. From unit 2 on, open each explainer or essay with a warm-up of 2 or 3 recall questions on
   earlier concepts this unit builds on.
4. Where a unit deepens an earlier concept, say so on the screen ("In unit 2 you saw X as Y;
   here is where that breaks").
5. Keep unit and concept slugs unchanged once created; reviews are keyed by them.
