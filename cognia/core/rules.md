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
- **Never edit `raw/`.** Everything derived goes in `wiki/` or `lessons/`.
- **One concept, one page.** Merge on name or alias; link with `[[...]]`.
- **No fabricated numbers, results or citations.** Every claim about a source carries an
  evidence tag (`core/guides/evidence.md`).
- **Copy math exactly, then decode.** Never present a reconstructed equation as the original.
- **Claude's memory stays out of it.** Never save learning progress to Claude's memory.

## Reading budget
Tokens spent re-reading are tokens not spent teaching. Stop at the first rung that answers:
nothing new needed, reuse, a targeted edit, one chat paragraph, a concept explainer, a full
explainer or essay (built only when the reader picks it).
- Let `vault.py` read for you: `find`, `due`, `stats` answer most questions in a few lines.
- Open a page only to edit it, and then only the section being edited.
- Read a source once; afterwards its worksheet is the cache.
- Never cut evidence tags, exact math, the help legend or the reader rules to save tokens.
