---
name: tidy
description: >
  File the vault's drop folder by topic, rename a source by the naming rules, find where something
  is, or undo a move. Use for "tidy my vault", "file this under X", "where's my X", "undo that move".
argument-hint: "[file=topic | where <term> | rename <old> <new> | undo]"
---

# Tidy

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first.

The plugin's hooks already run `tidy` at the start of every session and before every prompt, so
files dropped in the vault root are filed before you see the request. This skill handles what
the hook cannot decide, and the requests below.

**Commands** (`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" <command> <vault>`):

| Request | Command |
|---|---|
| "tidy my vault" | `tidy` (add `--dry-run` to preview) |
| a file needs a topic | ask one question listing the existing topics (the folders under `library/` and `notes/`), then `tidy --tag "file name=topic"` |
| "undo that move" | `tidy --undo` (reverses the last run, links included) |

**How a topic is found,** first match wins: frontmatter `tags:` or `topic:`; the first inline
`#tag` in a note; a `#tag` or leading `[tag]` in the file name (`.` nests, so `[econ.labor]`
is `econ/labor`); a tagged note in the root that links the file; the topic you give in chat.
Files identical to one already in `library/` go to `_meta/duplicates/`; nothing is deleted.

Report the one-line summary the command prints, then give the next action.
