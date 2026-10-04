# Mode: Learn one concept on demand

1. Read the concept page, its `requires:` pages and their statuses. If a prerequisite is
   `new` or `shaky`, say so and offer to teach it first (default yes).
2. Load `guides/writing.md`, plus `guides/math.md` if the concept has an equation and
   `guides/diagrams.md` if it has a mechanism worth drawing.
3. Write the lesson into the page's `## Lesson` section: connected prose, at least one
   diagram (Mermaid in markdown), and any equation through the math decoder.
4. If the concept has a parameter worth moving or a process worth stepping through, offer a
   concept explainer in one line and build it on yes (`explainer/spec.md`, concept variant).
   If one already exists, link it instead. Teach at the source's recorded `depth:`.
5. Close with 2 or 3 recall questions in chat, one at a time, then offer an explain-back
   (`modes/explain-back.md`).
6. Set the status to `learning`, schedule the first review with
   `python <skill>/vault/vault.py record <vault> <concept> <grade>`, tick the unit in its
   path, and rewrite `_meta/now.md`.
