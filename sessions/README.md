# Sessions

A Claude Code plugin that finds every session on the machine, whatever folder it was started in.

`/resume` lists only the sessions that were started in the current folder. A session started in `Desktop\gnp_data` does not appear when Claude Code runs in your home folder, even though home contains that folder. `/sessions` reads every project folder at once. From there you can open a session in a new terminal tab, already in the right folder, and clear out sessions you no longer need.

It runs on Windows only. It uses PowerShell, Windows Terminal and the Recycle Bin.

## What you see

`/sessions` opens a pane beside the chat:

```
╭──────────────────────────────────────────────────────╮
│ ◆ Sessions             4 sessions · 2 folders · 16 MB │
╰──────────────────────────────────────────────────────╯
╭ ⌕ filter by title, folder, id · Enter searches transcripts ╮
╭──────────────────────────────────────────────────────╮
│ BY FOLDER                                          4 │
│ ▾ gnp_data  C:\Users\…\Desktop\gnp_data               │
│ ├▶● Restructure analysis_v2.Rmd     2h ▁   0.7 MB    │
│ ├ ● Female × Among regression spec  3d ▁   1.2 MB    │
│ └ ● Regressions section rewrite     3d █  13.3 MB    │
╰──────────────────────────────────────────────────────╯
╭ selected session: folder, id, last used, size        ╮
│ [ Open in tab ]  [ Folder ]  [ Copy cmd ]  [ Delete ] │
╰──────────────────────────────────────────────────────╯
  prune >30d (0)   refresh          ● today ● week ● older
```

- **Sessions are grouped by folder.** The folder with the most recent session comes first.
- **Each row** shows the session's title, a recency dot, its age and its size. The title is the one you gave it with `/rename`, otherwise Claude's automatic title. The recency dot is sage for today, gold for this week and grey for older. The size bar compares the session with your largest one.
- **The filter box** narrows the list as you type, by title, folder or ID. Press Enter to search the full text of every transcript.
- **The card** under the list shows the selected session's full folder, ID, last-used time and size, with its actions. The card turns claret while a delete is waiting for you to confirm it.

## Keys

Select a row with the arrow keys and Enter, then press:

| Key | Does |
|---|---|
| `o` | Open the session in a new Windows Terminal tab, in its own folder |
| `f` | Open its folder in Explorer |
| `c` | Copy `cd "<folder>"; claude --resume <id>` |
| `d` | Delete: press once to arm and again to confirm |
| `p` | Prune every session older than 30 days: press once to arm and again to confirm |
| `r` | Refresh the list |

The letter keys work only when the cursor is outside the filter box. Press Tab or Esc to leave the box first.

## Commands

| Command | Does |
|---|---|
| `/sessions` | Open the pane |
| `/sessions <id>` | Open a session in a new tab. The first few characters of the ID are enough. |
| `/sessions prune <days>` | Move every session older than `<days>` to the Recycle Bin |

## Install

In a Claude Code terminal session:

```
/plugin install sessions --marketplace nikileshanusha/grimoires
```

Answer `y` to add the marketplace and pick the user scope. The plugin then loads in every session.

## Good to know

- **Deleting a session is not permanent.** The plugin moves the transcript and its `<id>/` folder to the Recycle Bin, and you can restore them from there. It also removes the session's prompts from `~/.claude/history.jsonl`, and restoring the transcript does not bring those prompts back.
- **The current session is never deleted.** This holds for both delete and prune.
- **Where the data comes from:** each session's folder and title are read from its own transcript under `~/.claude/projects/`. Nothing leaves the machine.
- **New tabs open in Windows Terminal.** If Claude Code runs in another terminal, `wt.exe` opens a new Windows Terminal window instead.

## Layout

```
sessions/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json          loads register.tsx
│   ├── register.tsx        the command, the pane, and the PowerShell it runs
│   ├── sessions.test.ts    parsing the session list
│   └── pane.test.tsx       the pane draws on every surface
└── types/index.d.ts        the plugin's state contract
```

## Developing

```sh
claude plugin validate sessions
claude plugin test sessions
```

To release a change, raise `version` in `.claude-plugin/plugin.json` and merge into `main`.
