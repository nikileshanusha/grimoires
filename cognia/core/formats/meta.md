# Format: `_meta/` files and status values

**now.md** — overwrite each session. Keep it under 10 lines.
```markdown
# Now
Last: finished [[elasticity]] lesson, 2/3 checks right (2026-10-05)
Next: [[taxable-income-elasticity]] (~10 min)
Path: [[path-saez-2001-optimal]] 3/9
Due for review: 2
```

**log.md** — append one line per action (tidy and rename log themselves): `2026-10-05 · ingest · saez-2001-optimal · 14 concepts (6 reused)`.

**parking-lot.md** — `- 2026-10-05 · from [[saez-2001-optimal]]: why do economists use log utility? `

## Status values

| status | meaning | set by |
|---|---|---|
| `new` | stub or unseen | ingest |
| `shaky` | diagnostic: partial knowledge | diagnostic |
| `learning` | lesson taught, in review | learn |
| `known` | diagnostic: solid, or box ≥ 3 | diagnostic / vault.py |
| `mastered` | box 5 and a passing explain-back | vault.py + explain-back |

`vault.py record` promotes `learning` → `known` at box 3. Promote to `mastered` only
after a passing explain-back on a concept already at box 5.
