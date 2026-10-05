#!/usr/bin/env python3
"""Cognia vault helper. Standard library only. Each command prints a few lines, so Claude
does not have to open pages to learn the same thing.

Usage:
  vault.py init   <vault>
  vault.py tidy   <vault> [--dry-run] [--undo] [--quiet] [--tag "file=topic"] [--min-age S]
                                                            file the vault root into library/ and notes/ by topic
  vault.py rename <vault> <old-slug> <new-slug>             controlled rename of a source and every reference
  vault.py find   <vault> <term>...                         concept pages matching names or aliases
  vault.py due    <vault> [--date YYYY-MM-DD] [--limit N]   due items with their gist
  vault.py record <vault> <concept-slug> <again|hard|good|easy> [--date YYYY-MM-DD]
  vault.py stats  <vault> [--date YYYY-MM-DD]
  vault.py lesson <vault> <source-slug> [--concept SLUG] [--title T] [--source CITATION] [--topic T]
                                                            new explainer fragment in writing/
  vault.py build  <vault> [source-slug] [--site DIR]        fragments + essays -> site folder pages and hub
  vault.py essay  <vault> <source-slug>                     build just the essay page
  vault.py check  <fragment-or-page.html>                   build, then layout self-check: failures or OK
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote, unquote

CORE = Path(__file__).resolve().parent
SKELETON = CORE / "skeleton"
ENGINE = CORE / "engine"
SHELL = ENGINE / "assets"
LESSON = ENGINE / "lesson.html"
FRAGMENT = ENGINE / "fragment.html"
HUB = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{{NAME}} · Cognia</title>
<style>:root{--bg:#f6f6f4;--fg:#1d1f21;--mut:#5d6166;--line:#d9dad6}@media(prefers-color-scheme:dark){:root{--bg:#18191b;--fg:#e8e8e6;--mut:#a0a4a8;--line:#34363a}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 Atkinson Hyperlegible,system-ui,sans-serif;margin:0;padding:2rem 16px}main{max-width:44rem;margin:auto}h1,h2{font-family:Lexend,system-ui,sans-serif;text-wrap:balance}h2{border-bottom:1px solid var(--line);padding-bottom:.25rem;margin-top:2rem}ul{list-style:none;padding:0}li{display:flex;gap:1rem;justify-content:space-between;padding:.4rem 0}a{color:inherit}span{color:var(--mut);font-size:.85rem}</style></head><body><main><h1>{{NAME}}</h1>
{{BODY}}</main></body></html>"""
INTERVALS = {0: 1, 1: 2, 2: 4, 3: 8, 4: 16, 5: 32}  # box -> days
GRADE_STEP = {"again": None, "hard": 0, "good": 1, "easy": 2}
KNOWN_AT_BOX = 3
FRAG_RE = re.compile(r"<!--@(\w+)(?: ([^>]*?))?-->")
TOPIC_DIRS = ("library", "notes", "writing")
FM_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)


def parse_date(s):
    return dt.date.fromisoformat(s) if s else dt.date.today()


