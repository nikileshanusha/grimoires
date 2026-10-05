# Format: concept page `wiki/concepts/<slug>.md`

```markdown
---
type: concept
aliases: [DWL, excess burden]
status: new            # new | shaky | learning | known | mastered
requires: ["[[elasticity]]", "[[consumer-surplus]]"]
topic: public-finance        # also read from domain:
tags: []
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
