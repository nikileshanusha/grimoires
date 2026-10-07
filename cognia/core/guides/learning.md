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

## Findings, concepts, evidence, examples

Every worksheet item has one kind. Teach findings; use the rest in their support.

| Kind | What it is | Example |
|---|---|---|
| **concept** | an idea to understand | the trade gap as a stand-in for evasion |
| **finding** | a claim about the world | evasion rises with the tax rate |
| **evidence** | the test, design and result behind a finding | a regression, its estimate and its robustness |
| **example** | an illustration that makes something concrete | the 100 / 140 firm |

The worksheet lists the source's 3 to 6 findings. Each names the concepts it needs and its
evidence, and one is marked `central`. Every item also carries a weight: `core`, `supporting`
or `aside`, set by how much of the argument rests on it, not by how many slides cover it. The
dependency chain runs over findings and concepts, not slides. A number is evidence for a
finding; it is never the topic of a screen. The explainer and the essay turn these into a
lecture plan (`core/guides/lecture.md`).

## Diagnostic (Ingest step 7)

Send every diagnostic question in one message, 2 at Skim and up to 6 otherwise, numbered and
each tagged with its concept, about 30 seconds each:

```
Quick check, 4 questions, about 2 minutes. Answer them in one reply, numbered; "skip" or "no idea" is useful data.

1. Elasticity: if a 10% price rise cuts the quantity bought by 5%, what is the price elasticity?
2. Deadweight loss: why does a tax create one?
3. Semi-elasticity: what does a coefficient of 2.93 on a tax rate in a log regression mean?
```

Prefer questions that test using a concept over defining it. Grade the whole reply at once, a
block per question: the rating (`known`, `shaky` or `new`), one line on why, and the correct
answer when the rating is not `known`:

```
1. Elasticity: known. Right: 5% / 10% = 0.5.
2. Deadweight loss: shaky. You named the triangle but not why it is lost: trades that no longer happen.
3. Semi-elasticity: new. It is the % change in y per one-unit change in x; 2.93 means about 29% per 10 points.

2 known, 1 shaky, 1 new: the path teaches the shaky and new ones first.
```

Ratings: `known` (right and sure), `shaky` (partly right, or right but unsure), `new` (wrong,
skip, or no idea). A question the reply leaves unanswered is rated `new` with "(no answer)";
do not ask again. Record all ratings in one call:
`vault.py record <vault> slug=grade slug=grade ...`.

## Recall questions

Always make the reader produce an answer. Multiple choice is for in-page quick checks only.
Ask a set of questions (review, a lesson's closing checks) in one message, numbered, and grade
them in one reply, a block per question, as in the diagnostic above.

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
`easy` (instant and complete). For each, give the right answer briefly and the single gap.

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
