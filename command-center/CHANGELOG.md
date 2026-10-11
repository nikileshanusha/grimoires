# Changelog

Versions follow `MAJOR.MINOR.PATCH`: a patch fixes something, a minor
version adds or changes something you can see, a major version changes how
you use it. Raise the version in `.claude-plugin/plugin.json` with every
change that should reach installed copies; `claude plugin update` installs a
new version only when this number changes.

## 0.4.0 — 2026-10-11

**Added**
- Click a session (its name or icon) to open its details: the folder it
  runs in, where it runs, when it was last active, and **Copy resume
  command** (`cd "<folder>"; claude --resume <id>`) and **Open folder**.
  Past sessions open the same way.
- **+ N more** in the live list is a button that shows every session.

**Fixed**
- Status labels (here, busy, running…) are coloured words instead of a pale
  box that glared on a dark theme.
- **Clear this chat** has its own row at the bottom of the live list instead
  of an unlabeled column on one row.

## 0.3.0 — 2026-10-11

**Added**
- `/cc off` closes the command center and keeps it from opening by itself
  in new sessions; `/cc` opens it again and turns that back on.

**Tests**
- The control sweep gets 30 seconds per run (about 200 presses each).

## 0.2.0 — 2026-10-11

**Fixes**
- Deleting a session works on long Windows paths (past 260 characters) and
  says why when it can't; the row leaves the list at once.
- Live sessions in folders whose names Claude Code shortened are found.
- The Agents card no longer takes the whole pane down once a helper is
  listed.
- A prompt or helper that fails to start says so instead of failing silently.
- Two notes saved in the same millisecond no longer share an id.
- Background work no longer leaves an unhandled error when a session closes
  mid-way.
- The mission's Earlier / Later controls can't be covered by the diagram.

**Added**
- Refresh button that reads everything again at once.
- Reset times on every limit, and weekly pacing (`pace −32%`) instead of the
  weekly reset day.
- Pressable icons and limit rings.
- Status line as a calm, slow ticker with a fixed-width slot.
- Layouts that size the limits to the room they get: rows in narrow cards,
  rings when there is space; polished Strip, Focus and Columns.
- Tests: a sweep of every layout at four widths on both surfaces pressing
  every control, and end-to-end tests of every feature.

## 0.1.0 — 2026-10-10

First version: mission and step diagram with ETAs, glance above the prompt,
status line, activity feed, helper agents, notes, quick actions, and every
Claude Code session on the machine with trash and restore.
