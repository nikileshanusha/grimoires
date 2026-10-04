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
- No em dashes, and no spaced en dash or double hyphen standing in for one. Use a comma, a
  colon or a new sentence.
- No hedging filler ("arguably", "in some sense"). State real uncertainty once, specifically.

## Paragraphs and screens

1. **Each sentence answers the question the one before it raised.** If two neighbouring
   sentences could swap places without loss, the link between them is missing.
2. **Write the connecting words down**: because, so, which means, but, for example. Never
   delete them to save space; split the screen instead.
3. **No labels standing in for sentences.** Do not open a paragraph with "Key point:" or
   "Intuition:". Labels belong to the interface only: headings, table headers, notes, figure
   boxes.
4. **A screen is one line of reasoning**: X, because Y, so Z. "And also" twice means two
   screens. No "because" means a list of facts, not an explanation. Aim for 120 to 220 words
   of prose beside a figure.
5. **Screens connect.** The first sentence follows from the last screen's point, as the next
   sentence in a paragraph would. End by leaving a question open or pointing ahead. No meta
   openings such as "In this section we will look at".
6. **Say why before showing what.** Before an equation, table, figure or simulation, one
   sentence on what to look for; after it, one sentence on what it showed.
7. **Concrete before abstract**: the example first, then the general rule.

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
