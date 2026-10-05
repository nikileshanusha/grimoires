---
name: resume
description: "Says where the learner left off and what the single next step is."
when_to_use: "Use for \"where was I\", \"status\", \"what do I know\"."
effort: low
allowed-tools: Bash(python *)
---

# Resume

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context resume $ARGUMENTS`

Read `_meta/now.md`, run `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" stats <vault>`, and reply in this
shape:

```
You were: <last thing> (<date>)
Next: <one action> (~N min)
Due for review: N
Progress: <path> X/Y units · vault: K known, L learning, M new
```

Then wait. Do not start the next action until the reader says go.
