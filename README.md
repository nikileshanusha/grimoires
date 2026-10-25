# Grimoires

A grimoire is a book of spells. This one is mine for Claude: the skills and plugins I build to work better with AI, kept in one place.

- A **skill** is a folder of instructions and small scripts. Claude reads only its one-line description until a task needs it, so an unused skill costs almost nothing.
- A **plugin** changes Claude Code itself. It can add slash commands, draw panels, react to what Claude does, or bundle several skills.

## What's here

| Name | Kind | What it does |
|---|---|---|
| [**sessions**](sessions/) | Plugin | `/sessions` lists Claude Code sessions from every folder, which `/resume` doesn't. From the list you can search them, open one in a new terminal tab, or move old ones to the Recycle Bin. Windows only. |
| [**cognia**](cognia/) | Plugin, private | Turns a paper, slide deck or notes into a learning vault that grows over time: linked concept pages, interactive explainers, spaced recall. Built for ADHD. |
| [**survey-sleuth**](survey-sleuth/) | Skill | Audits a survey instrument (Word, XLSForm, PDF) for measurement error before fieldwork. It flags issues and leaves the judgment calls to the researcher. |

Each folder's README explains how it works and how to use it.

## Installing

**A plugin.** This repo is a Claude Code plugin marketplace. In a Claude Code session, run:

```
/plugin install <name> --marketplace nikileshanusha/grimoires
```

Answer `y` to add the marketplace, then pick the user scope. The plugin loads in every new session after that.

Cognia is not in the marketplace yet. It is loaded from its folder, as [its README](cognia/README.md) explains.

**A skill.** On claude.ai, upload the skill's `.zip` under **Settings → Capabilities → Skills**. In Claude Code, copy the skill's folder into `~/.claude/skills/`:

```sh
git clone https://github.com/nikileshanusha/grimoires.git
cp -r grimoires/survey-sleuth ~/.claude/skills/
```

To use it in one project only, copy it into that project's `.claude/skills/` instead. Start a new session so Claude picks it up.

## Adding something

1. Make a top-level folder named after it, with a README.
   - **Skill:** `SKILL.md` (with `name` and `description` in its frontmatter) and the packaged `.zip`.
   - **Plugin:** `.claude-plugin/plugin.json` and its parts. It must pass `claude plugin validate <folder>`, and `claude plugin test <folder>` too if it has tests.
2. If it's a plugin, list it in `.claude-plugin/marketplace.json`.
3. Add a row to the table above.
4. Work on a branch, in small commits that each make sense alone, and open a pull request. Stack pull requests when one builds on another.