def read_fm(path):
    """Return (frontmatter dict of top-level scalar fields, full text)."""
    text = path.read_text(encoding="utf-8")
    m = FM_RE.match(text)
    fields = {}
    if m:
        for line in m.group(1).splitlines():
            km = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*(#.*)?$", line)
            if km:
                fields[km.group(1)] = km.group(2).strip().strip('"').strip("'")
    return fields, text


def write_fm(path, text, updates):
    """Set top-level scalar fields in the frontmatter, adding missing ones."""
    m = FM_RE.match(text)
    if not m:
        raise SystemExit(f"{path}: no frontmatter")
    lines = m.group(1).splitlines()
    for key, val in updates.items():
        pat = re.compile(rf"^{re.escape(key)}:.*$")
        for i, line in enumerate(lines):
            if pat.match(line):
                comment = re.search(r"\s+#.*$", line)
                lines[i] = f"{key}: {val}" + (comment.group(0) if comment else "")
                break
        else:
            lines.append(f"{key}: {val}")
    new = "---\n" + "\n".join(lines) + "\n---\n" + text[m.end():]
    path.write_text(new, encoding="utf-8")


def concepts(vault):
    d = vault / "wiki" / "concepts"
    return sorted(d.glob("*.md")) if d.exists() else []


def gist(text):
    m = re.search(r"^>\s*\*\*Gist:\*\*\s*(.+)$", text, re.M)
    return m.group(1).strip() if m else ""


def norm(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def site_dir(vault, override=None):
    """Built pages live beside the vault, never inside it."""
    return Path(override).expanduser().resolve() if override else vault.parent / f"{vault.name}-site"


def refresh_assets(site):
    """Copy the shared look and controls into the site folder, so every page links one copy."""
    shutil.copytree(SHELL, site / "assets", dirs_exist_ok=True)


def topic_of(vault, slug):
    """Topic folder of a source: its page's topic field, else where its library folder sits."""
    page = vault / "wiki" / "sources" / f"{slug}.md"
    if page.exists():
        t = read_fm(page)[0].get("topic")
        if t:
            return t
    lib = vault / "library"
    for d in sorted(lib.rglob(slug)) if lib.exists() else []:
        if d.is_dir():
            return "/".join(d.relative_to(lib).parts[:-1]) or "general"
    return "general"


def writing_dir(vault, slug, topic=None):
    return vault / "writing" / (topic or topic_of(vault, slug)) / slug


def parse_fragment(text):
    """Split a fragment into its marked regions: title, source, rail, glossary, help, script."""
    parts, pos, name, val = {}, 0, None, ""
    for m in FRAG_RE.finditer(text):
        if name is not None:
            parts[name] = (val, text[pos:m.start()].strip("\n"))
        name, val, pos = m.group(1), (m.group(2) or "").strip(), m.end()
    if name is not None:
        parts[name] = (val, text[pos:].strip("\n"))
    return {k: (v[0] if k in ("title", "source") else v[1]) for k, v in parts.items()}


def build_explainer(vault, frag, site):
    """Wrap one explainer fragment in the lesson page; returns the written path."""
    f = parse_fragment(frag.read_text(encoding="utf-8"))
    rel = frag.relative_to(vault / "writing")
    out = site / rel.parent / (frag.stem + ".html")
    assets = os.path.relpath(site / "assets", out.parent).replace(os.sep, "/")
    page = LESSON.read_text(encoding="utf-8")
    for key, val in (("TITLE", html.escape(f.get("title", ""))), ("SOURCE", html.escape(f.get("source", ""))),
                     ("ASSETS", assets), ("RAIL", f.get("rail", "")), ("GLOSSARY", f.get("glossary", "")),
                     ("HELP", f.get("help", "")), ("SCRIPT", f.get("script", ""))):
        page = page.replace("{{" + key + "}}", val)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out


def log(vault, line):
    p = vault / "_meta" / "log.md"
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def cmd_init(a):
    vault = Path(a.vault).expanduser().resolve()
    created = 0
    for src in SKELETON.rglob("*"):
        dst = vault / src.relative_to(SKELETON)
        if src.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
        elif not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            created += 1
    for sub in ("library", "notes", "wiki/concepts", "wiki/sources", "wiki/references", "wiki/paths", "writing"):
        (vault / sub).mkdir(parents=True, exist_ok=True)
    print(f"vault ready at {vault} ({created} files created, existing files kept)")


def cmd_find(a):
    pages = []
    for p in concepts(Path(a.vault)):
        fm, text = read_fm(p)
        names = [p.stem] + [x for x in re.split(r"\s*,\s*", fm.get("aliases", "").strip("[]")) if x]
        h = re.search(r"^#\s+(.+)$", text, re.M)
        if h:
            names.append(h.group(1))
        pages.append((p.stem, fm, {norm(n) for n in names}))
    for term in a.terms:
        t = norm(term)
        hits = [(slug, fm) for slug, fm, names in pages if any(t in n or (len(n) > 3 and n in t) for n in names)]
        if not hits:
            print(f"{term}\tNO MATCH")
        for slug, fm in hits:
            print(f"{term}\t{slug}\tstatus={fm.get('status', '')}\tbox={fm.get('box', '0')}")


def cmd_due(a):
    vault, today = Path(a.vault), parse_date(a.date)
    due = []
    for p in concepts(vault):
        fm, text = read_fm(p)
        nr = fm.get("next_review")
        if nr:
            d = dt.date.fromisoformat(nr)
            if d <= today:
                due.append(((today - d).days, p.stem, fm.get("status", ""), fm.get("box", "0"), gist(text)))
    due.sort(reverse=True)
    total = len(due)
    for overdue, slug, status, box, g in due[: a.limit]:
        print(f"{slug}\tstatus={status}\tbox={box}\toverdue={overdue}d\tgist: {g or '(none; open the page)'}")
    if total > a.limit:
        print(f"... {total - a.limit} more due")
    print(f"DUE {total}")


def cmd_record(a):
    vault, today = Path(a.vault), parse_date(a.date)
    p = vault / "wiki" / "concepts" / f"{a.slug}.md"
    if not p.exists():
        raise SystemExit(f"no concept page: {p}")
    fm, text = read_fm(p)
    box = int(fm.get("box") or 0)
    step = GRADE_STEP[a.grade]
    box = 0 if step is None else min(5, box + step)
    status = fm.get("status", "new")
    if status in ("new", "shaky"):
        status = "learning"
    if status == "learning" and box >= KNOWN_AT_BOX:
        status = "known"
    if status in ("known", "mastered") and box == 0:
        status = "learning"
    nxt = today + dt.timedelta(days=INTERVALS[box])
    write_fm(p, text, {
        "box": box,
        "status": status,
        "last_reviewed": today.isoformat(),
        "next_review": nxt.isoformat(),
        "reviews": int(fm.get("reviews") or 0) + 1,
    })
    log(vault, f"{today.isoformat()} · review · {a.slug} · {a.grade}")
    print(f"{a.slug}: box {box}, status {status}, next {nxt.isoformat()}")


def streak(vault, today):
    p = vault / "_meta" / "log.md"
    if not p.exists():
        return 0
    days = set()
    for line in p.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^(\d{4}-\d{2}-\d{2}) · review ·", line)
        if m:
            days.add(dt.date.fromisoformat(m.group(1)))
    n, d = 0, today if today in days else today - dt.timedelta(days=1)
    while d in days:
        n, d = n + 1, d - dt.timedelta(days=1)
    return n


def cmd_stats(a):
    vault, today = Path(a.vault), parse_date(a.date)
    counts, due = {}, 0
    for p in concepts(vault):
        fm, _ = read_fm(p)
        s = fm.get("status") or "new"
        counts[s] = counts.get(s, 0) + 1
        nr = fm.get("next_review")
        if nr and dt.date.fromisoformat(nr) <= today:
            due += 1
    order = ["mastered", "known", "learning", "shaky", "new"]
    print("concepts: " + ", ".join(f"{counts.get(k, 0)} {k}" for k in order))
    print(f"due today: {due}")
    print(f"review streak: {streak(vault, today)} day(s)")
    pd = vault / "wiki" / "paths"
    for p in sorted(pd.glob("*.md")) if pd.exists() else []:
        t = p.read_text(encoding="utf-8")
        done, todo = len(re.findall(r"^\s*- \[x\]", t, re.M | re.I)), len(re.findall(r"^\s*- \[ \]", t, re.M))
        print(f"path {p.stem}: {done}/{done + todo} units")


def cmd_lesson(a):
    """Start an explainer fragment in writing/<topic>/<slug>/. The look lives in the site assets."""
    vault = Path(a.vault).expanduser().resolve()
    name = f"{a.slug}-{a.concept}-explainer.html" if a.concept else f"{a.slug}-explainer.html"
    out = writing_dir(vault, a.slug, a.topic) / name
    if out.exists():
        print(f"exists, left unchanged: {out}")
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    page = FRAGMENT.read_text(encoding="utf-8")
    page = page.replace("{{TITLE}}", (a.title or a.concept or a.slug).replace("-->", "")).replace("{{SOURCE}}", (a.source or "").replace("-->", ""))
    out.write_text(page, encoding="utf-8")
    print(out)


def essay_glossary(vault, md):
    """Glossary data for the essay page: the concept pages the essay links."""
    gloss, alias = {}, {}
    for p in concepts(vault):
        fm, text = read_fm(p)
        h = re.search(r"^#\s+(.+)$", text, re.M)
        gloss[p.stem] = {"title": h.group(1).strip() if h else p.stem.replace("-", " "), "gist": gist(text)}
        names = [p.stem, gloss[p.stem]["title"]] + [x for x in re.split(r"\s*,\s*", fm.get("aliases", "").strip("[]")) if x]
        for n in names:
            alias[n.strip().lower()] = p.stem
    links = {m.strip() for m in re.findall(r"\[\[([^\]|#]+)", md)}
    found = {alias.get(t.lower(), t) for t in links}
    data = {s: gloss[s] for s in found if s in gloss}
    data["__alias"] = {k: v for k, v in alias.items() if v in data}
    missing = sorted(t for t in links if alias.get(t.lower(), t) not in gloss)
    return data, missing


def build_essay(vault, src, site):
    """Render writing/<topic>/<slug>/<slug>-essay.md to the site; returns (path, glossary size, missing)."""
    md = src.read_text(encoding="utf-8")
    data, missing = essay_glossary(vault, md)
    title = re.search(r"^#\s+(.+)$", md, re.M)
    out = site / src.relative_to(vault / "writing").parent / (src.stem + ".html")
    assets = os.path.relpath(site / "assets", out.parent).replace(os.sep, "/")
    page = (ENGINE / "essay.html").read_text(encoding="utf-8")
    page = page.replace("{{TITLE}}", html.escape(title.group(1).strip() if title else src.stem))
    page = page.replace("{{ASSETS}}", assets)
    page = page.replace("{{MARKDOWN}}", md.replace("</script", "<\\/script"))
    page = page.replace("{{GLOSSARY}}", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out, len(data) - 1, missing


def cmd_essay(a):
    vault = Path(a.vault).expanduser().resolve()
    src = writing_dir(vault, a.slug) / f"{a.slug}-essay.md"
    if not src.exists():
        raise SystemExit(f"no essay yet: {src}")
    site = site_dir(vault, getattr(a, "site", None))
    refresh_assets(site)
    out, n, missing = build_essay(vault, src, site)
    write_hub(vault, site)
    print(out)
    print(f"glossary: {n} terms from the vault" + (f"; no concept page for: {', '.join(missing)}" if missing else ""))


def write_hub(vault, site):
    """site/index.html: every explainer and essay page, grouped by topic."""
    groups = {}
    for p in sorted(site.rglob("*.html")):
        rel = p.relative_to(site)
        if rel.parts[0] == "assets" or rel.name == "index.html" and len(rel.parts) == 1:
            continue
        groups.setdefault("/".join(rel.parts[:-2]) or "general", []).append((rel.parts[-2], rel))
    body = []
    for topic in sorted(groups):
        body.append(f"<h2>{html.escape(topic)}</h2><ul>")
        for slug, rel in groups[topic]:
            kind = "Explainer" if rel.stem.endswith("explainer") else "Essay"
            body.append(f'<li><a href="{html.escape(rel.as_posix())}">{html.escape(rel.stem)}</a> <span>{kind}</span></li>')
        body.append("</ul>")
    page = HUB.replace("{{NAME}}", html.escape(vault.name)).replace("{{BODY}}", "\n".join(body) or "<p>Nothing built yet.</p>")
    (site / "index.html").write_text(page, encoding="utf-8")


def cmd_build(a):
    vault = Path(a.vault).expanduser().resolve()
    site = site_dir(vault, a.site)
    refresh_assets(site)
    n = 0
    base = vault / "writing"
    for d in sorted(base.rglob("*")) if base.exists() else []:
        if a.slug and d.parent.name != a.slug:
            continue
        if d.name.endswith("-explainer.html"):
            print(build_explainer(vault, d, site)); n += 1
        elif d.name.endswith("-essay.md"):
            print(build_essay(vault, d, site)[0]); n += 1
    write_hub(vault, site)
    print(f"built {n} page(s) into {site}")


# ---- tidy: file what lands in the vault root --------------------------------------------

TEMP_EXT = {".crdownload", ".part", ".tmp", ".download", ".partial"}
INBOX_SKIP = {"VAULT.md"}


def find_vault(start=None):
    d = Path(start or os.getcwd()).resolve()
    return next((p for p in [d, *d.parents] if (p / "VAULT.md").exists()), None)


def clean_topic(t):
    return "/".join(x for x in (norm(seg) for seg in t.strip("/#").split("/")) if x)


def fm_tags(text):
    """Tags from frontmatter: `tags: [a, b]`, `tags: a`, a block list, or `topic: a`."""
    m = FM_RE.match(text)
    lines, tags = (m.group(1).splitlines() if m else []), []
    for i, line in enumerate(lines):
        km = re.match(r"^(tags|topic):\s*(.*)$", line)
        if not km:
            continue
        val = km.group(2).strip()
        if val:
            tags += [x.strip().strip("\"'#") for x in val.strip("[]").split(",")]
        else:
            for nxt in lines[i + 1:]:
                lm = re.match(r"^\s*-\s*(.+)$", nxt)
                if not lm:
                    break
                tags.append(lm.group(1).strip().strip("\"'#"))
    return [t for t in tags if t]


def inline_tags(text):
    """`#tag`s in the body, skipping code, URLs, headings and digit-only tags (Obsidian's rules)."""
    body = FM_RE.sub("", text, count=1)
    body = re.sub(r"```.*?```|~~~.*?~~~", "", body, flags=re.S)
    body = re.sub(r"`[^`\n]*`", "", body)
    body = re.sub(r"https?://\S+", "", body)
    out = []
    for line in body.splitlines():
        if re.match(r"^\s{0,3}#{1,6}\s", line):
            continue
        out += [t for t in re.findall(r"(?<![\w#/&])#([\w][\w\-/]*)", line) if re.search(r"[^\W\d]", t)]
    return out


def name_tag(stem):
    """(tag, name without the tag) from `#tag` or a leading `[tag]` in a file name; "." nests (econ.labor)."""
    m = re.match(r"^\[([^\]]+)\]\s*(.*)$", stem)
    if m:
        return m.group(1), m.group(2) or stem
    m = re.search(r"(?:^|\s)#([\w][\w\-./]*)", stem)
    if m:
        return m.group(1), (stem[:m.start()] + stem[m.end():]).strip() or stem
    return None, stem


def sha256(p):
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def library_sizes(vault):
    sizes = {}
    lib = vault / "library"
    for p in lib.rglob("*") if lib.exists() else []:
        if p.is_file():
            sizes.setdefault(p.stat().st_size, []).append(p)
    return sizes


def is_duplicate(p, sizes):
    cands = sizes.get(p.stat().st_size, [])
    return bool(cands) and sha256(p) in {sha256(c) for c in cands}


def unique(path):
    n, cand = 2, path
    while cand.exists():
        cand = path.with_name(f"{path.stem}-{n}{path.suffix}")
        n += 1
    return cand


def unique_dir(path, taken=()):
    n, cand = 2, path
    while cand.exists() or cand in taken:
        cand = path.parent / f"{path.name}-{n}"
        n += 1
    return cand


def rewrite_links(vault, moved):
    """Fix relative `](path)` links in md files after files moved (moved: old path -> new path)."""
    if not moved:
        return 0
    moved = {k.resolve(): v.resolve() for k, v in moved.items()}
    old_of = {v: k for k, v in moved.items()}
    changed = 0
    for base in (vault, vault / "notes", vault / "wiki", vault / "writing"):
        if not base.exists():
            continue
        for md in (base.glob("*.md") if base == vault else base.rglob("*.md")):
            here = md.resolve()
            was = old_of.get(here, here)  # where this file's links were written from
            text = md.read_text(encoding="utf-8")

            def fix(m):
                url = m.group(2)
                if re.match(r"^[a-z]+:|^#|^/", url):
                    return m.group(0)
                path = unquote(url.split("#")[0])
                target = (was.parent / path).resolve()
                dest = moved.get(target, target)
                rel = os.path.relpath(dest, here.parent).replace(os.sep, "/")
                if rel == path:
                    return m.group(0)
                frag = "#" + url.split("#", 1)[1] if "#" in url else ""
                return f"{m.group(1)}({quote(rel, safe='/')}{frag})"

            new_text = re.sub(r"(\]|!\[[^\]]*\])\(([^)\s]+)\)", fix, text)
            if new_text != text:
                md.write_text(new_text, encoding="utf-8")
                changed += 1
    return changed


def plan_tidy(vault, min_age, chat_tags):
    """Decide each root file's destination. Returns (moves, duplicates, needs_topic)."""
    now = dt.datetime.now().timestamp()
    files = [p for p in vault.iterdir() if p.is_file() and p.name not in INBOX_SKIP and not p.name.startswith(".")
             and p.suffix.lower() not in TEMP_EXT and now - p.stat().st_mtime >= min_age]
    topics, md_topic = {}, {}
    for p in files:
        tag = None
        if p.suffix.lower() == ".md":
            text = p.read_text(encoding="utf-8", errors="replace")
            tag = next(iter(fm_tags(text)), None) or next(iter(inline_tags(text)), None)
            if tag:
                md_topic[p] = clean_topic(tag)
        ntag = name_tag(p.stem)[0]
        topics[p] = md_topic.get(p) or (clean_topic(ntag.replace(".", "/")) if ntag else None)  # file names can't hold "/", so "." nests
    for p in files:  # a tagged note's links give its untagged companions the note's topic
        if p in md_topic:
            text = p.read_text(encoding="utf-8", errors="replace")
            refs = {norm(unquote(x).rsplit("/", 1)[-1]) for x in re.findall(r"\]\(([^)\s]+)\)", text)}
            refs |= {norm(x.split("|")[0].rsplit("/", 1)[-1]) for x in re.findall(r"\[\[([^\]]+)\]\]", text)}
            for q in files:
                if not topics[q] and (norm(q.name) in refs or norm(q.stem) in refs):
                    topics[q] = md_topic[p]
    for p in files:
        for want, topic in chat_tags.items():
            if not topics[p] and want in (p.name.lower(), p.stem.lower()):
                topics[p] = clean_topic(topic)
    sizes = library_sizes(vault)
    moves, dups, needs, taken = {}, [], [], set()
    for p in sorted(files):
        if p.suffix.lower() != ".md" and is_duplicate(p, sizes):
            dups.append(p)
            continue
        if not topics[p]:
            needs.append(p)
            continue
        clean = name_tag(p.stem)[1]
        if p.suffix.lower() == ".md":
            moves[p] = unique(vault / "notes" / topics[p] / f"{clean}{p.suffix}")
        else:
            d = unique_dir(vault / "library" / topics[p] / (norm(clean) or "untitled"), taken)
            taken.add(d)
            moves[p] = d / f"{d.name}{p.suffix.lower()}"
    return moves, dups, needs


def cmd_tidy(a):
    vault = find_vault() if a.auto else Path(a.vault).expanduser().resolve()
    if vault is None or not (vault / "VAULT.md").exists():
        if a.auto:
            return 0
        raise SystemExit(f"no vault at {vault} (no VAULT.md)")
    if a.undo:
        return undo_tidy(vault)
    chat = {}
    for item in a.tag or []:
        k, _, v = item.partition("=")
        chat[k.strip().lower()] = v.strip()
    moves, dups, needs = plan_tidy(vault, a.min_age, chat)
    rel = lambda p: p.relative_to(vault).as_posix()
    lines = [f"{rel(s)} -> {rel(d)}" for s, d in moves.items()]
    lines += [f"{rel(p)} -> _meta/duplicates/ (identical to a library file)" for p in dups]
    lines += [f"needs a topic: {p.name}" for p in needs]
    summary = f"tidy: moved {len(moves)}, duplicates {len(dups)}, needs a topic {len(needs)}"
    if a.dry_run:
        print("\n".join(lines + [summary]))
        return 0
    run, entries = dt.datetime.now().strftime("%Y%m%dT%H%M%S%f"), []
    for s, d in moves.items():
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(s), str(d))
        entries.append({"run": run, "from": rel(s), "to": rel(d)})
    for p in dups:
        dest = unique(vault / "_meta" / "duplicates" / p.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(p), str(dest))
        entries.append({"run": run, "from": rel(p), "to": rel(dest)})
    links = rewrite_links(vault, moves)
    if entries:
        logf = vault / "_meta" / "moves.log"
        logf.parent.mkdir(parents=True, exist_ok=True)
        with logf.open("a", encoding="utf-8") as f:
            f.writelines(json.dumps(e) + "\n" for e in entries)
        log(vault, f"{dt.date.today().isoformat()} · tidy · moved {len(moves)}, duplicates {len(dups)}")
    if links:
        summary += f", links fixed in {links} page(s)"
    if a.auto:  # a hook: stay silent unless something happened or Claude must ask for a topic
        if entries:
            print(summary)
        if needs:
            print("cognia: " + ", ".join(p.name for p in needs) + " in the vault root need a topic. Ask the user which topic "
                  "(one question, listing existing topics), then run vault.py tidy --tag \"name=topic\".")
    elif entries or not a.quiet:
        print("\n".join(lines + [summary]))
    return 0


def undo_tidy(vault):
    logf = vault / "_meta" / "moves.log"
    rows = [json.loads(x) for x in logf.read_text(encoding="utf-8").splitlines() if x.strip()] if logf.exists() else []
    if not rows:
        print("nothing to undo")
        return 0
    last = rows[-1]["run"]
    back = {}
    for r in reversed([r for r in rows if r["run"] == last]):
        if r.get("kind") == "rename":
            do_rename(vault, r["to"], r["from"])
            back[Path(r["to"])] = Path(r["from"])
            continue
        src, dst = vault / r["to"], vault / r["from"]
        if not src.exists() or dst.exists():
            print(f"skipped (changed since): {r['to']}")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        back[src] = dst
        for d in (src.parent, src.parent.parent):  # drop folders the move left empty
            if d != vault and d.exists() and not any(d.iterdir()):
                d.rmdir()
    rewrite_links(vault, {k: v for k, v in back.items() if k.is_absolute()})
    logf.write_text("".join(json.dumps(r) + "\n" for r in rows if r["run"] != last), encoding="utf-8")
    print(f"undone: {len(back)} move(s)")
    return 0


# ---- rename: controlled names for sources -----------------------------------------------

NAME_RE = re.compile(r"^[a-z][a-z0-9]*-(?:\d{4}|nd)(?:-[a-z0-9]+){1,6}$")
SLUG_SUFFIX = ("text", "worksheet", "essay", "explainer")


def check_name(new):
    """The naming rule: <author-or-organisation>-<year or nd>-<2 to 6 title words>, lowercase ASCII, 50 characters."""
    if len(new) > 50 or not NAME_RE.match(new):
        raise SystemExit(f"'{new}' breaks the naming rule: <author>-<year or nd>-<title words>, lowercase ASCII with hyphens, "
                         "at most 50 characters (saez-2001-optimal-income-tax, chandrasekhar-nd-unit-5-public-finance)")


def slug_dirs(vault, base, slug):
    root = vault / base
    return [d for d in sorted(root.rglob(slug)) if d.is_dir()] if root.exists() else []


def rename_in_folder(folder, old, new):
    """Rename the folder's files that start with the old slug, then the folder itself."""
    for f in sorted(folder.iterdir()):
        if f.name == old or f.name.startswith(old + ".") or f.name.startswith(old + "-"):
            f.rename(folder / (new + f.name[len(old):]))
    target = folder.with_name(new)
    folder.rename(target)
    return target


def do_rename(vault, old, new):
    """Rename a source everywhere: library and writing folders, pages, and every reference. Returns pages edited."""
    lib, wr = slug_dirs(vault, "library", old), slug_dirs(vault, "writing", old)
    src, path = vault / "wiki" / "sources" / f"{old}.md", vault / "wiki" / "paths" / f"path-{old}.md"
    if not (lib or wr or src.exists()):
        raise SystemExit(f"no source called '{old}' (looked in library/, writing/ and wiki/sources/)")
    for d in lib + wr:
        if d.with_name(new).exists():
            raise SystemExit(f"already exists: {d.with_name(new)}")
    for pg, to in ((src, vault / "wiki" / "sources" / f"{new}.md"), (path, vault / "wiki" / "paths" / f"path-{new}.md")):
        if pg.exists():
            if to.exists():
                raise SystemExit(f"already exists: {to}")
            pg.rename(to)
    for d in lib + wr:
        rename_in_folder(d, old, new)
    sfx = "|".join(SLUG_SUFFIX)
    pats = [re.compile(rf"(?<![\w-]){re.escape(x)}(?=$|[^\w-]|-(?:{sfx})\b|-[\w-]*-explainer\b)", re.M) for x in (f"path-{old}", old)]
    subs = (f"path-{new}", new)
    edited = 0
    for base in ("wiki", "writing", "notes", "_meta"):
        root = vault / base
        for md in root.rglob("*.md") if root.exists() else []:
            text = md.read_text(encoding="utf-8")
            out = text
            for pat, sub in zip(pats, subs):
                out = pat.sub(sub, out)
            if out != text:
                md.write_text(out, encoding="utf-8")
                edited += 1
    for frag in (vault / "writing").rglob("*-explainer.html") if (vault / "writing").exists() else []:
        text = frag.read_text(encoding="utf-8")
        out = text
        for pat, sub in zip(pats, subs):
            out = pat.sub(sub, out)
        if out != text:
            frag.write_text(out, encoding="utf-8")
            edited += 1
    return edited


def original_name_of(vault, slug):
    logf = vault / "_meta" / "moves.log"
    for line in (logf.read_text(encoding="utf-8").splitlines() if logf.exists() else []):
        r = json.loads(line)
        if r.get("kind") != "rename" and Path(r["to"]).parent.name == slug:
            return Path(r["from"]).name
    return ""


def cmd_rename(a):
    vault = Path(a.vault).expanduser().resolve()
    check_name(a.new)
    orig = original_name_of(vault, a.old)
    n = do_rename(vault, a.old, a.new)
    page = vault / "wiki" / "sources" / f"{a.new}.md"
    if orig and page.exists():
        fm, text = read_fm(page)
        if not fm.get("original_name"):
            write_fm(page, text, {"original_name": f'"{orig}"'})
    with (vault / "_meta" / "moves.log").open("a", encoding="utf-8") as f:
        f.write(json.dumps({"run": dt.datetime.now().strftime("%Y%m%dT%H%M%S%f"), "kind": "rename", "from": a.old, "to": a.new}) + "\n")
    log(vault, f"{dt.date.today().isoformat()} · rename · {a.old} -> {a.new}")
    print(f"renamed {a.old} -> {a.new} ({n} page(s) updated)")


def find_browser():
    if os.environ.get("COGNIA_BROWSER"):
        return os.environ["COGNIA_BROWSER"]
    for name in ("msedge", "chrome", "google-chrome", "chromium", "chromium-browser"):
        if shutil.which(name):
            return shutil.which(name)
    for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"):
        if Path(p).exists():
            return p
    raise SystemExit("no Edge or Chrome found; set COGNIA_BROWSER to its path")


def cmd_check(a):
    page = Path(a.page).resolve()
    if not page.exists():
        raise SystemExit(f"no such page: {page}")
    if "<!--@rail-->" in page.read_text(encoding="utf-8"):  # a fragment: build it, then check the built page
        vault = next((d for d in page.parents if (d / "VAULT.md").exists()), None)
        if not vault:
            raise SystemExit("fragment is not inside a vault (no VAULT.md above it)")
        site = site_dir(vault)
        refresh_assets(site)
        page = build_explainer(vault, page, site)
        write_hub(vault, site)
    browser, W, H = find_browser(), 1366, 768

    def run(w, h):
        with tempfile.TemporaryDirectory() as prof:  # fresh profile: no saved predictions, theme or screen
            r = subprocess.run([browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                                f"--user-data-dir={prof}", f"--window-size={w},{h}", "--virtual-time-budget=8000",
                                "--dump-dom", page.as_uri() + "#check"],
                               capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        m = re.search(r'<pre id="cognia-check">(.*?)</pre>', r.stdout, re.S)
        if not m:
            raise SystemExit("check did not run: the page lacks the cognia shell, or a script error stopped it")
        return json.loads(html.unescape(m.group(1)))

    res = run(W, H)
    if (res["vw"], res["vh"]) != (W, H):  # headless windows lose some size to browser chrome
        res = run(2 * W - res["vw"], 2 * H - res["vh"])
    problems = res["problems"]
    for p in problems:
        print(p)
    print("OK" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("init"); s.add_argument("vault"); s.set_defaults(fn=cmd_init)
    s = sub.add_parser("tidy"); s.add_argument("vault", nargs="?"); s.add_argument("--auto", action="store_true"); s.add_argument("--quiet", action="store_true"); s.add_argument("--dry-run", action="store_true"); s.add_argument("--undo", action="store_true"); s.add_argument("--tag", action="append"); s.add_argument("--min-age", type=float, default=3.0); s.set_defaults(fn=cmd_tidy)
    s = sub.add_parser("rename"); s.add_argument("vault"); s.add_argument("old"); s.add_argument("new"); s.set_defaults(fn=cmd_rename)
    s = sub.add_parser("find"); s.add_argument("vault"); s.add_argument("terms", nargs="+"); s.set_defaults(fn=cmd_find)
    s = sub.add_parser("due"); s.add_argument("vault"); s.add_argument("--date"); s.add_argument("--limit", type=int, default=6); s.set_defaults(fn=cmd_due)
    s = sub.add_parser("record"); s.add_argument("vault"); s.add_argument("slug"); s.add_argument("grade", choices=GRADE_STEP); s.add_argument("--date"); s.set_defaults(fn=cmd_record)
    s = sub.add_parser("stats"); s.add_argument("vault"); s.add_argument("--date"); s.set_defaults(fn=cmd_stats)
    s = sub.add_parser("lesson"); s.add_argument("vault"); s.add_argument("slug"); s.add_argument("--concept"); s.add_argument("--title"); s.add_argument("--source"); s.add_argument("--topic"); s.set_defaults(fn=cmd_lesson)
    s = sub.add_parser("build"); s.add_argument("vault"); s.add_argument("slug", nargs="?"); s.add_argument("--site"); s.set_defaults(fn=cmd_build)
    s = sub.add_parser("essay"); s.add_argument("vault"); s.add_argument("slug"); s.add_argument("--site"); s.set_defaults(fn=cmd_essay)
    s = sub.add_parser("check"); s.add_argument("page"); s.set_defaults(fn=cmd_check)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
