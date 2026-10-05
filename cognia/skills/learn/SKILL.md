---
name: learn
description: "Teaches one concept from the vault on demand: lesson, diagram, recall questions."
when_to_use: "Use for \"next\", \"continue\", \"teach me X\" when X is in the vault."
argument-hint: "[concept]"
effort: low
allowed-tools: Bash(python *)
---

# Learn one concept on demand

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context learn $ARGUMENTS`

1. Read the concept page, its `requires:` pages and their statuses. If a prerequisite is
   `new` or `shaky`, say so and offer to teach it first (default yes).
2. Load `core/guides/writing.md`, plus `core/guides/math.md` if the concept has an equation and
   `core/guides/diagrams.md` if it has a mechanism worth drawing.
3. Write the lesson into the page's `## Lesson` section: connected prose, at least one
   diagram (Mermaid in markdown), and any equation through the math decoder.
4. If the concept has a parameter worth moving or a process worth stepping through, offer a
   concept explainer in one line and build it on yes (`/cognia:explainer`, concept variant).
   If one already exists, link it instead. Teach at the source's recorded `depth:`.
5. Close with 2 or 3 recall questions in chat, one at a time, then offer an explain-back
   (`/cognia:explain-back`).
6. Set the status to `learning`, schedule the first review with
   `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" record <vault> <concept> <grade>`, tick the unit in its
   path, and rewrite `_meta/now.md`.
