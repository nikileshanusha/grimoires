# Guide: math

Keep two tracks apart: the concept track (what is claimed about the world) and the notation
track (how the symbols say it). Explain the idea in words first, then show how the symbols
say the same thing.

## Tier every equation during extraction

- **Tier 1, conceptual**: the core model, objective, equilibrium or optimality condition,
  main identification equation, anything on the domain file's hard-spot list, and anything
  matching the hard spots below. Full decoder, no steps skipped.
- **Tier 2, operational**: intermediate transformations and definitions needed to follow a
  derivation. One plain sentence, the equation and a symbol table.
- **Tier 3, mechanical**: rearrangements and substitutions. One plain sentence. Decode fully
  only if there is a real trap, such as a sign flip that reverses the meaning, and say why.

When unsure, tier down. Over-decoding buries the important equations.

## The Tier 1 decoder

Five moves in this order, linked by sentences so the reader knows why the next one is coming:

1. **Say what the equation claims, in words with no symbols.** This alone gives a correct
   rough picture.
2. **Work a small numeric example before the formal equation**: small, labelled, real
   arithmetic, introduced with why and closed with what it showed.
3. **Show the equation** exactly as in the source (or accurately reformatted), with its
   location, and a lead-in tying it to the example.
4. **Give a symbol list**: symbol, plain meaning, type (number, set, function), and where the
   reader met it.

Moves 3 and 4 are one fixed component, never free markup. In an explainer it is the
`.equation` block (`data-src` for the location, a `.where` list for the symbols; pattern at
the top of `skills/explainer/screens.md`). In an essay it is `$$ ... $$` on its own lines,
then `Where:` with a bullet per symbol, then `(Source: slide 9)`. An equation is never written
inline in a paragraph.
5. **Restate the idea in new words**, only at a genuine bottleneck you can name. Otherwise it
   turns into "in other words… put differently…" on a loop.

In an explainer, moves 1 and 2 are the screens before the math (the pictures and sliders),
move 3 and 4 are the "In symbols" screen, and the derivation is a list of steps revealed one
at a time, each with a one-line *why* and a pointer to the screen where its idea was taught.

Before the first equation of a source with unusual notation, add a short notation primer:
what the indices mean and which symbols are sets, functions or numbers, written as sentences.

## Hard spots in any field

An equation matching one of these is Tier 1. Check the domain file first.

- **Existence and uniqueness arguments**: before any theorem language, show concretely what
  the object that exists is.
- **Rules applied to their own output** (recursion, best responses, fixed points, dynamic
  programming): walk one full pass with numbers.
- **Structured objects in unfamiliar notation** (matrices, graphs): draw or tabulate a small
  instance beside the notation.
- **Comparisons across cases**: a small table before the general inequality.
- **Limits and approximations**: say what is approximated and why that is reasonable; flag it
  if the source does not justify it.
- **First-order conditions**: say in words what "a small change makes no difference" means
  here before differentiating.

## Faithfulness

- Verify every numeric example by hand. If it does not work out cleanly, simplify it; never
  adjust numbers to make it look right.
- Check limits: plug in 0, 1, or infinity and say what should happen.
- If the extraction garbled an equation, reconstruct it from context, mark it
  "reconstructed, check against p. N", and never present the guess as the original.

- Name a variable with `\mathrm{gap}_i`, never `\text{gap}_i`. KaTeX breaks a subscripted `\text` into
  pieces in a narrow column, which scrambles the equation (`lint: mathrm`).
