# Grimoires

A grimoire is a book of spells. This repo is mine for an AI: a growing collection of [Claude skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview), each one a capability I want my assistant to have on hand.

A skill is a folder of instructions, references and small scripts. Claude reads only the skill's short description until a task calls for it, then loads the rest. So the skills cost almost nothing until they are used.

## The skills

| Skill | What it does | Use it when |
|---|---|---|
| [**cognia**](cognia/) | Turns a paper, slide deck or notes into a learning vault that grows over time: linked concept pages, a prerequisite map, interactive HTML explainers with decoded math, essays to read on the go, spaced recall and explain-back. Built for ADHD. | "Teach me this", "explain the math", "quiz me", "where was I" |
| [**survey-sleuth**](survey-sleuth/) | Audits survey instruments (Word, XLSForm, PDF, pasted text) for measurement error and instrument-integrity problems before fieldwork. It flags issues against explicit criteria and leaves every judgment call to the researcher. | Reviewing a questionnaire or XLSForm before it goes to the field |

Each skill's own README covers how it works, its inputs and its outputs.

## Installing a skill

**claude.ai (web or desktop):** download the skill's `.zip` (for example [`cognia/cognia.zip`](cognia/cognia.zip)). In **Settings → Capabilities → Skills**, upload it.

**Claude Code:** copy the skill folder into your personal skills folder:

```sh
git clone https://github.com/nikileshanusha/grimoires.git
cp -r grimoires/cognia ~/.claude/skills/cognia
```

To make it available in one project only, copy it into that project's `.claude/skills/` instead. Start a new session, or reload VS Code, so Claude sees the new skill.

The skill then runs when a task matches its description. You can also ask for it by name.

## Layout

```
grimoires/
├── cognia/            source folder: SKILL.md, modes, guides, templates, scripts
│   ├── README.md
│   └── cognia.zip     package for claude.ai
└── survey-sleuth/
    ├── README.md
    └── survey-sleuth.zip
```

Every skill has a README and a zip ready to upload. When the source is in the repo too, the zip is built from it and leaves out the README.

## Adding a skill

1. Create a top-level folder named after the skill, with `SKILL.md` and its frontmatter (`name`, `description`).
2. Add a README for people, and the packaged `.zip`.
3. Work on a feature branch, in small commits that each make sense alone, and open a pull request. Stack PRs when one builds on another.
4. Add a row to the table above.
