# Guide: the lecture plan

Applies to the explainer and the essay. Both are one lecture by a patient professor: one story,
told in order, where the important idea gets the spotlight. A professor decides what matters
before writing a single slide. The lecture plan is that decision, written down.

## When to write it

Before building anything. If `library/<topic>/<slug>/<slug>-worksheet.md` already has a
`## Lecture plan` section, reuse it. If not, write it from the worksheet (do not reread the
source) and append it to the worksheet. The explainer and the essay share one plan, so the two
always tell the same story. A concept explainer writes a short plan for that concept under
`## Lecture plan: <concept>`.

There is no checkpoint with the reader. They have not read the source, so they cannot judge the
emphasis; asking them only costs their time. Write the plan and go straight on to the build.
Getting the emphasis right is your job, and the source itself is the anchor (below).

## What it holds

```markdown
## Lecture plan

**Stated contribution:** "We show that the optimal top rate depends on three
measurable statistics." (abstract, p. 1)

**The one thing:** The best top tax rate follows from three numbers, and the fight is
almost all about one of them, the elasticity e.

**The arc:**
- Tension: rich-country top rates range from 37% to over 70%, and both sides claim economics.
- Turn: do not search over rates; ask what one small step up gains and loses.
- Payoff: the gain and the losses balance at τ* = (1−ḡ)/(1−ḡ+ae).
- So what: a and ḡ are close to settled, so the debate is really a debate about e.

**Load-bearing ideas, ranked:**
1. The small-step argument: one gain, two losses, balanced at the best rate.
2. The elasticity e sets the loss, and it is the input people disagree on.
3. The Pareto tail a sets how far top incomes reach, so how big the gain is.

**Supporting cast:**
- Marginal vs average tax rate (known): a clause.
- Pareto distribution (new): a paragraph, inside idea 3.
- First-order condition: a footnote.
- Social welfare weights ḡ (shaky): a paragraph, inside idea 1.

**Running example:** one surgeon earning $1.8M, taxed at the top rate on the $1.2M above the line.

**Left out or demoted:**
- The derivation for a bounded income distribution (slides 14 to 16): a technical case that
  does not change the formula's message.
- The history of US top rates (slides 2 to 4): reduced to the opening tension.

**Three-sentence test:**
1. The best top rate balances one gain against two losses from a small rise.
2. Three numbers settle it: the tail a, the response e and the weight ḡ.
3. Most of the disagreement is about e.
```

- **Stated contribution**: quote the line where the source says what it shows (the abstract,
  the intro's "this paper shows", the conclusion, or the title and summary slides of a deck),
  with its location.
- **The one thing**: the sentence the reader should still remember in a year. It must match
  the stated contribution. If it differs (for example, because the reader's goal in
  `/cognia:plan` points elsewhere), say why in one line under it. Otherwise, follow the source.
- **The arc**: the opening tension (why anyone cares), the turn (the key insight), the payoff,
  and the so-what.
- **Load-bearing ideas, ranked (2 to 4)**: what the one thing stands on, most important first.
  The worksheet's `central` finding is idea 1 or the payoff.
- **Supporting cast**: every prerequisite or detail the lecture uses, each given a weight:
  *a clause*, *a paragraph*, or *its own screen/section*. Only a load-bearing idea, or a `new`
  prerequisite that the one thing cannot be understood without, gets its own screen or section.
  A `known` prerequisite is always a clause.
- **Running example**: one concrete case that runs through the whole lecture. Every figure and
  worked number uses it unless it truly cannot.
- **Left out or demoted**: slide or page content that was cut or shrunk, with a one-line reason each.
- **Three-sentence test**: the three sentences a student must leave with. They become the most
  prominent headlines and the pull quote.

## How to weigh

Weight comes from how much of the *argument* rests on an idea, never from how many slides or
pages cover it. A deck that spends five slides on a definition does not make the definition the
point. Ask of each idea: if the reader forgot it, would the one thing still make sense? If yes,
it is supporting cast, and usually a clause or a paragraph.

Depth (`/cognia:ingest`) changes how much of the supporting cast appears and how far each
derivation goes, never what the one thing is. At Deep, more of the cast earns a paragraph and
`new` prerequisites may earn their own screen; the load-bearing ideas still lead.

## The headline read (self-check for both outputs)

Before polishing anything else, read only the title and the headlines, in order:

1. Do they tell the story by themselves, as the arc?
2. Is the one thing the most prominent claim (the title, the payoff screen or section, the
   pull quote)?
3. Does any low-level idea have a screen or section it did not earn in the plan?
4. Would a professor spend this much time on it?

Fix the emphasis first. Then compare the headlines with the stated contribution: a reader who
only skims the headlines should come away with the source's own main claim.

The hand-off in chat stays short: the one thing in a sentence, plus where the contribution line
it rests on sits in the source, so the reader can trust it without opening the source.
