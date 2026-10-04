# Mode: Review (spaced recall in chat)

Fast retrieval, many concepts, little ceremony. Load `guides/learning.md` for question
types, the depth ladder and grades.

1. Run `python <skill>/vault/vault.py due <vault>`. Each line carries the concept's gist; write
   the question from that and open the concept page only when the gist is missing or an
   answer needs a correction you cannot give from it. If nothing is due, offer the `shaky`
   concepts instead.
2. Take at most 6 items. Say how many and how long ("5 due, about 5 minutes").
3. For each item, ask one question one rung up the depth ladder from where the concept was
   last solid. Vary the question every time: the same question trains recognition of the
   question, not knowledge of the concept. Wait for the answer.
4. Reply in one line (right, partly, or wrong), give the correction if needed, and record:
   `python <skill>/vault/vault.py record <vault> <concept> <again|hard|good|easy>`.
5. A wrong prediction from an explainer (shown in a pasted explain-back block) is the best
   review target there is: ask the reader why the result came out the way it did.
6. Finish with one line: reviewed N, which moved up, the streak, and the next review date.

If the reader clearly never studied a concept, send them to its explainer screen instead of
teaching it in chat.
