# Format: folder layout, slugs and links

```
<vault>/
├── VAULT.md                  home: counts, Topics block (generated), links to paths
├── (drop files here)         the root is the inbox; `tidy` files it by topic
├── library/<topic>/<slug>/   what you added, never edited
│   ├── <slug>.pdf            the original (its first name is `original_name:` on the source page)
│   ├── <slug>-text.md        extracted text (derived, regenerable)
│   └── <slug>-worksheet.md   extraction notes: claim, dependency chain, tiers, tags (the cache)
├── notes/<topic>/            your own notes, still yours to edit
├── wiki/
│   ├── concepts/ sources/ references/ paths/   flat: [[links]] resolve by name
│   └── topics/<topic>.md     generated index page per topic (never edit)
├── writing/<topic>/<slug>/   what Claude writes for you; no built output
│   ├── <slug>-essay.md       on-the-go essay (Obsidian)
│   └── <slug>-explainer.html fragment: screens, glossary, figure code; no shell
└── _meta/
    ├── now.md log.md parking-lot.md templates/
    ├── moves.log             every tidy move and rename; `tidy --undo` reverses the last run
    ├── index.json            graph index built by `vault.py index`
    └── duplicates/           files identical to one already in library/ (never deleted)

<vault>-site/                 BUILT pages beside the vault: assets/, index.html hub, <topic>/<slug>/
                              <slug>-explainer.html and <slug>-essay.html (`vault.py build`)
```

Topics nest (`econ/labor` is `library/econ/labor/<slug>/`). Everything outside the vault is
rebuildable: delete the site folder and run `build`.

## Slugs and links

- Slugs: lowercase, hyphenated, ASCII. Concepts by name (`deadweight-loss`), sources by
  `firstauthor-year-shortword` (`saez-2001-optimal`), references the same way.
- File name = slug + `.md`. Page title (H1) = the human name.
- Link with Obsidian wikilinks: `[[deadweight-loss]]` or `[[deadweight-loss|DWL]]`.
- Links to pages that do not exist yet are fine. They mark gaps and show in Obsidian
  graph view as ghost nodes.
