# Format: learning path `wiki/paths/path-<slug>.md`

```markdown
---
type: path
source: "[[saez-2001-optimal]]"
total_minutes: 85
---

# Path: Saez (2001)

## Prerequisites
- [ ] [[elasticity]] — ~8 min
- [x] [[consumer-surplus]] — known (diagnostic)

## Core
- [ ] [[taxable-income-elasticity]] — ~10 min
- [ ] [[optimal-top-tax-rate]] — ~10 min · math

## Stretch (references)
- [ ] [[ref-mirrlees-1971]] — fetch & learn
```

Units are concept-sized. If a concept needs more than 10 minutes, split it into
parts (`optimal-top-tax-rate` part 1 / part 2) rather than making a long unit.

**Goal paths** (`path-<goal-slug>.md`, from `modes/plan.md`) group units instead of concepts:

```markdown
---
type: path
goal: "Read and critique optimal income tax papers"
total_minutes: 180
---

# Path: optimal income taxation

## Unit 1 · The top rate (built) · ~35 min
Source: [[saez-2001-optimal]] · Lesson: writing/public-finance/saez-2001-optimal-income-tax/
Keeps: [[taxable-income-elasticity]], [[pareto-tail]], [[optimal-top-tax-rate]]

## Unit 2 · The whole schedule (planned) · ~40 min
Source: [[ref-mirrlees-1971]] · Revisits: [[taxable-income-elasticity]] at Apply
```
