# Vault schema

## Contents
1. Folder layout
2. Slugs and links
3. Concept page
4. Source page
5. Reference card
6. Learning path
7. `_meta/` files
8. Status values and transitions

## 1. Folder layout

```
<vault>/
├── VAULT.md                 # home: what's in here, counts, links to paths
├── raw/                     # immutable inputs, one folder per source
│   └── <source-slug>/
│       ├── original.pdf     # whatever was given, untouched
│       ├── text.md          # extracted text (derived, regenerable)
│       └── worksheet.md     # extraction notes: claim, dependency chain, tiers, tags
├── wiki/
│   ├── concepts/            # one page per idea; the heart of the vault
│   ├── sources/             # one page per ingested paper/deck/chapter
│   ├── references/          # cards for cited works not yet ingested
│   └── paths/               # ordered learning paths, one per source or goal
├── lessons/                 # generated interactive HTML (views, rebuildable)
│   ├── _shell/              # shared look and controls; vault.py refreshes it, never edit
│   └── <source-slug>/
│       ├── index.html       # source explainer
│       ├── <concept>.html   # optional per-concept interactives
│       ├── essay.md         # on-the-go essay (Obsidian)
│       └── essay.html       # essay page, built from essay.md by vault.py essay
└── _meta/
    ├── now.md               # you are here + the single next step
    ├── log.md               # append-only session log
    ├── parking-lot.md       # tangents saved for later
    └── templates/           # page templates (copied by init)
```

## 2. Slugs and links

- Slugs: lowercase, hyphenated, ASCII. Concepts by name (`deadweight-loss`), sources by
  `firstauthor-year-shortword` (`saez-2001-optimal`), references the same way.
- File name = slug + `.md`. Page title (H1) = the human name.
- Link with Obsidian wikilinks: `[[deadweight-loss]]` or `[[deadweight-loss|DWL]]`.
- Links to pages that do not exist yet are fine. They mark gaps and show in Obsidian
  graph view as ghost nodes.

## 3. Concept page — `wiki/concepts/<slug>.md`

```markdown
---
type: concept
aliases: [DWL, excess burden]
status: new            # new | shaky | learning | known | mastered
requires: ["[[elasticity]]", "[[consumer-surplus]]"]
domain: public-finance
box: 0                 # spaced-review box, managed by vault.py
next_review:           # YYYY-MM-DD, managed by vault.py
last_reviewed:
reviews: 0
---

# Deadweight loss

> **Gist:** One sentence, plain words.

**Why you care:** One or two sentences tying it to something the learner wants.

## Lesson
(Empty until taught. STE prose, diagrams, math decoder blocks.)

## Diagram
(Mermaid block or link to an HTML interactive.)

## Seen in
- [[saez-2001-optimal]] — uses DWL to motivate the elasticity term in eq. (3).

## Connects to
- [[tax-incidence]] — contrast: who pays vs. what is lost.

## Check yourself
- Q: ... 
- Q: ...

## In my words
(The learner's best explain-back, dated.)
```

Merge rule: before creating, search `wiki/concepts/` for the slug and every alias
(case-insensitive). If found, append to `Seen in` and `Connects to`, add new aliases,
and never overwrite `status`, review fields, or `In my words`.

## 4. Source page — `wiki/sources/<slug>.md`

```markdown
---
type: source
title: "Using Elasticities to Derive Optimal Income Tax Rates"
authors: [Emmanuel Saez]
year: 2001
kind: paper            # paper | deck | chapter | article | notes
depth: standard        # skim | standard | deep, asked at ingest
raw: raw/saez-2001-optimal/
path: "[[path-saez-2001-optimal]]"
lesson: lessons/saez-2001-optimal/index.html
essay: lessons/saez-2001-optimal/essay.md   # if written
ingested: 2026-10-05
---

# Saez (2001) — Optimal income tax from elasticities

> **Gist:** ...
**The question it answers:** ...

## Key claims
1. Claim — where (section/page) — concepts: [[...]]

## Argument skeleton
(Numbered steps or a Mermaid flowchart: assumptions → model → result → evidence.)

## Equations that matter
- Eq. (3), p. 8: `$$ ... $$` → decoded in [[optimal-top-tax-rate]]

## Leans on
- [[ref-mirrlees-1971]] — supplies the model this paper re-expresses.

## Concepts introduced / used
- New here: [[...]]
- Uses: [[...]]
```

## 5. Reference card — `wiki/references/<slug>.md`

```markdown
---
type: reference
status: carded         # carded | fetched | ingested | unavailable
cited_by: ["[[saez-2001-optimal]]"]
citation: "Mirrlees, J. (1971). An Exploration in the Theory of Optimum Income Taxation. REStud."
open_access_guess: ""  # URL if known
---

# Mirrlees (1971)

**What the citing source says it shows:** ...
**Why the citing source needs it:** ...
**Secondhand summary:** (labelled as such until fetched)
```

When fetched and ingested, set `status: ingested` and link to the new source page.

## 6. Learning path — `wiki/paths/path-<source-slug>.md`

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
Source: [[saez-2001-optimal]] · Lesson: lessons/saez-2001-optimal/index.html
Keeps: [[taxable-income-elasticity]], [[pareto-tail]], [[optimal-top-tax-rate]]

## Unit 2 · The whole schedule (planned) · ~40 min
Source: [[ref-mirrlees-1971]] · Revisits: [[taxable-income-elasticity]] at Apply
```

## 7. `_meta/` files

**now.md** — overwrite each session. Keep it under 10 lines.
```markdown
# Now
Last: finished [[elasticity]] lesson, 2/3 checks right (2026-10-05)
Next: [[taxable-income-elasticity]] (~10 min)
Path: [[path-saez-2001-optimal]] 3/9
Due for review: 2
```

**log.md** — append one line per action: `2026-10-05 · ingest · saez-2001-optimal · 14 concepts (6 reused)`.

**parking-lot.md** — `- 2026-10-05 · from [[saez-2001-optimal]]: why do economists use log utility? `

## 8. Status values

| status | meaning | set by |
|---|---|---|
| `new` | stub or unseen | ingest |
| `shaky` | diagnostic: partial knowledge | diagnostic |
| `learning` | lesson taught, in review | learn |
| `known` | diagnostic: solid, or box ≥ 3 | diagnostic / vault.py |
| `mastered` | box 5 and a passing explain-back | vault.py + explain-back |

`vault.py record` promotes `learning` → `known` at box 3. Promote to `mastered` only
after a passing explain-back on a concept already at box 5.
