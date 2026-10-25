# sessions

A Claude Code mod that adds `/sessions`, a pane that lists your Claude Code sessions from every project folder rather than only the current one, like `/resume` does. Each session shows its title, folder, recency and size, grouped by folder. From the pane you can filter, search inside transcripts, open a session in a new Windows Terminal tab, open its folder, copy its resume command, or move it to the Recycle Bin (with a confirm step). Bulk-pruning of sessions older than 30 days is included too.

Windows only: it uses PowerShell, Windows Terminal (`wt.exe`) and the Recycle Bin.

## Install

```
/plugin install sessions --marketplace nikileshanusha/grimoires
```

## Use

- `/sessions` opens the pane. Keys: `o` open in tab, `f` folder, `c` copy command, `d` delete (press twice), `p` prune >30d (press twice), `r` refresh.
- `/sessions <id>` opens a session in a new tab.
- `/sessions prune <days>` recycles sessions older than `<days>`.
