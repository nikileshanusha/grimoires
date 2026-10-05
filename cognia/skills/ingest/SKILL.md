---
name: ingest
description: >
  Map a new paper, slide deck or notes into the vault: concepts, references, prerequisites, diagnostic and path. Use when the user drops in or names material to learn ("learn this", "add this paper").
argument-hint: "[file or topic]"
---

# Ingest a new source

Read `${CLAUDE_PLUGIN_ROOT}/core/rules.md` first. Paths starting `core/` are under `${CLAUDE_PLUGIN_ROOT}/core/`.

Goal: one source mapped, its concepts merged into the vault, a short diagnostic and a
learning path. Ingest is mapping only; the explainer is offered at the end and built when the
reader says go, so a paper they only want filed costs no lesson.

**Success test.** After the explainer, the reader can answer six questions without notes:

1. What is the source trying to explain?
2. What is the mechanism?
3. Which assumptions make the mechanism work?
4. What is established, what is argued, and what is merely claimed?
5. How do I read the central equation or equations?
6. What should I be skeptical of?

Use this test as the tiebreaker for every choice below.

## Depth

Ask once, before mapping, as one message: "How deep do you want this: skim, standard or
deep?" with the one-line descriptions below. Record the answer as `depth:` on the source
page; Learn, Plan and every later lesson on this source reuse it until the reader changes it.
Depth sets what gets covered, never a count of screens or words: a lesson is as long as its
argument needs at that depth.

| Depth | Covers | Mapping | Math |
|---|---|---|---|
| **Skim**: the gist and whether to trust it | the question, the mechanism in one picture, the result, the main doubt, a quick check | the references the argument rests on; prerequisites as one-line reminders; 2 diagnostic questions | the central equation, read aloud in words (Tier 3) |
| **Standard**: understand and explain it | everything in the screen sequence of `/cognia:explainer`; `shaky` and `new` prerequisites taught in place | as in the steps below | tiered as in `core/guides/math.md` |
| **Deep**: master it, build on it | every assumption, every derivation step that carries an idea, each `shaky` or `new` prerequisite on its own, what each key reference contributes, robustness and extensions | every cited work the argument depends on; prerequisites walked to `known` | every step decoded, with a numeric check |

If the reader does not care, use standard.

## Steps

1. **Capture.** A file in the vault root is filed by the `tidy` hook before you get here; if one
   is still there, run `tidy` first (`/cognia:tidy`). The source then sits in
   `library/<topic>/<slug>/` under a provisional slug. Read the title page and propose the
   controlled name in the same message as the depth question ("I'll file it as
   `chandrasekhar-nd-unit-5-public-finance`; how deep: skim, standard or deep?"), then run
   `vault.py rename <vault> <old> <new>`. Put the topic on the source page as `topic:` and
   `tags:`. Never edit the original. Extract the text
   with the pdf or pptx skill or plain tools into `<slug>-text.md` beside it. If the PDF is
   scanned, read the page images instead of guessing. Check `core/domains/` for a file on the
   source's field and load it if one exists. Read the source once: from here on,
   `text.md` and the worksheet are the cache. Later steps and modes reopen the original
   only for a page the worksheet lacks, and then only that page.

2. **Extraction worksheet.** Before writing anything the reader sees, write terse notes to
   `library/<topic>/<slug>/<slug>-worksheet.md`:
   - the core claim in one sentence;
   - the **dependency chain**: which idea must come before which. This sets the order of
     the explainer's screens. If you cannot write it, reread the source;
   - every equation with its tier and role (load `core/guides/math.md`), and every symbol with
     where it first appears;
   - an evidence tag for every claim (load `core/guides/evidence.md`);
   - result numbers, prerequisites, and the limitations the authors state.

3. **Source page.** Write `wiki/sources/<slug>.md` from the worksheet (format in
   `core/schema.md`).

4. **Merge concepts.** For each concept the source uses or introduces, run
   `python "${CLAUDE_PLUGIN_ROOT}/core/vault.py" find <vault> <name> <alias>...` first, and update an existing page rather than
   creating a duplicate; this is what makes the vault compound. Update with targeted edits
   (add a "Seen in" line, a new alias), never a full rewrite of an existing page. A new concept gets a page
   with its `requires:` links filled in, even to pages that do not exist yet. Add a "Seen in"
   line linking back to this source.

5. **Card the references.** For each cited work the source depends on (the depth sets how
   many), create `wiki/references/<slug>.md` with status `carded`. Do not fetch yet.

6. **Map prerequisites.** Walk `requires:` down until you reach concepts the vault already
   rates `known` or plainly foundational. Create stub pages (`status: new`) for the rest.

7. **Diagnose.** Load `core/guides/learning.md` (Diagnostic). Ask 2 (skim) to 6 rapid questions on the
   prerequisites that matter most and are not yet rated, one per message. Record each as
   `known`, `shaky` or `new`.

8. **Path.** Write `wiki/paths/path-<slug>.md`: units in dependency order, at most 10 minutes
   each, skipping `known` ones.

9. **Update state.** Rewrite `_meta/now.md` (next step: the reading), append a line to
   `_meta/log.md`, refresh the counts in `VAULT.md`.

10. **Hand off** in 3 to 5 lines: what was mapped (concepts new and reused), what the
    diagnostic found, and one question: "Next, about N min: the **explainer** (interactive, at
    a desk), the **essay** (Markdown, reads in Obsidian on your phone) or the **essay page**
    (one scrolling web page)?"

11. **Build what they pick**, at the recorded depth: the explainer with `/cognia:explainer`,
    either essay mode with `/cognia:essay`. Prerequisites rated `shaky` or `new` are taught
    where the argument needs them. If they want both later, the essay page costs almost
    nothing once the essay exists.
