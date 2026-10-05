# Cognia

A Claude Code plugin that turns any PDF, slide deck, paper or chapter into a personal learning vault that keeps growing. Each source updates one shared wiki of linked concepts instead of starting a new pile of notes, so every paper you add is faster to learn than the last. It is built for a learner with ADHD.

This is a private working copy, for use in Claude Code on one machine.

## Ideas it is built on

- **Karpathy's LLM knowledge base.** What you add goes in `library/` and is never edited. Claude compiles it into a linked markdown wiki and keeps it current.
- **Karpathy's ladder of output formats.** Controlled plain prose (ASD-STE100, "80% of the way"), then diagrams, then interactive HTML, each easier to absorb than the last.
- **A learning loop**: learn, check, recall, explain, review.

## Commands

Each job is its own skill, so a request loads only the instructions it needs. Claude also picks them from plain requests.

| Command | What it does |
|---|---|
| `/cognia:ingest` | Maps a new source: asks depth, proposes a controlled name, merges concepts, cards references, runs a diagnostic, builds a path, offers the explainer or essay |
| `/cognia:explainer <slug>` | Builds the interactive explainer for a source or one concept |
| `/cognia:essay <slug>` | Writes the on-the-go essay (Markdown for Obsidian) or the one-page essay web page |
| `/cognia:learn <concept>` | Teaches one concept, then checks you |
| `/cognia:plan <goal>` | Plans units for a goal in chat, then builds one unit at a time |
| `/cognia:expand <reference>` | Fetches an open-access copy of a cited work and ingests it |
| `/cognia:review` | Spaced recall in chat, at most 6 items, one at a time |
| `/cognia:explain-back <concept>` | A Feynman session: one probing question at a time, your best version saved |
| `/cognia:resume` | Last step, next step, what is due |
| `/cognia:tidy` | Files the drop folder by topic, renames a source, finds something, undoes a move |

## Where things live

Three places, so the vault stays readable:

```
study/                       THE VAULT: only what is written (open it in Obsidian)
├── VAULT.md                 home; its Topics block is generated
├── (drop files here)        the root is the inbox: tidy files it automatically
├── library/<topic>/<slug>/  what you added, renamed by rule, never edited
├── notes/<topic>/           your own notes
├── wiki/                    concepts, sources, references, paths, topics/ (generated)
├── writing/<topic>/<slug>/  essays and explainer sources Claude wrote for you
└── _meta/                   now, log, parking lot, templates, moves.log, index.json, duplicates/

study-site/                  BUILT PAGES beside the vault, rebuildable: assets/, hub, explainer and essay pages
cognia/ (this plugin)        THE BUILD ENGINE: skills, shared rules, vault.py, page templates
```

### Filing is automatic

Drop a file in the vault root. A hook runs `vault.py tidy` at session start and before each prompt, so it is filed before Claude reads your message. The topic comes from, first match wins: frontmatter `tags:` or `topic:`; the first inline `#tag` in a note; a `#tag` or leading `[tag]` in the file name (`.` nests: `[econ.labor]`); a tagged note that links the file; or one question in chat. One tag is one topic folder; nested tags nest. Files identical to one already in `library/` go to `_meta/duplicates/`. Nothing is overwritten or deleted, every move is logged, and `tidy --undo` reverses the last run, links included.

### Names follow a rule

`<author-or-organisation>-<year or nd>-<title words>`, lowercase, at most 50 characters (`saez-2001-optimal-income-tax`, `chandrasekhar-nd-unit-5-public-finance`). `vault.py rename` refuses anything else and rewrites every link. Files inside a source carry its slug, and the name you gave the file is kept as `original_name:`.

## Token use

- A skill loads only its own body, plus `core/rules.md` and the one or two guides it names.
- Each skill opens with `vault.py context`, which prints the state it needs (the due items, a source's card, the topics) so Claude reads no files to learn it.
- `vault.py about <name>` gives a page's status, gist and neighbours in a few lines, from `_meta/index.json`, which is built from the links cognia already writes and re-parses only changed pages. `where` and `changed` answer the rest.
- Explainers are built on request. Lessons link shared assets in the site folder.
- `vault.py check` tests a built page in headless Edge or Chrome and prints only the failures.
- A source is read once; its worksheet is the cache afterwards.

## Figures

The look is graphite, cards and glyphs, with meaning carried by fill, hatch, outline and dash. For an academic reader each plot also has both axes with titled, unit-bearing labels, numeric ticks at round values, direct series labels, annotated key points and a caption with a Source line. In explainers `plot()` draws all of it; `check` fails a plot without axes, an axis title, ticks or a Source line. Essays use Mermaid `xychart-beta` with axis titles.

Transitions connect concepts: a screen ends on the consequence that makes the next concept necessary and never points at the page ("the next screen"). `check` and `build` flag those phrases.

## Layout

```
cognia/
├── .claude-plugin/plugin.json
├── hooks/hooks.json         SessionStart + UserPromptSubmit: tidy
├── skills/                  ingest, explainer, essay, learn, plan, expand, review, explain-back, resume, tidy
└── core/
    ├── rules.md             read by every skill
    ├── formats/             one file per page type: layout, naming, concept, source, reference, path, meta, topic
    ├── guides/              writing, math, evidence, diagrams, learning
    ├── domains/             field-specific hard spots (_template, public-finance)
    ├── skeleton/            files a new vault starts with
    ├── engine/              assets/ (shared look), lesson.html, fragment.html, essay.html, examples/
    └── vault.py             init tidy rename index about where changed context lesson build essay check migrate find due record stats
```

## Install (this machine)

Copy this folder to `~/.claude/skills/cognia/`. Claude Code loads any folder there that has a `.claude-plugin/plugin.json` as a plugin, so the `/cognia:*` commands and the hooks work in every session. After editing, copy again and run `/reload-plugins`. Delete an older single-file copy of the skill first, or it will trigger twice.

`vault.py` needs Python 3.9+ and nothing else; `check` also needs Edge or Chrome (or set `COGNIA_BROWSER`). Pages load fonts, KaTeX and Mermaid from CDNs, so they need a connection the first time they open.

An older vault with `raw/` and `lessons/` moves over with `python core/vault.py migrate <vault>` (a dry run) and then `--apply`, which writes a zip backup beside the vault first.
