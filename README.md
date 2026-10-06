# Grimoires

A grimoire is a book of spells. This repo is mine for an AI: a growing collection of [Claude skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview), each one a capability I want my assistant to have on hand.

A skill is a folder of instructions, references and small scripts. Claude reads only the skill's short description until a task calls for it, then loads the rest. So the skills cost almost nothing until they are used.

## The skills

| Skill | What it does | Use it when |
|---|---|---|
| [**cognia**](cognia/) | A Claude Code plugin (private, one machine) that turns a paper, slide deck or notes into a learning vault that grows over time: linked concept pages, a prerequisite map, interactive HTML explainers with decoded math, essays to read on the go, spaced recall and explain-back. Built for ADHD. | "Teach me this", "explain the math", "quiz me", "where was I" |
| [**survey-sleuth**](survey-sleuth/) | Audits survey instruments (Word, XLSForm, PDF, pasted text) for measurement error and instrument-integrity problems before fieldwork. It flags issues against explicit criteria and leaves every judgment call to the researcher. | Reviewing a questionnaire or XLSForm before it goes to the field |

Each skill's own README covers how it works, its inputs and its outputs. Cognia is a plugin of ten skills (`/cognia:ingest`, `/cognia:learn` and so on) and is not packaged for others yet.

## Installing a skill

**claude.ai (web or desktop):** download the skill's `.zip` (for example [`survey-sleuth/survey-sleuth.zip`](survey-sleuth/survey-sleuth.zip)). In **Settings → Capabilities → Skills**, upload it.

**Claude Code (single skill):** copy the skill folder into your personal skills folder:

```sh
git clone https://github.com/nikileshanusha/grimoires.git
cp -r grimoires/survey-sleuth ~/.claude/skills/survey-sleuth
```

To make it available in one project only, copy it into that project's `.claude/skills/` instead. Start a new session, or reload VS Code, so Claude sees the new skill.

**Claude Code (plugin):** cognia is a plugin, not a single skill, so it is loaded from its folder as a plugin rather than copied into `skills/`. It is a private working copy for now; see [`cognia/README.md`](cognia/README.md).

The skill then runs when a task matches its description. You can also ask for it by name.

## Layout

```
grimoires/
├── cognia/                Claude Code plugin
│   ├── .claude-plugin/    plugin manifest
│   ├── skills/            one folder per command (ingest, learn, review, ...)
│   ├── core/              shared engine, formats, guides, vault skeleton
│   ├── hooks/  evals/
│   └── README.md
└── survey-sleuth/
    ├── README.md
    └── survey-sleuth.zip
```

Single-skill folders ship a README and a zip ready to upload. Plugins ship a README and the plugin source.

## Adding a skill

1. Create a top-level folder named after the skill, with `SKILL.md` and its frontmatter (`name`, `description`).
2. Add a README for people, and the packaged `.zip` (or, for a plugin, a `.claude-plugin/plugin.json` and a `skills/` folder).
3. Work on a feature branch, in small commits that each make sense alone, and open a pull request. Stack PRs when one builds on another.
4. Add a row to the table above.
