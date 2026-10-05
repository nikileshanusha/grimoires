---
name: review
description: "Runs spaced recall in chat: quizzes the due concepts, grades them and reschedules."
when_to_use: "Use for \"quiz me\", \"review\", \"what's due\"."
effort: low
allowed-tools: Bash(python *)
---

# Review (spaced recall in chat)

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

State at start (already run for you; do not repeat it):

!`python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" context review $ARGUMENTS`

Fast retrieval, many concepts, little ceremony. Load `core/guides/learning.md` for question
types, the depth ladder and grades.

1. Run `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" due <vault>`. Each line carries the concept's gist; write
   the question from that and open the concept page only when the gist is missing or an
   answer needs a correction you cannot give from it. If nothing is due, offer the `shaky`
   concepts instead.
2. Take at most 6 items. Say how many and how long ("5 due, about 5 minutes").
3. Ask all items in one message, numbered, each one question one rung up the depth ladder
   from where the concept was last solid. Vary the question every time: the same question
   trains recognition of the question, not knowledge of the concept. Wait for one reply.
4. Grade every answer in one reply, a block per question (right, partly or wrong, and the
   correction if needed), then reschedule all of them in one call:
   `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" record <vault> slug=<again|hard|good|easy> slug=...`.
5. A wrong prediction from an explainer (shown in a pasted explain-back block) is the best
   review target there is: ask the reader why the result came out the way it did.
6. Finish with one line: reviewed N, which moved up, the streak, and the next review date.

If the reader clearly never studied a concept, send them to its explainer screen instead of
teaching it in chat.
