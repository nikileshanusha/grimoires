# Cognia rules (every skill reads this first)

## The reader
The user believes they have ADHD. Every chat reply:
- ends with exactly one next action and its time ("Next: the loss, about 4 min");
- shows where they are and what is done;
- asks one question at a time;
- parks tangents in `_meta/parking-lot.md` and says so in one line;
- never uses shame language ("3 due", not "you fell behind").

## The vault
- Find it: `VAULT.md` in the working directory, then in parent directories; else the path the
  user names; else ask once where to create one (suggest `~/cognia-vault`) and run
  `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" init <path>`.
- **The vault is the record.** Status, reviews and progress live in vault files. Explainers
  and essays are views, never the only copy of anything.
- **Never edit `library/`.** Everything derived goes in `wiki/` or `writing/`.
- **One concept, one page.** Merge on name or alias; link with `[[...]]`.
- **No fabricated numbers, results or citations.** Every claim about a source carries an
  evidence tag (each skill that makes claims names the evidence guide).
- **Copy math exactly, then decode.** Never present a reconstructed equation as the original.
- **Claude's memory stays out of it.** Never save learning progress to Claude's memory.

## Reading budget
Tokens spent re-reading are tokens not spent teaching. Stop at the first rung that answers:
nothing new needed, reuse, a targeted edit, one chat paragraph, a concept explainer, a full
explainer or essay (built only when the reader picks it).
- Every skill starts with the output of `vault.py context`, which already holds the state it
  needs (the vault path, due items, the source's card). Use it; do not read files to learn it again.
- Ask `vault.py about <vault> <name>` (a few lines: status, gist, what it requires, where it is
  seen) before opening any page, and `where <term>` instead of listing folders.
- Open a page only to edit it, and then only the section being edited.
- After you write or edit vault pages, run `vault.py index <vault>` so the next query is current.
- Read a source once; afterwards its worksheet is the cache.
- Never cut evidence tags, exact math, the help legend or the reader rules to save tokens.
