---
name: expand
description: >
  Fetch and learn a work cited by a vault source. Use for "fetch that reference", "learn the paper it cites".
argument-hint: "[reference]"
---

# Expand into a referenced work

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

1. Read the reference card in `wiki/references/`.
2. Look for an open-access copy in this order: arXiv, the author's page, SSRN, NBER,
   RePEc/IDEAS, Semantic Scholar, Unpaywall.
3. **Found:** save it to `raw/<ref-slug>/`, set the card to `fetched`, and run
   `/cognia:ingest` on it with the parent source linked. Most of its concepts will already
   be in the vault, so say how many were reused; that is the compounding payoff, and the
   reader should see it.
4. **Not found:** say so plainly, keep the card as `carded`, and offer to teach what the
   parent source says about it, tagged External or secondhand (`core/guides/evidence.md`).
