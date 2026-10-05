---
name: tidy
description: "Files the vault's drop folder by topic, renames a source by the naming rules, finds where something is, or undoes a move."
when_to_use: "Use for \"tidy my vault\", \"file this under X\", \"where's my X\", \"undo that move\"."
argument-hint: "[file=topic | where <term> | rename <old> <new> | undo]"
effort: low
allowed-tools: Bash(python *)
---

# Tidy

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context tidy $ARGUMENTS`

The plugin's hooks already run `tidy` at the start of every session and before every prompt, so
files dropped in the vault root are filed before you see the request. This skill handles what
the hook cannot decide, and the requests below.

**Commands** (`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" <command> <vault>`):

| Request | Command |
|---|---|
| "tidy my vault" | `tidy` (add `--dry-run` to preview) |
| a file needs a topic | ask one question listing the existing topics (the folders under `library/` and `notes/`), then `tidy --tag "file name=topic"` |
| "rename this" | `rename <old-slug> <new-slug>` (name rules below) |
| "undo that move" | `tidy --undo` (reverses the last tidy or rename, links included) |

**How a topic is found,** first match wins: frontmatter `tags:` or `topic:`; the first inline
`#tag` in a note; a `#tag` or leading `[tag]` in the file name (`.` nests, so `[econ.labor]`
is `econ/labor`); a tagged note in the root that links the file; the topic you give in chat.
Files identical to one already in `library/` go to `_meta/duplicates/`; nothing is deleted.

**Naming rule** for sources, enforced by `rename`: `<author-or-organisation>-<year or nd>-<2 to 6
title words>`, lowercase ASCII, hyphens, at most 50 characters. A deck or lecture takes the course
or unit as the first title words. Use only abbreviations the title itself uses, and `nd` when the
year is unknown, never a guess. Examples: `saez-2001-optimal-income-tax`,
`chandrasekhar-nd-unit-5-public-finance`. Your own notes keep the names you gave them.

Report the one-line summary the command prints, then give the next action.
