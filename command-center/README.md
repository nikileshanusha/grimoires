# Command Center

A Claude Code plugin that gives every session a calm, wide command center: what you are working toward and how far along you are, your usage limits and when they reset, what Claude just did and why, cheaper helper agents, notes, quick actions, and every Claude Code session running on the machine.

It is built for ADHD. Colour is used for meaning, not decoration; icons are thin outlines; nothing blinks or counts up every second. The busy parts stay folded until you click them.

## What you see

**Glance, above the prompt.** One quiet line with only what matters now. The 5h limit always leads, on two lines: how much is used, then the clock time it resets and how long until then. After it come the current task and its ETA, a recent failure, helpers at work, and other busy sessions. **More** opens a little: the mission's steps, the last few actions and quick actions.

**Status line, under the prompt.** `ctx 34% | 5h 41% resets 4:30 pm | 7d 18% | cache warm 52m | ~6m left`

**The full command center** (`/cc`), in four layouts you can switch between. **Refresh** at the top reads everything again at once: sessions, helpers, limits and the mission.

| Layout | Shape |
|---|---|
| Strip | Mission across the top, then a row of tiles: now / next, limits, elsewhere, actions, notes |
| Rows | Mission and activity side by side, then agents, sessions and notes |
| Columns | Three columns: mission, activity, everything else |
| Focus | The mission large, with a drawer of tabs for the rest |

Its cards:

- **Mission.** A goal derived from the conversation (or one you pin with `/mission`) and a scrollable diagram of the steps: done, now, next, with an ETA from how long earlier steps took.
- **Activity.** One short line per thing Claude did ("Read cards.tsx", "Ran the tests"). Click a line for the why, the full command, its output, and Copy command / Explain.
- **Limits.** Context, 5h and weekly gauges with the time each window resets; they turn amber at 70% and red at 90%, with a one-time alert as each threshold is crossed.
- **Agents.** Running subagents, and buttons to hand a small job to a cheaper helper: **scout** (Haiku, finds things), **tester** (Sonnet, runs tests), **scribe** (Haiku, drafts text).
- **Sessions.** Every Claude Code session on the machine, from terminals, IDEs and the desktop app, with whether its prompt cache is still warm. Past sessions can be deleted to a trash folder and restored; sessions older than 30 days can be cleaned up in one go.
- **Notes.** Type and press Enter to save, or **Save & send to Claude**. Notes are also written to `~/.claude/command-center-notes.md`.
- **Quick actions.** Built-in Recap, Review, Tests and Compact, plus your own.

## Where it draws

| | Desktop app / VS Code | Terminal |
|---|---|---|
| Glance above the prompt | yes | yes |
| Status line | yes | yes |
| Full command center | opens beside the chat on its own | `/cc`: beside the chat in fullscreen from 110 columns, otherwise above the prompt |

On the desktop it draws icons and an SVG step diagram; in a terminal the same cards use text glyphs and bars.

## Commands

| Command | Does |
|---|---|
| `/cc` | Open the command center |
| `/cc-layout strip \| rows \| columns \| focus` | Switch layout |
| `/cc-glance on \| off` | Show or hide the glance |
| `/mission <goal>` | Pin a mission; empty clears it and goes back to the derived one |
| `/note <text>` | Save a note |
| `/spawn scout \| tester \| scribe <task>` | Hand a task to a helper agent |
| `/cc-action add <label> \| <prompt>` · `remove <label>` · `list` | Manage your own quick actions |

## Install

In a Claude Code terminal session:

```
/plugin install command-center --marketplace nikileshanusha/grimoires
```

Answer `y` to add the marketplace and pick the user scope. It then loads in every session, including the desktop app's Code tab and VS Code.

To run it from a clone instead, copy the folder to `~/.claude/skills/command-center/`, or start Claude Code with `claude --plugin-dir ./command-center`.

## Good to know

- **Cache warmth** is estimated from when each session's transcript last changed, against that session's own cache lifetime (5 minutes or 1 hour, read from the transcript).
- **Deleting a session** moves its transcript to `~/.claude/command-center-trash/<date>/`; nothing is removed until you empty the trash.
- **Mission derivation** asks Haiku for a one-line goal and steps at most once every 45 seconds.
- **Nothing leaves the machine** except those Haiku calls and the helper agents you start.

## Layout

```
command-center/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json        loads register.tsx
│   ├── register.tsx      everything that talks to Claude Code: hooks, state, commands
│   ├── cards.tsx         the cards and the glance
│   ├── layouts.tsx       the four layouts
│   ├── mission.ts  eta.ts  sessions.ts  cleanup.ts   pure logic
│   └── visuals.ts  icons.ts                          palette, SVGs, Tabler icons (MIT)
├── types/index.d.ts      the plugin's state contract
└── tests/                claude plugin test command-center
```

## Developing

```sh
claude plugin validate command-center
claude plugin test command-center
```
