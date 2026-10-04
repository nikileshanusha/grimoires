# Cognia

A skill that turns any PDF, slide deck, paper or chapter into a personal learning vault that keeps growing. Each source updates one shared wiki of linked concepts instead of starting a new pile of notes, so every paper you add is faster to learn than the last. It is built for a learner with ADHD.

## Ideas it is built on

- **Karpathy's LLM knowledge base.** Raw sources go in `raw/` and are never edited. Claude compiles them into a linked markdown wiki and keeps it current.
- **Karpathy's ladder of output formats.** Controlled plain prose (ASD-STE100, "80% of the way"), then diagrams, then interactive HTML, each easier to absorb than the last.
- **A learning loop**: learn, check, recall, explain, review.

## What you do

| You say | It does |
|---|---|
| *drop a paper* + "learn this" | Asks how deep (skim, standard, deep), maps the paper, merges its concepts into the vault, cards key references, runs a short diagnostic, builds a path, then offers the explainer, the essay or the essay page |
| "give me something to read on my phone" | A Substack-style essay in the vault, or the same essay as one scrolling web page |
| "teach me X properly" | Plans units in chat, waits for your OK, then builds one unit at a time |
| "next" / "teach me X" | Teaches one concept, then checks you |
| "learn the paper it cites" | Fetches an open-access copy and ingests it, reusing what you already know |
| "quiz me" | Spaced recall in chat, at most 6 items, one at a time |
| "let me explain X" | A Feynman session: one probing question at a time, then your best version is saved |
| "where was I" | Last step, next step, what's due |

## The explainer

One argument told in full-screen screens that you move through with buttons or the arrow keys, never by scrolling. Each screen makes one claim: a short essay column and a hand-built figure showing the mechanism. Each opens with a "So far" line. Prerequisites are taught where the argument needs them. There are live sliders, some locked until you predict the result. The math is decoded step by step, a "What to doubt" screen tags each claim by how solid it is, and a concept map has a recall mode. A docked help panel (`?`) explains every mark, control and symbol. It comes in light and dark themes and uses legibility-first fonts (Lexend, Atkinson Hyperlegible).

A **Glossary** panel (`g`) lists every term and symbol on the page: a clickable index, a one-line definition, Show more for the full explanation with an example, and links to the screens that use it. Dotted terms in the text open it. Figure labels get real subscripts and the KaTeX math font.

There is no screen limit: depth decides what is covered, and the lesson is as long as the argument needs.

## The essay

The on-the-go reading, in the style of a Substack post or a *Mixtape* chapter: claim headings, short paragraphs, diagrams, decoded math, a pull quote, folding recall questions. **essay** mode writes Markdown that reads in Obsidian on a phone. **essay page** mode runs `vault.py essay`, which turns the same file into one scrolling page with tap-to-peek glossary terms and an A to Z glossary built from your concept pages, at no extra writing cost.

The look, navigation, help legend and controls live in one shared shell (`lessons/_shell/`), so each lesson file holds only its screens.

## Token use

Cognia borrows the ladder from the ponytail skill: before producing anything, stop at the first rung that works (nothing new, reuse, a small edit, a chat reply, a concept explainer, a full explainer). In practice:

- Explainers are built on request, not on every ingest.
- Lessons link the shared shell instead of carrying about 30k characters of CSS and JS each; Claude reads a short pattern sheet (`screens.md`) instead of a 72k sample.
- `vault.py` answers questions that would otherwise mean opening pages: `find` (concept search for merging), `due` (items with their gist), `stats`.
- `vault.py check` tests a lesson's layout in headless Edge or Chrome and prints only the failures, so only flagged screens need screenshots.
- A source is read once; its worksheet is the cache afterwards.

## Layout

Each folder holds one concern, and Claude loads only the file the current step needs.

```
cognia/
├── SKILL.md          router: the reader, where things live, which mode, global rules
├── modes/            one workflow per request: ingest, plan, learn, expand, review, explain-back, resume
├── guides/           one craft each: writing, math, evidence, diagrams, learning
├── domains/          field-specific hard spots and diagrams (_template, public-finance)
├── vault/            schema.md, skeleton/ for new vaults, vault.py (init, find, due, record, stats, lesson, essay, check)
├── explainer/        spec.md, screens.md, lesson.html, _shell/ (shared look), example/saez-2001.html
└── essay/            spec.md, essay.html, example/saez-2001.md
```

## Install

Upload `cognia.zip` as a skill in Claude, or copy the folder to `~/.claude/skills/cognia/` for Claude Code. `vault/vault.py` needs Python 3.9+ and nothing else; `check` also needs Edge or Chrome (or set `COGNIA_BROWSER`). Explainers load fonts and KaTeX from CDNs, so they need a connection the first time they open.
