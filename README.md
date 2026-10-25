# Grimoires

A grimoire is a book of spells. This repo is mine for an AI: a growing collection of [Claude skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) and [Claude Code plugins](https://docs.claude.com/en/docs/claude-code/plugins), each one a capability I want my assistant to have on hand.

A **skill** is a folder of instructions, references and small scripts. Claude reads only the skill's short description until a task calls for it, then loads the rest. So the skills cost almost nothing until they are used.

A **plugin** goes further and changes Claude Code itself: it can bundle several skills, add slash commands, or draw its own panels into the app.

## What's here

| Name | Kind | What it does | Use it when |
|---|---|---|---|
| [**cognia**](cognia/) | Plugin (private) | Turns a paper, slide deck or notes into a learning vault that grows over time: linked concept pages, a prerequisite map, interactive HTML explainers with decoded math, essays to read on the go, spaced recall and explain-back. Built for ADHD. | "Teach me this", "explain the math", "quiz me", "where was I" |
| [**sessions**](sessions/) | Plugin | Adds `/sessions`, a pane listing Claude Code sessions from every folder (not just the current one, as `/resume` does), grouped by folder with title, recency and size. Filter, search inside transcripts, open a session in a new Windows Terminal tab, or send it to the Recycle Bin. Windows only. | A session you want is missing from `/resume`, or old sessions need clearing out |
| [**survey-sleuth**](survey-sleuth/) | Skill | Audits survey instruments (Word, XLSForm, PDF, pasted text) for measurement error and instrument-integrity problems before fieldwork. It flags issues against explicit criteria and leaves every judgment call to the researcher. | Reviewing a questionnaire or XLSForm before it goes to the field |

Each folder's own README covers how it works, its inputs and its outputs. Cognia is a plugin of ten skills (`/cognia:ingest`, `/cognia:learn` and so on) and is not packaged for others yet.

## Installing

### A plugin (sessions)

This repo is a Claude Code plugin marketplace. In a Claude Code terminal session run:

```
/plugin install sessions --marketplace nikileshanusha/grimoires
```

Answer `y` to add the marketplace, then pick the user scope. See [`sessions/README.md`](sessions/README.md) for its keys and commands.

### A plugin (cognia)

Cognia is a private working copy for now; it is loaded from its folder rather than installed. See [`cognia/README.md`](cognia/README.md).

### A skill (survey-sleuth)

**claude.ai (web or desktop):** download the skill's `.zip` (for example [`survey-sleuth/survey-sleuth.zip`](survey-sleuth/survey-sleuth.zip)). In **Settings → Capabilities → Skills**, upload it.

**Claude Code:** copy the skill folder into your personal skills folder:

```sh
git clone https://github.com/nikileshanusha/grimoires.git
cp -r grimoires/survey-sleuth ~/.claude/skills/survey-sleuth
```

To make it available in one project only, copy it into that project's `.claude/skills/` instead. Start a new session, or reload VS Code, so Claude sees the new skill.

The skill then runs when a task matches its description. You can also ask for it by name.

## Layout

```
grimoires/
├── .claude-plugin/        marketplace.json: the plugins installable from this repo
├── cognia/                Claude Code plugin (skills)
│   ├── .claude-plugin/    plugin manifest
│   ├── skills/            one folder per command (ingest, learn, review, ...)
│   ├── core/              shared engine, formats, guides, vault skeleton
│   ├── hooks/  evals/
│   └── README.md
├── sessions/              Claude Code plugin (function hooks)
│   ├── .claude-plugin/    plugin manifest
│   ├── hooks/             the pane, its command, and tests
│   ├── types/             state contract
│   └── README.md
└── survey-sleuth/         skill
    ├── README.md
    └── survey-sleuth.zip
```

Skill folders ship a README and a zip ready to upload. Plugin folders ship a README and the plugin source.

## Adding a skill or plugin

1. Create a top-level folder named after it.
   - **Skill:** a `SKILL.md` with its frontmatter (`name`, `description`), and the packaged `.zip`.
   - **Plugin:** a `.claude-plugin/plugin.json` and its parts (`skills/`, `hooks/`, ...). Run `claude plugin validate <folder>` (and `claude plugin test <folder>` if it has tests).
2. Add a README for people.
3. To make a plugin installable, add it to `.claude-plugin/marketplace.json`.
4. Work on a feature branch, in small commits that each make sense alone, and open a pull request. Stack PRs when one builds on another.
5. Add a row to the table above.
