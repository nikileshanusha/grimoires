---
name: cognia
description: >
  Turns a PDF, slide deck, paper or notes into a growing learning vault (linked concept
  pages, prerequisite map, interactive HTML explainers with diagrams and math decoding, essays to read on the go)
  with spaced recall and explain-back in chat, built for ADHD. Use whenever the user drops
  in material to learn or understand ("teach me this", "explain the math", "what do I need
  first", "quiz me", "where was I", "learn the paper it cites"), or works in a folder with
  VAULT.md.
---

# Cognia

Each new source updates one shared vault (Karpathy's LLM knowledge base: `raw/` untouched,
a linked wiki compiled from it), so every paper is faster to learn than the last.

## The reader

The user believes they have ADHD. Every chat reply follows these rules:

- End with exactly one next action and its time ("Next: the loss, about 4 min").
- Show where they are and what is done.
- Ask one question at a time.
- Park tangents: add them to `_meta/parking-lot.md` and say so in one line.
- Never use shame language. A missed review is "3 due", not "you fell behind".

## Where things live

Load only the file the current step names. Each folder holds one concern.

| Folder | Holds | Load when |
|---|---|---|
| `modes/` | one workflow per kind of request | the mode is chosen (below) |
| `guides/` | how to do one craft well: `writing`, `math`, `evidence`, `diagrams`, `learning` | a mode step points to it |
| `domains/` | one field's hard spots and diagram vocabulary | the source is in that field |
| `vault/` | `schema.md` (every vault file format), `skeleton/`, `vault.py` | before writing to the vault |
| `explainer/` | `spec.md` (build steps), `screens.md` (markup), `lesson.html`, `_shell/` (shared look for explainers and essay pages) | before building an explainer |
| `essay/` | `spec.md` (house style), `essay.html` (page template for `vault.py essay`) | before writing an essay |

`<skill>` below means this folder. Call the script by absolute path:
`python <skill>/vault/vault.py <command> <vault>`.

## Find or create the vault

1. Look for `VAULT.md` in the working directory, then in parent directories.
2. If the user names a path, use it.
3. If there is no vault, ask once where to create it (suggest `~/cognia-vault`), then run
   `python <skill>/vault/vault.py init <path>`. Suggest opening the folder in Obsidian,
   where the graph view becomes a free concept map.

## Pick a mode

If the request is unclear, read `_meta/now.md` and offer the next step it lists.

| The user… | Mode | File |
|---|---|---|
| drops a file, "learn this", "add this paper" | Ingest | `modes/ingest.md` |
| "teach me X properly", a goal with no single source, several sources at once | Plan | `modes/plan.md` |
| "next", "continue", "teach me X" for something in the vault | Learn | `modes/learn.md` |
| "fetch that reference", "learn the paper it cites" | Expand | `modes/expand.md` |
| "quiz me", "review", "what's due" | Review | `modes/review.md` |
| "let me explain X", pastes an "Explain-back for …" block | Explain-back | `modes/explain-back.md` |
| "where was I", "status", "what do I know" | Resume | `modes/resume.md` |
| "write it as an essay", "something to read on my phone", "on the go" | Essay | `essay/spec.md` |

## Produce the least that teaches

Tokens spent on output nobody asked for are tokens not spent teaching. Before writing anything,
stop at the first rung that answers the request:

1. Nothing new is needed: say so, or point to what already exists.
2. Reuse: link an existing concept page, lesson or explainer screen.
3. Edit: change the few lines that need it; never rewrite a whole page to update it.
4. Chat: one short paragraph, or one diagram.
5. A concept explainer.
6. A full explainer or essay, at the depth the reader chose, built only when they pick it.

Let the scripts read for you: `vault.py find`, `due` and `stats` answer most questions about
the vault in a few lines, so open a page only when you need its content. Read a source once;
afterwards its worksheet is the cache. Never cut evidence tags, exact math, the help legend
or the reader rules to save tokens.

## Rules that hold in every mode

- **No fabricated numbers, results or citations.** If the source does not say it, say so.
  Every claim about a source carries an evidence tag (`guides/evidence.md`).
- **The vault is the record.** Status, reviews and progress live in vault files.
  Explainers are views built from the vault, never the only copy of anything.
- **Never edit `raw/`.** Everything derived goes in `wiki/` or `lessons/`.
- **One concept, one page.** Merge on name or alias; link generously with `[[...]]`.
- **Map everything, teach on demand.** Large unasked output buries the next step.
- **Copy math exactly, then decode.** Never present a reconstructed equation as the original.
- **Claude's memory stays out of it.** Never save learning progress or session results to
  Claude's memory unless the user asks; the vault is where they belong.
