# Guide: writing

Applies to vault pages, explainer prose, check answers and chat explanations.

Two sources shape it. Karpathy's tip is to ask for ASD-STE100, the controlled English of
aircraft manuals, but only "80% of the way", because the full spec reads stiff. The other
is the habit of a patient colleague at a whiteboard: full sentences, with "because" and "so"
written down. Short text with the links removed is harder to read, not easier.

## Sentences

- One new idea per sentence, usually 12 to 25 words. Put the subject and verb early.
- Use active voice with a named actor: say who does what.
- One word for one thing. Once it is "the tax base", it stays "the tax base".
- Define a term inside the sentence that first uses it, not in a fragment afterwards.
- Give an important parenthetical its own sentence.
- Each mark does its own job. An em dash sets off an aside or a turn. A colon delivers what it
  promises. A semicolon joins two closely linked clauses. Parentheses hold what can be skipped.
  No mark is banned, but none stands in for another, and none is used to dodge a better sentence.
- At most two numbers in a sentence, each with its meaning ("about 29% more missing"). The raw
  estimate goes in a margin note or an evidence block.
- Sources stay out of the argument. Write the idea ("evasion rises with the tax rate"), and put the
  author, slide or "my illustration" in a `data-src` margin note.
- No hedging filler ("arguably", "in some sense"). State real uncertainty once, specifically.

## Level and intuition

- Pitch the level at the source's own and at the diagnostic ratings, not at a fixed audience.
  A concept rated `known` gets a one-line reminder. One rated `shaky` or `new` is built up from
  what the reader already has. Basic material stays basic; advanced material is not simplified.
- Intuition comes from the mechanism: the incentive, the trade-off, the sign argument or the
  limiting case. Use an analogy only when a `new` concept has no mechanism the reader can already
  reason with, and say where it stops fitting.

## Paragraphs and screens

1. **Each sentence answers the question the one before it raised.** If two neighbouring
   sentences could swap places without loss, the link between them is missing.
2. **Write the connecting words down**: because, so, which means, but, for example. Never
   delete them to save space; split the screen instead.
3. **No labels standing in for sentences.** Do not open a paragraph with "Key point:" or
   "Intuition:". Labels belong to the interface only: headings, table headers, notes, figure
   boxes.
4. **A screen is one line of reasoning**: X, because Y, so Z. "And also" twice means two
   screens. No "because" means a list of facts, not an explanation. A screen holds about 250
   words of prose with or without a figure (equation `.where` rows, evidence blocks, table rows
   and steps count as extra words; `vault.py` budgets them). Over that, split the screen into a
   figure screen and a reading screen; never delete the "because" and "so" links.
5. **A screen opens with a bridge sentence**, not a recap line: it picks up the question the last
   screen left open. Then the order is the puzzle, why it should be true (the mechanism), the
   finding in plain words, the evidence, and the implication that raises the next question.
   The question comes before the answer.
6. **Screens connect through the idea, never through the page.** A screen or section ends with
   the consequence that makes the next concept necessary, and the next one opens from that
   consequence, as the next sentence in a paragraph would. Never point at the page itself:
   no "the next screen", "below", "coming up", "we'll see", "let's" or "in this section". Refer
   back the way a paper does, by concept or figure ("the loss in Figure 2"), not by screen number.
7. **Say why before showing what.** Before an equation, table, figure or simulation, one
   sentence on what to look for; after it, one sentence on what it showed.
8. **Concrete before abstract**: the example first, then the general rule.

## Transitions

Before (points at the page):

> The best rate is where they balance, and the next two screens measure each side.

After (states the link to the next concept):

> The best rate is where the gain and the two losses balance, so the next question is how large
> each loss is, starting with the behavioural effect: how much reported income falls when the
> rate rises.

Before: "The next screen lets you set the tax rate and watch firms make the choice."
After: "A firm's choice therefore turns on the tax rate it faces, which is the parameter to vary."

## Padding

Padding adds nothing: restating the last sentence, generic encouragement ("This is a crucial
concept!"), narration ("Let's dive in"), stacked hedges, a summary at the end of the same
screen. Connecting words, a reason, a lead-in sentence, and a worked example that clears up a
likely confusion are not padding.

## Example

Before:

> Selection bias. Treated ≠ comparable. Volunteers differ. Naive difference = effect + bias.

After:

> Suppose anyone can sign up for a training program, and a month later the people who signed
> up earn more. It is tempting to read that gap as the effect of the training, but the two
> groups were already different: the people who enrolled may have been more motivated. So
> the gap mixes the real effect with differences that were there all along, and that second
> part is called selection bias.

Check answers follow the same rules. A bare result ("It halves.") wastes the moment; say why
("It halves, because the standard error scales with one over the square root of n").
