# Guide: learning

The loop is learn, check, recall, explain, review. Each step serves one of three aims: retain
(spaced review), recall (retrieval practice) and explain (Feynman explain-back).

## ADHD design rules

These cut the cost of starting and of coming back, which is where an ADHD learner loses most.

- **Low start cost**: every reply ends with exactly one next action and its time.
- **Short loops**: units of 5 to 10 minutes; review sessions announce their length first.
- **Externalised state**: `_meta/now.md` holds the place, so resuming never needs memory.
- **Visible progress**: counts and streaks in chat; position and time left in explainers.
- **Novelty inside structure**: vary question formats and figures, but keep layouts fixed.
- **Active, not passive**: no unit ends without a check; predict before reveal.
- **Interest first**: why it matters comes before definitions.
- **Tangent parking**: save it to `_meta/parking-lot.md`, say so in one line, move on.
- **No shame language**: "3 due", never "you fell behind".
- **Legible type**: explainers use legibility-first faces (Lexend, Atkinson Hyperlegible),
  generous line spacing, left alignment and no long italic passages.

## Diagnostic (Ingest step 7)

3 to 6 questions, one per message, about 30 seconds each:

```
Quick check 2/5, elasticity (~30s)
If a 10% price rise cuts the quantity bought by 5%, what is the price elasticity?
(Answer, or say "skip" or "no idea"; both are useful.)
```

Prefer questions that test using a concept over defining it. Rate: `known` (right and sure),
`shaky` (partly right, or right but unsure), `new` (wrong, skip, or no idea). Say that "no
idea" is useful data, so the check stays low-stakes.

## Recall questions

Always make the reader produce an answer. Multiple choice is for in-page quick checks only.

| Type | Example |
|---|---|
| Define | "What is deadweight loss, in one sentence?" |
| Apply | "A tax on a good nobody can stop buying: how big is the deadweight loss?" |
| Contrast | "How does incidence differ from deadweight loss?" |
| Derive a step | "In Saez's formula, what happens to τ* when a rises?" |
| Predict | "If the elasticity doubles, does the top rate rise or fall, and by how much?" |
| Connect | "Which other concept in your vault does this depend on, and how?" |

## Depth ladder

A revisit moves a concept up one rung and never repeats the same rung:

1. **Recall**: state it.
2. **Explain**: say why it works, in plain words.
3. **Apply**: use it on a new case or number.
4. **Critique**: say when it fails or what it assumes.

## Grades

`again` (wrong or blank), `hard` (right with a major gap or a long struggle), `good` (right),
`easy` (instant and complete). After each, give the right answer briefly and the single gap.

## Explain-back diagnosis

Check four things against the source, then probe the most important gap:

- **Mechanism**: is the causal or logical chain right and complete?
- **Assumptions**: did they name what has to hold?
- **Precision**: where did they hand-wave ("it basically works out")? That is where the gap is.
- **Fidelity**: did they upgrade a claim, such as an interpretation stated as established, or
  a correlation stated as causal?

Plain language is a bonus, not a requirement. Map the result to a grade: all four sound is
`good` or `easy`; one gap fixed after a probe is `hard`; still broken after three probes is
`again`.

## Scheduling

`core/vault.py` uses a Leitner scheme because it is easy to reason about and edit:

| Box | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Next review after | 1 day | 2 | 4 | 8 | 16 | 32 days |

`again` returns to box 0, `hard` stays, `good` moves up 1, `easy` moves up 2 (at most 5).
A `learning` concept becomes `known` at box 3, and a `known` concept that falls to box 0 goes
back to `learning`. Review sessions take at most 6 items, most overdue first.
