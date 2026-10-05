# Format: controlled names

Sources are named by rule, and `vault.py rename` refuses a name that breaks it.

| Kind | Pattern | Example |
|---|---|---|
| paper, chapter, article | `<first-author>-<year>-<2 to 4 title words>` | `saez-2001-optimal-income-tax` |
| deck, lecture | `<author>-<year or nd>-<course or unit>-<topic words>` | `chandrasekhar-nd-unit-5-public-finance` |
| report | `<organisation>-<year>-<title words>` | `imf-2023-fiscal-monitor` |
| your notes | the name you gave it; only a tag is stripped | `my notes on tax.md` |

- Lowercase ASCII and hyphens, at most 50 characters, 2 to 6 words after the year.
- Use an abbreviation only when the title itself uses it. Use `nd` for an unknown year, never a guess.
- Concepts are named by idea (`deadweight-loss`); references `ref-<author>-<year>`.
- Files inside a source folder carry the slug: `<slug>.pdf`, `<slug>-text.md`, `<slug>-worksheet.md`;
  writing carries it too: `<slug>-essay.md`, `<slug>-explainer.html`, `<slug>-<concept>-explainer.html`.
- A rename moves the folders and files and rewrites every `[[link]]` and field; `tidy --undo`
  reverses it.
