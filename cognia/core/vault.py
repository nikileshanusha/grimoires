#!/usr/bin/env python3
"""Cognia vault helper. Standard library only. Each command prints a few lines, so Claude
does not have to open pages to learn the same thing.

Usage:
  vault.py init   <vault>
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
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

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
