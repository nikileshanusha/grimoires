#!/usr/bin/env python3
"""Cognia vault helper. Standard library only. Each command prints a few lines, so Claude
does not have to open pages to learn the same thing.

Usage:
  vault.py init   <vault>
  vault.py tidy   <vault> [--dry-run] [--undo] [--quiet] [--tag "file=topic"] [--min-age S]
                                                            file the vault root into library/ and notes/ by topic
  vault.py rename <vault> <old-slug> <new-slug>             controlled rename of a source and every reference
  vault.py index  <vault>                                   update _meta/index.json, topic pages, VAULT.md topics
  vault.py about  <vault> <name>...                         a few-line card for a page, instead of opening it
  vault.py where  <vault> <term>                            paths of anything matching, across the vault
  vault.py changed <vault>                                  pages edited since the last index
  vault.py context <skill> [args]                           what a skill needs to start (finds the vault itself)
  vault.py migrate <vault> [--apply] [--topic T]            older raw/ + lessons/ vault to the new layout (dry run first)
  vault.py find   <vault> <term>...                         concept pages matching names or aliases
  vault.py due    <vault> [--date YYYY-MM-DD] [--limit N]   due items with their gist
  vault.py record <vault> <concept-slug> <again|hard|good|easy> [--date YYYY-MM-DD]
  vault.py stats  <vault> [--date YYYY-MM-DD]
  vault.py lesson <vault> <source-slug> [--concept SLUG] [--title T] [--source CITATION] [--topic T]
                                                            new explainer fragment in writing/
  vault.py build  <vault> [source-slug] [--site DIR]        fragments + essays -> site folder pages and hub
  vault.py essay  <vault> <source-slug>                     build just the essay page
  vault.py hook-lint [--stop]                               hook entry: lint the file just written (stdin JSON), or this session's files
  vault.py check  <fragment-or-page> [--static]             static lint, then (unless --static) build and layout self-check: failures or OK
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
import time
from html.parser import HTMLParser
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


TEASER_RE = re.compile(r"\b(next (?:\w+ )?(?:screens?|sections?|slides?)|coming up|we['\u2019]ll see|let['\u2019]s|in this section|stay tuned)\b", re.I)


def essay_warnings(md):
    """Problems a script can see in an essay: page-pointing transitions, em dashes, xycharts without axis titles."""
    out, prose = [], re.sub(r"```.*?```", "", md, flags=re.S)
    for m in TEASER_RE.finditer(prose):
        out.append(f'transition points at the page ("{m.group(0)}"); name the concept that comes next instead')
    if "\u2014" in prose:
        out.append("em dash in the prose")
    for block in re.findall(r"```mermaid\s+(xychart-beta.*?)```", md, flags=re.S):
        for axis in ("x-axis", "y-axis"):
            if not re.search(rf'^\s*{axis}\s+"[^"]+"', block, re.M):
                out.append(f"xychart has no {axis} title")
    return out


# ---- static lint: structural rules a script can test without a browser -------------------------
# Rules live here because prose rules get dropped by a model working fast; a hook runs this on
# every save (hook-lint). The browser `check` still covers what only rendering shows.

# Why these numbers: an inline equation that runs past 25 TeX characters is already a display
# equation in disguise (the study bug was 49); a glossary short line is read in one glance, and
# 20 words is about two lines in the panel; three hues per figure is the most a reader can track
# without a legend lookup.
INLINE_TEX_MAX = 25
SHORT_WORDS_MAX = 20
GREEK = ("alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi rho sigma tau "
         "upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega").split()
VOID = {"br", "hr", "img", "input", "meta", "link", "line", "path", "circle", "rect", "stop", "use", "polygon", "polyline", "ellipse"}
INLINE_RE = re.compile(r"\\\((.+?)\\\)", re.S)
DISPLAY_RE = re.compile(r"\\\[(.+?)\\\]", re.S)
ASSIGN_RE = re.compile(r"^[^=<>]{1,14}=\s*[-\u2212]?[\d.,]+\s*(\\%|%)?$")  # "a = 1.5": a value, not a floating equation
ATTR_RE = re.compile(r'([\w-]+)\s*=\s*"([^"]*)"')


def inline_tex_problem(tex):
    """Why one inline \\( \\) span should be an equation block instead, or None."""
    t = tex.strip()
    if ASSIGN_RE.match(t) or not re.search(r"[A-Za-z]", re.sub(r"\\(?:times|cdot|div|ln|log|approx|%)", "", t)):
        return None  # a value, or worked arithmetic with no symbols
    if re.search(r"=|<|>|\\le(?![a-z])|\\ge(?![a-z])|\\leq|\\geq", t):
        return "has a relation sign"
    if len(t) > INLINE_TEX_MAX:
        return f"is {len(t)} TeX characters (limit {INLINE_TEX_MAX})"
    return None


def tex_symbols(tex):
    """Symbols a reader must be told about: Greek letters, accented letters, letters with sub/superscripts, \\text names."""
    out = set()
    for m in re.finditer(r"\\([A-Za-z]+)", tex):
        if m.group(1) in GREEK:
            out.add("\\" + m.group(1))
    for m in re.finditer(r"\\(?:bar|hat|tilde|dot)\s*\{?\s*([A-Za-z])", tex):
        out.add(m.group(0).replace("{", "").replace(" ", ""))
    for m in re.finditer(r"(?<![\\A-Za-z])([A-Za-z])(?=\s*[_^])", tex):
        out.add(m.group(1) + "_")
    for m in re.finditer(r"\\text\{([^}]*)\}", tex):
        out.add("\\text{" + m.group(1) + "}")
    return out


class _Page(HTMLParser):
    """Collects what the lint needs from a fragment's rail: screens, equation blocks, display math."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.screens, self.equations, self.stray, self.inline = [], [], [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        node = {"tag": tag, "cls": cls, "attrs": a}
        if tag == "section" and "screen" in cls:
            self.screens.append({"tags": set(), "cls": set(), "h2": "", "h1": "", "title": a.get("data-title", "")})
        if self.screens:
            self.screens[-1]["tags"].add(tag)
            self.screens[-1]["cls"].update(cls)
        if tag == "div" and "equation" in cls:
            node["eq"] = {"src": a.get("data-src", "").strip(), "where": "", "tex": "", "has_where": False}
            self.equations.append(node["eq"])
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if not self.stack:
            return
        eq = next((n["eq"] for n in reversed(self.stack) if "eq" in n), None)
        in_steps = any(n["tag"] == "ol" and "steps" in n["cls"] for n in self.stack)
        if self.screens:
            for tag in ("h1", "h2"):
                if any(n["tag"] == tag for n in self.stack):
                    self.screens[-1][tag] += data
        for m in DISPLAY_RE.finditer(data):
            if eq is None:
                self.stray.append(m.group(1).strip())
            elif any("eq" in n["cls"] for n in self.stack):
                eq["tex"] += " " + m.group(1)
        if eq is not None and any(n["tag"] == "dl" and "where" in n["cls"] for n in self.stack):
            eq["where"] += " " + data
            eq["has_where"] = True
        if not in_steps:
            for m in INLINE_RE.finditer(data):
                why = inline_tex_problem(m.group(1))
                if why:
                    self.inline.append((m.group(1).strip(), why))

    def handle_comment(self, data):
        pass


def _words(s):
    return re.findall(r"[a-z0-9]+", s.lower())


def lint_fragment(text):
    """Failures in an explainer fragment, as strings. Lines starting "warning:" do not block."""
    parts = parse_fragment(text)
    rail, gloss = parts.get("rail", ""), parts.get("glossary", "")
    out = []
    page = _Page()
    page.feed(re.sub(r"<script\b.*?</script>", "", rail, flags=re.S))
    # equations: inline, display shape, symbols explained
    for tex, why in page.inline:
        out.append(f"inline equation \\({tex[:40]}\\) {why}; make it an .equation block (display, data-src, .where list) or reword it")
    for tex in page.stray:
        out.append(f"display equation \\[{tex[:40]}\\] sits outside a .equation block (needs data-src and a .where list)")
    gsyms = " ".join(re.findall(r'data-sym="([^"]*)"', gloss))
    for k, eq in enumerate(page.equations, 1):
        if not eq["src"]:
            out.append(f"equation block {k} has no data-src (where the equation sits in the source, e.g. \"slide 9\")")
        if not eq["has_where"]:
            out.append(f"equation block {k} has no .where list of its symbols")
            continue
        have = re.sub(r"[\s{}]", "", eq["where"] + " " + gsyms)
        for sym in sorted(tex_symbols(eq["tex"])):
            if re.sub(r"[\s{}]", "", sym) not in have:
                out.append(f"equation {k}: symbol {sym.rstrip('_')} is in neither its .where list nor a glossary data-sym")
    # screen skeleton
    for i, s in enumerate(page.screens):
        where = f"screen {i} ({s['title']})"
        if "kicker" not in s["cls"]:
            out.append(f"{where}: no .kicker")
        if i == 0 and "h1" not in s["tags"]:
            out.append(f"{where}: screen 0 needs an h1")
        if i > 0 and "h2" not in s["tags"]:
            out.append(f"{where}: no h2 headline")
        if i > 0 and "sofar" not in s["cls"]:
            out.append(f"{where}: no .sofar line")
        if "prose" not in s["cls"] and not ({"check", "evidence"} & s["cls"] or "textarea" in s["tags"]):
            out.append(f"{where}: no .prose block")
    # figures
    figs = re.findall(r"<figure\b.*?</figure>", rail, flags=re.S)
    nums, last = [], 0
    for f in figs:
        cap = re.search(r"<figcaption\b[^>]*>(.*?)</figcaption>", f, flags=re.S)
        capt = cap.group(1) if cap else ""
        label = re.search(r'aria-label="([^"]*)"', f)
        fn = re.search(r"<b>\s*Figure\s+(\d+)\.?\s*</b>", capt)
        name = f"figure {fn.group(1)}" if fn else "a figure"
        if not cap:
            out.append(f"{name} has no figcaption")
            continue
        if not fn:
            out.append(f"{name}: caption lacks <b>Figure n.</b>")
        else:
            nums.append(int(fn.group(1)))
        if "What to notice:" not in capt:
            out.append(f"{name}: caption lacks \"What to notice:\"")
        if "Source:" not in capt:
            out.append(f"{name}: caption lacks \"Source:\"")
        if label and fn:
            lw = set(_words(label.group(1)))
            for s in page.screens:
                hw = set(_words(s["h2"]))
                if hw and lw and len(lw & hw) / max(1, len(lw | hw)) > 0.8:
                    out.append(f"warning: {name} aria-label just restates its screen heading; a figure should show something the prose cannot")
    if nums and nums != list(range(1, len(nums) + 1)):
        out.append(f"figure numbers run {', '.join(map(str, nums))}; they must be 1, 2, 3 in page order")
    # prose
    flat = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", "", rail + "\n" + gloss, flags=re.S)
    plain = re.sub(r"<[^>]+>", " ", flat)
    if "\u2014" in plain:
        out.append("em dash in the page text")
    for m in TEASER_RE.finditer(plain):
        out.append(f'transition points at the page ("{m.group(0)}"); name the concept that comes next instead')
    # glossary
    ids = re.findall(r'<article\b[^>]*\bid="([^"]+)"', gloss)
    links = {m for m in re.findall(r'<a\b[^>]*class="[^"]*\bgl\b[^"]*"[^>]*href="#([^"]+)"', rail)}
    for l in sorted(links - set(ids)):
        out.append(f"glossary link #{l} points to no entry")
    for e in ids:
        if e not in links:
            out.append(f"glossary entry #{e} is never linked from a screen")
    for m in re.finditer(r'<article\b[^>]*\bid="([^"]+)".*?</article>', gloss, flags=re.S):
        sh = re.search(r'<p class="short">(.*?)</p>', m.group(0), flags=re.S)
        if sh and len(re.sub(r"<[^>]+>", "", sh.group(1)).split()) > SHORT_WORDS_MAX:
            out.append(f"glossary entry #{m.group(1)}: .short is over {SHORT_WORDS_MAX} words")
    return out


def lint_essay(md):
    """Failures in an essay: the existing prose rules plus the equation pattern."""
    out = list(essay_warnings(md))
    prose = re.sub(r"```.*?```", "", md, flags=re.S)
    prose = re.sub(r"\A---\r?\n.*?\r?\n---\r?\n", "", prose, flags=re.S)
    for m in re.finditer(r"\$\$(.+?)\$\$", prose, flags=re.S):
        after = prose[m.end():].lstrip("\n").splitlines()
        rest = "\n".join(after)
        tex = m.group(1).strip()
        if not re.match(r"\s*Where:\s*\n\s*\n?(?:\s*[-*\d][^\n]*\n?)+\s*\n?\s*\(Source:", rest + "\n"):
            out.append(f"display equation $${tex[:30]}$$ needs a line \"Where:\", a bullet per symbol, then \"(Source: ...)\"")
    for m in re.finditer(r"(?<![\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)", re.sub(r"\$\$.+?\$\$", "", prose, flags=re.S)):
        why = inline_tex_problem(m.group(1))
        if why:
            out.append(f"inline equation ${m.group(1)[:40]}$ {why}; make it a $$ block with Where: and a source")
    return out


def lint_failures(items):
    return [x for x in items if not x.startswith("warning:")]


def lint_file(path):
    """Lint one explainer fragment or essay by file name; None for any other file."""
    p = Path(path)
    if p.name.endswith("-explainer.html"):
        text = p.read_text(encoding="utf-8")
        return lint_fragment(text) if "<!--@rail-->" in text else []
    if p.name.endswith("-essay.md"):
        return lint_essay(p.read_text(encoding="utf-8"))
    return None


def in_writing(path):
    """A vault writing/**/*-explainer.html or *-essay.md file, or None."""
    p = Path(path)
    if not (p.name.endswith("-explainer.html") or p.name.endswith("-essay.md")):
        return None
    if not p.parent.exists():
        return None
    vault = find_vault(p.parent)
    if vault is None or "writing" not in p.resolve().relative_to(vault).parts[:1]:
        return None
    return vault


def cmd_hook_lint(a):
    """PostToolUse (stdin JSON) and Stop (--stop) hook. Exit 2 with failures on stderr blocks; anything odd exits 0."""
    try:
        data = json.loads(sys.stdin.read() or "{}")
        fails = []
        if a.stop:
            if data.get("stop_hook_active"):
                return 0
            vault = find_vault(data.get("cwd") or None)
            stamp = vault / "_meta" / ".session" if vault else None
            if not stamp or not stamp.exists():
                return 0
            since = float(stamp.read_text().strip())
            for f in sorted((vault / "writing").rglob("*")) if (vault / "writing").exists() else []:
                if f.is_file() and f.stat().st_mtime > since and lint_file(f) is not None:
                    fails += [f"{f.name}: {x}" for x in lint_failures(lint_file(f))]
        else:
            path = (data.get("tool_input") or {}).get("file_path")
            if not path or not in_writing(path):
                return 0
            fails = [f"{Path(path).name}: {x}" for x in lint_failures(lint_file(path) or [])]
        if fails:
            print("cognia lint failed. Fix these, then save again:\n- " + "\n- ".join(fails), file=sys.stderr)
            return 2
    except Exception:
        return 0
    return 0


def build_essay(vault, src, site):
    """Render writing/<topic>/<slug>/<slug>-essay.md to the site; returns (path, glossary size, missing, warnings)."""
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
    return out, len(data) - 1, missing, essay_warnings(md)


def cmd_essay(a):
    vault = Path(a.vault).expanduser().resolve()
    src = writing_dir(vault, a.slug) / f"{a.slug}-essay.md"
    if not src.exists():
        raise SystemExit(f"no essay yet: {src}")
    site = site_dir(vault, getattr(a, "site", None))
    refresh_assets(site)
    out, n, missing, warn = build_essay(vault, src, site)
    write_hub(vault, site)
    print(out)
    for w in warn:
        print(f"warning: {w}")
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
            out, _, _, warn = build_essay(vault, d, site)
            print(out)
            for w in warn:
                print(f"warning: {w}")
            n += 1
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
    if getattr(a, "session_start", False):  # the Stop hook lints only files changed after this moment
        try:
            (vault / "_meta").mkdir(exist_ok=True)
            (vault / "_meta" / ".session").write_text(str(time.time()), encoding="utf-8")
        except OSError:
            pass
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
    if entries:
        refresh_index(vault)
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
    site = site_dir(vault)
    if site.exists():  # built pages carry the old name: rebuild them under the new one
        for d in [d for d in site.rglob(a.old) if d.is_dir()]:
            shutil.rmtree(d)
        cmd_build(argparse.Namespace(vault=str(vault), slug=a.new, site=None))
    refresh_index(vault)
    print(f"renamed {a.old} -> {a.new} ({n} page(s) updated)")


# ---- index: the vault as a graph Claude can query instead of reading ---------------------

WIKILINK = re.compile(r"\[\[([^\]|#]+)")
INDEXED = ("wiki", "notes")
TOPICS_RE = re.compile(r"<!-- topics -->.*?<!-- /topics -->", re.S)


def wikilinks(text):
    return list(dict.fromkeys(m.strip() for m in WIKILINK.findall(text)))


def section_links(text, heading):
    m = re.search(rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    return wikilinks(m.group(1)) if m else []


def split_list(val):
    return [x.strip().strip("\"'") for x in re.split(r"\s*,\s*", val.strip("[]")) if x.strip()]


def parse_page(vault, p):
    """One index node for a markdown page."""
    fm, text = read_fm(p)
    h = re.search(r"^#\s+(.+)$", text, re.M)
    tags = fm_tags(text)
    topic = clean_topic(fm.get("topic") or fm.get("domain") or (tags[0] if tags else ""))
    return {
        "type": fm.get("type") or ("note" if p.relative_to(vault).parts[0] == "notes" else ""),
        "title": h.group(1).strip() if h else p.stem.replace("-", " "),
        "aliases": split_list(fm.get("aliases", "")),
        "gist": gist(text),
        "status": fm.get("status", ""), "box": fm.get("box", ""), "next": fm.get("next_review", ""),
        "topic": topic, "tags": [clean_topic(t) for t in tags],
        "kind": fm.get("kind", ""), "depth": fm.get("depth", ""),
        "requires": wikilinks(fm.get("requires", "")),
        "seen_in": section_links(text, "Seen in"),
        "connects": section_links(text, "Connects to"),
        "links": wikilinks(text),
    }


def index_path(vault):
    return vault / "_meta" / "index.json"


def load_index(vault):
    try:
        return json.loads(index_path(vault).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"pages": {}}


def vault_pages(vault):
    for base in INDEXED:
        root = vault / base
        for p in sorted(root.rglob("*.md")) if root.exists() else []:
            if "topics" not in p.relative_to(vault).parts[:2]:  # topic pages are generated from the index
                yield p


def update_index(vault):
    """Re-parse only pages whose mtime or size changed. Returns (index, changed paths, removed paths)."""
    idx, old, new, changed = load_index(vault), load_index(vault)["pages"], {}, []
    for p in vault_pages(vault):
        rel, st = p.relative_to(vault).as_posix(), p.stat()
        stamp = [st.st_mtime_ns, st.st_size]
        if rel in old and old[rel]["stamp"] == stamp:
            new[rel] = old[rel]
        else:
            new[rel] = {"stamp": stamp, "node": parse_page(vault, p)}
            changed.append(rel)
    removed = [r for r in old if r not in new]
    idx["pages"] = new
    return idx, changed, removed


def save_index(vault, idx):
    index_path(vault).parent.mkdir(parents=True, exist_ok=True)
    index_path(vault).write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def stems(idx):
    """name (normalised stem, title, alias) -> page path, for resolving [[links]] and lookups."""
    m = {}
    for rel, e in idx["pages"].items():
        n = e["node"]
        for name in [Path(rel).stem, n["title"], *n["aliases"]]:
            m.setdefault(norm(name), rel)
    return m


def incoming(idx):
    names, inc = stems(idx), {}
    for rel, e in idx["pages"].items():
        for t in e["node"]["links"]:
            tgt = names.get(norm(t))
            if tgt and tgt != rel:
                inc.setdefault(tgt, []).append(rel)
    return inc


def topic_set(vault, idx):
    """Every topic: from page fields, from where files sit, and every ancestor of those."""
    topics = {e["node"]["topic"] for e in idx["pages"].values() if e["node"]["topic"]}
    for base in ("library", "writing", "notes"):
        root = vault / base
        for d in ([root, *root.rglob("*")] if root.exists() else []):
            if d.is_dir() and d != root and any(f.is_file() for f in d.iterdir()):
                rel = d.relative_to(root) if base == "notes" else d.relative_to(root).parent  # library/writing: the slug folder sits inside its topic
                if rel.parts:
                    topics.add(rel.as_posix())
    out = set()
    for t in topics:
        parts = t.split("/")
        out.update("/".join(parts[:i + 1]) for i in range(len(parts)))
    return sorted(out)


def library_slugs(vault, topic):
    root = vault / "library" / topic
    return sorted(d.name for d in root.iterdir() if d.is_dir() and any(f.is_file() for f in d.iterdir())) if root.exists() else []


def build_topic_page(vault, idx, topic, topics):
    pages = idx["pages"]
    mine = lambda n: n["topic"] == topic
    sub = [t for t in topics if t.startswith(topic + "/") and "/" not in t[len(topic) + 1:]]
    L = ["---", "type: topic", f"topic: {topic}", "---", f"# {topic.split('/')[-1].replace('-', ' ').title()}", "",
         "> Built by vault.py index. Do not edit; changes are overwritten.", ""]
    if sub:
        L += ["## Subtopics"] + [f"- [[topics/{t}|{t.split('/')[-1]}]]" for t in sub] + [""]
    src = [(r, e["node"]) for r, e in pages.items() if e["node"]["type"] == "source" and mine(e["node"])]
    if src:
        L += ["## Sources"] + [f"- [[{Path(r).stem}]]" + (f": {n['gist']}" if n["gist"] else "") for r, n in sorted(src)] + [""]
    con = [(r, e["node"]) for r, e in pages.items() if e["node"]["type"] == "concept" and mine(e["node"])]
    if con:
        L += ["## Concepts"] + [f"- [[{Path(r).stem}]] ({n['status'] or 'new'})" for r, n in sorted(con)] + [""]
    notes = [r for r, e in pages.items() if e["node"]["type"] == "note" and mine(e["node"])]
    if notes:
        L += ["## Your notes"] + [f"- [[{Path(r).stem}]]" for r in sorted(notes)] + [""]
    w = vault / "writing" / topic
    wr = sorted(f for f in w.rglob("*") if f.is_file()) if w.exists() else []
    if wr:
        L += ["## Writing"] + [f"- {f.relative_to(vault).as_posix()}" for f in wr] + [""]
    todo = [s for s in library_slugs(vault, topic) if not (vault / "wiki" / "sources" / f"{s}.md").exists()]
    if todo:
        L += ["## Waiting to learn"] + [f"- library/{topic}/{s}/" for s in todo] + [""]
    return "\n".join(L).rstrip() + "\n"


def write_topics(vault, idx):
    topics = topic_set(vault, idx)
    root = vault / "wiki" / "topics"
    keep = set()
    for t in topics:
        out = root / f"{t}.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        page = build_topic_page(vault, idx, t, topics)
        if not out.exists() or out.read_text(encoding="utf-8") != page:
            out.write_text(page, encoding="utf-8")
        keep.add(out)
    for f in root.rglob("*.md") if root.exists() else []:
        if f not in keep:
            f.unlink()  # a topic page nobody needs any more; it is generated, so nothing is lost
    vm = vault / "VAULT.md"
    if vm.exists():
        text = vm.read_text(encoding="utf-8")
        tops = [t for t in topics if "/" not in t]
        body = "\n".join(f"- [[topics/{t}|{t}]]" for t in tops) or "(no topics yet)"
        block = f"<!-- topics -->\n## Topics\n{body}\n<!-- /topics -->"
        if TOPICS_RE.search(text):
            new = TOPICS_RE.sub(lambda m: block, text)
        elif re.search(r"^## Counts", text, re.M):
            new = re.sub(r"^## Counts", lambda m: block + "\n\n## Counts", text, count=1, flags=re.M)
        else:
            new = text.rstrip() + "\n\n" + block + "\n"
        kinds = {}
        for e in idx["pages"].values():
            kinds[e["node"]["type"]] = kinds.get(e["node"]["type"], 0) + 1
        new = re.sub(r"^concepts: .*$", f"concepts: {kinds.get('concept', 0)} · sources: {kinds.get('source', 0)} · references carded: {kinds.get('reference', 0)}", new, flags=re.M)
        if new != text:
            vm.write_text(new, encoding="utf-8")


def refresh_index(vault):
    idx, changed, removed = update_index(vault)
    save_index(vault, idx)
    write_topics(vault, idx)
    return idx, changed, removed


def cmd_index(a):
    vault = Path(a.vault).expanduser().resolve()
    idx, changed, removed = refresh_index(vault)
    if not a.quiet:
        print(f"index: {len(idx['pages'])} pages ({len(changed)} updated, {len(removed)} removed)")


def cmd_changed(a):
    """Pages edited since the last index (typically by you in Obsidian). Refreshes the index afterwards."""
    vault = Path(a.vault).expanduser().resolve()
    idx, changed, removed = refresh_index(vault)
    for r in changed:
        print(f"changed: {r}")
    for r in removed:
        print(f"removed: {r}")
    if not changed and not removed:
        print("nothing changed since the last index")


def card(idx, rel, names=None, inc=None):
    """The few lines that stand in for opening a page."""
    n = idx["pages"][rel]["node"]
    names, inc = names or stems(idx), inc or incoming(idx)
    status = lambda t: (lambda r: f"{t} ({idx['pages'][r]['node']['status'] or 'new'})" if r and idx['pages'][r]['node']['type'] == 'concept' else t)(names.get(norm(t)))
    cap = lambda xs: ", ".join(xs[:8]) + (f" (+{len(xs) - 8})" if len(xs) > 8 else "")
    head = f"{Path(rel).stem} · {n['type'] or 'page'} · {rel}"
    if n["type"] == "concept":
        head += f" · status={n['status']} box={n['box'] or 0}" + (f" next={n['next']}" if n["next"] else "")
    if n["type"] == "source":
        head += f" · kind={n['kind']} depth={n['depth']}"
    lines = [head]
    if n["topic"]:
        lines.append(f"topic: {n['topic']}")
    if n["gist"]:
        lines.append(f"gist: {n['gist']}")
    if n["requires"]:
        lines.append("requires: " + cap([status(t) for t in n["requires"]]))
    by = sorted({Path(r).stem for r in inc.get(rel, []) if idx["pages"][r]["node"]["requires"] and any(names.get(norm(t)) == rel for t in idx["pages"][r]["node"]["requires"])})
    if by:
        lines.append("required by: " + cap(by))
    if n["seen_in"]:
        lines.append("seen in: " + cap(n["seen_in"]))
    if n["connects"]:
        lines.append("connects to: " + cap(n["connects"]))
    if n["type"] == "source":
        used = [t for t in n["links"] if (names.get(norm(t)) or "").startswith("wiki/concepts/")]
        if used:
            lines.append("concepts: " + cap(used))
    return "\n".join(lines)


def cmd_about(a):
    vault = Path(a.vault).expanduser().resolve()
    idx = refresh_index(vault)[0]
    names, hit = stems(idx), None
    for term in a.terms:
        hit = names.get(norm(term)) or next((r for n, r in names.items() if norm(term) in n), None)
        print(card(idx, hit, names) if hit else f"{term}: no page (a gap, or not ingested yet)")


def cmd_where(a):
    vault = Path(a.vault).expanduser().resolve()
    idx = refresh_index(vault)[0]
    t, hits = norm(a.term), []
    for rel, e in idx["pages"].items():
        n = e["node"]
        if any(t in norm(x) for x in [Path(rel).stem, n["title"], *n["aliases"]]):
            hits.append(rel)
    for base in ("library", "writing"):
        root = vault / base
        hits += [f.relative_to(vault).as_posix() for f in sorted(root.rglob("*")) if f.is_file() and t in norm(f.name)] if root.exists() else []
    for r in hits[:12]:
        print(r)
    print(f"{len(hits)} match(es)" if hits else f"no match for '{a.term}'")


def topics_line(vault):
    root = [vault / b for b in ("library", "notes")]
    found = sorted({"/".join(d.relative_to(r).parts) for r in root if r.exists() for d in r.rglob("*")
                    if d.is_dir() and len(d.relative_to(r).parts) == 1})
    return ", ".join(found) or "(none yet)"


def cmd_context(a):
    """What a skill needs to start, printed by an inline command so Claude does not read files for it."""
    vault = find_vault()
    if vault is None:
        print("No cognia vault here (no VAULT.md in this folder or above). Ask where to create one, then run vault.py init <path>.")
        return 0
    import contextlib
    import io
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        cmd_tidy(argparse.Namespace(vault=str(vault), auto=True, quiet=True, dry_run=False, undo=False, tag=None, min_age=3.0))
    out = [f"Vault: {vault}"] + [x for x in buf.getvalue().splitlines() if x]
    idx, changed, removed = refresh_index(vault)
    skill, args = a.skill, a.args
    ns = argparse.Namespace(vault=str(vault), date=None, limit=6)
    cap = io.StringIO()
    with contextlib.redirect_stdout(cap):
        if skill == "resume":
            now = vault / "_meta" / "now.md"
            print(now.read_text(encoding="utf-8").strip() if now.exists() else "(no now.md yet)")
            cmd_stats(ns)
        elif skill == "review":
            cmd_due(ns)
        elif skill in ("essay", "explainer", "learn", "explain-back", "expand") and args:
            cmd_about(argparse.Namespace(vault=str(vault), terms=[args[0]]))
            slug = args[0]
            for d in slug_dirs(vault, "library", slug) + slug_dirs(vault, "writing", slug):
                print(f"files: {d.relative_to(vault).as_posix()}/ ({', '.join(sorted(f.name for f in d.iterdir()))})")
        else:
            print(f"topics: {topics_line(vault)}")
            if skill in ("plan", "ingest"):
                cmd_stats(ns)
    out += cap.getvalue().rstrip().splitlines()
    if changed:
        out.append("edited since last index: " + ", ".join(changed[:8]) + (f" (+{len(changed) - 8})" if len(changed) > 8 else ""))
    print("\n".join(out))
    return 0


# ---- migrate: older vaults (raw/, lessons/) to the library/writing/site layout -------------

def page_to_fragment(page):
    """Cut a built lesson page back into the regions of an explainer fragment."""
    def grab(pat):
        m = re.search(pat, page, re.S)
        return m.group(1).strip("\n") if m else ""
    title = grab(r"<title>(.*?)</title>")
    title = re.sub(r"\s*·\s*Cognia\s*$", "", html.unescape(title))
    source = html.unescape(grab(r'<body[^>]*data-source="([^"]*)"'))
    script = ""
    for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", page, re.S):
        script = m.group(1)  # the last inline script holds the figure calls
    script = re.sub(r"^[ \t]*const \{[^}]*\} = cognia;[ \t]*\n?", "", script, flags=re.M).strip("\n")
    parts = [("title", title), ("source", source), ("rail", grab(r'<div class="rail" id="rail">(.*?)</div></main>')),
             ("glossary", grab(r'<aside class="gloss"[^>]*>(.*?)</aside>')), ("help", grab(r'<aside class="help"[^>]*>(.*?)</aside>')),
             ("script", script)]
    return "".join(f"<!--@{k}{' ' + v.replace('-->', '') if k in ('title', 'source') else ''}-->\n" + ("" if k in ("title", "source") else v + "\n") for k, v in parts)


def migrate_plan(vault, topic_arg):
    """Everything migrate would do, as (kind, from, to) rows plus the text rewrites."""
    rows, texts = [], []
    sources = sorted(d.name for d in (vault / "raw").iterdir() if d.is_dir()) if (vault / "raw").exists() else []
    sources += [p.stem for p in (vault / "wiki" / "sources").glob("*.md") if p.stem not in sources] if (vault / "wiki" / "sources").exists() else []

    def topic_for(slug):
        if topic_arg:
            return clean_topic(topic_arg)
        pg = vault / "wiki" / "sources" / f"{slug}.md"
        if pg.exists() and read_fm(pg)[0].get("topic"):
            return clean_topic(read_fm(pg)[0]["topic"])
        votes = {}
        for c in concepts(vault):
            d = read_fm(c)[0].get("domain")
            if d and slug in c.read_text(encoding="utf-8"):
                votes[clean_topic(d)] = votes.get(clean_topic(d), 0) + 1
        return max(votes, key=votes.get) if votes else "general"

    topics = {s: topic_for(s) for s in sources}
    for slug in sources:
        raw = vault / "raw" / slug
        if not raw.exists():
            continue
        t = topics[slug]
        for f in sorted(raw.iterdir()):
            if not f.is_file():
                continue
            new = f"{slug}{f.suffix}" if f.stem == "original" else f"{slug}-{f.name}" if f.name in ("text.md", "worksheet.md") else f.name
            rows.append(("library", f.relative_to(vault).as_posix(), f"library/{t}/{slug}/{new}"))
            texts.append((f"raw/{slug}/{f.name}", f"library/{t}/{slug}/{new}"))
        texts.append((f"raw/{slug}/", f"library/{t}/{slug}/"))
    lessons = vault / "lessons"
    for d in sorted(lessons.iterdir()) if lessons.exists() else []:
        if not d.is_dir():
            continue
        if d.name == "_shell":
            rows.append(("discard", "lessons/_shell", "_meta/duplicates/migrated/_shell"))
            continue
        slug = max((s for s in sources if d.name == s or d.name.startswith(s + "-")), key=len, default=d.name)
        t, name = topics.get(slug, topic_arg or "general"), d.name
        for f in sorted(d.iterdir()):
            if f.name == "index.html":
                rows.append(("fragment", f"lessons/{name}/{f.name}", f"writing/{t}/{slug}/{name}-explainer.html"))
                texts.append((f"lessons/{name}/index.html", f"writing/{t}/{slug}/{name}-explainer.html"))
            elif f.name == "essay.md":
                rows.append(("writing", f"lessons/{name}/{f.name}", f"writing/{t}/{slug}/{name}-essay.md"))
                texts.append((f"lessons/{name}/essay.md", f"writing/{t}/{slug}/{name}-essay.md"))
            elif f.name == "essay.html":
                rows.append(("discard", f"lessons/{name}/{f.name}", f"_meta/duplicates/migrated/{name}/essay.html"))
                texts.append((f"lessons/{name}/essay.html", f"{vault.name}-site/{t}/{slug}/{name}-essay.html"))
            elif f.suffix == ".html":
                rows.append(("fragment", f"lessons/{name}/{f.name}", f"writing/{t}/{slug}/{slug}-{f.stem}-explainer.html"))
                texts.append((f"lessons/{name}/{f.name}", f"writing/{t}/{slug}/{slug}-{f.stem}-explainer.html"))
    return rows, texts, topics


def cmd_migrate(a):
    vault = Path(a.vault).expanduser().resolve()
    rows, texts, topics = migrate_plan(vault, a.topic)
    for kind, src, dst in rows:
        print(f"{kind:9} {src} -> {dst}")
    if not rows:
        print("nothing to migrate (no raw/ or lessons/ folders)")
        return 0
    print("topics: " + ", ".join(f"{s}={t}" for s, t in topics.items()))
    if not a.apply:
        print("dry run: nothing changed. Add --apply to migrate (a zip backup is made first).")
        return 0
    backup = vault.parent / f"{vault.name}-backup-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    shutil.make_archive(str(backup), "zip", root_dir=vault.parent, base_dir=vault.name)
    print(f"backup: {backup}.zip (to undo, delete the vault and unzip it)")
    for kind, src, dst in rows:
        s, d = vault / src, vault / dst
        d.parent.mkdir(parents=True, exist_ok=True)
        if kind == "fragment":
            d.write_text(page_to_fragment(s.read_text(encoding="utf-8")), encoding="utf-8")
            s.unlink()
        else:
            shutil.move(str(s), str(d))
    for base in ("raw", "lessons"):  # drop the emptied folders
        for d in sorted((vault / base).rglob("*"), reverse=True) if (vault / base).exists() else []:
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
        if (vault / base).exists() and not any((vault / base).iterdir()):
            (vault / base).rmdir()
    ordered = sorted(texts, key=lambda x: -len(x[0]))  # specific paths before their folder prefixes
    for sub in ("wiki", "writing", "notes", "_meta"):
        root = vault / sub
        for md in root.rglob("*.md") if root.exists() else []:
            if md.name == "log.md" or md.name == "moves.log":
                continue
            text = md.read_text(encoding="utf-8")
            new = text
            for old, to in ordered:
                new = new.replace(old, to)
            if new != text:
                md.write_text(new, encoding="utf-8")
    for slug, t in topics.items():  # source pages: library/writing/topic fields
        pg = vault / "wiki" / "sources" / f"{slug}.md"
        if not pg.exists():
            continue
        text = pg.read_text(encoding="utf-8")
        m = FM_RE.match(text)
        if not m:
            continue
        keep, writing = [], ""
        for line in m.group(1).splitlines():
            km = re.match(r"^(raw|lesson|essay|library|writing|topic|tags):", line)
            if not km:
                keep.append(line)
            elif km.group(1) == "raw":
                keep.append("library: " + line.split(":", 1)[1].strip())
            elif km.group(1) in ("lesson", "essay") and not writing:
                writing = f"writing/{t}/{slug}/"
            elif km.group(1) in ("library", "topic", "tags"):
                keep.append(line)
        if not any(x.startswith("topic:") for x in keep):
            keep.append(f"topic: {t}")
        if not any(x.startswith("tags:") for x in keep):
            keep.append("tags: []")
        if writing:
            keep.append(f"writing: {writing}")
        pg.write_text("---\n" + "\n".join(keep) + "\n---\n" + text[m.end():], encoding="utf-8")
    site = site_dir(vault)
    refresh_assets(site)
    for frag in (vault / "writing").rglob("*-explainer.html") if (vault / "writing").exists() else []:
        build_explainer(vault, frag, site)
    for md in (vault / "writing").rglob("*-essay.md") if (vault / "writing").exists() else []:
        build_essay(vault, md, site)
    write_hub(vault, site)
    log(vault, f"{dt.date.today().isoformat()} · migrate · {len(rows)} item(s) to library/ writing/ and {site.name}/")
    cmd_tidy(argparse.Namespace(vault=str(vault), auto=False, quiet=False, dry_run=False, undo=False, tag=None, min_age=3.0))
    refresh_index(vault)
    print(f"migrated {len(rows)} item(s). Pages are built in {site}")
    return 0


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
    text = page.read_text(encoding="utf-8")
    items = lint_essay(text) if page.suffix == ".md" else lint_fragment(text) if "<!--@rail-->" in text else []
    for w in items:
        print(w)
    static = lint_failures(items)
    if a.static or page.suffix == ".md":
        print("OK" if not static else f"{len(static)} problem(s)")
        return 1 if static else 0
    if "<!--@rail-->" in text:  # a fragment: build it, then check the built page
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
    problems = static + res["problems"]
    for p in res["problems"]:
        print(p)
    print("OK" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("init"); s.add_argument("vault"); s.set_defaults(fn=cmd_init)
    s = sub.add_parser("tidy"); s.add_argument("vault", nargs="?"); s.add_argument("--auto", action="store_true"); s.add_argument("--quiet", action="store_true"); s.add_argument("--dry-run", action="store_true"); s.add_argument("--undo", action="store_true"); s.add_argument("--tag", action="append"); s.add_argument("--min-age", type=float, default=3.0); s.add_argument("--session-start", action="store_true"); s.set_defaults(fn=cmd_tidy)
    s = sub.add_parser("rename"); s.add_argument("vault"); s.add_argument("old"); s.add_argument("new"); s.set_defaults(fn=cmd_rename)
    s = sub.add_parser("index"); s.add_argument("vault"); s.add_argument("--quiet", action="store_true"); s.set_defaults(fn=cmd_index)
    s = sub.add_parser("about"); s.add_argument("vault"); s.add_argument("terms", nargs="+"); s.set_defaults(fn=cmd_about)
    s = sub.add_parser("where"); s.add_argument("vault"); s.add_argument("term"); s.set_defaults(fn=cmd_where)
    s = sub.add_parser("changed"); s.add_argument("vault"); s.set_defaults(fn=cmd_changed)
    s = sub.add_parser("context"); s.add_argument("skill"); s.add_argument("args", nargs="*"); s.set_defaults(fn=cmd_context)
    s = sub.add_parser("migrate"); s.add_argument("vault"); s.add_argument("--apply", action="store_true"); s.add_argument("--topic"); s.set_defaults(fn=cmd_migrate)
    s = sub.add_parser("find"); s.add_argument("vault"); s.add_argument("terms", nargs="+"); s.set_defaults(fn=cmd_find)
    s = sub.add_parser("due"); s.add_argument("vault"); s.add_argument("--date"); s.add_argument("--limit", type=int, default=6); s.set_defaults(fn=cmd_due)
    s = sub.add_parser("record"); s.add_argument("vault"); s.add_argument("slug"); s.add_argument("grade", choices=GRADE_STEP); s.add_argument("--date"); s.set_defaults(fn=cmd_record)
    s = sub.add_parser("stats"); s.add_argument("vault"); s.add_argument("--date"); s.set_defaults(fn=cmd_stats)
    s = sub.add_parser("lesson"); s.add_argument("vault"); s.add_argument("slug"); s.add_argument("--concept"); s.add_argument("--title"); s.add_argument("--source"); s.add_argument("--topic"); s.set_defaults(fn=cmd_lesson)
    s = sub.add_parser("build"); s.add_argument("vault"); s.add_argument("slug", nargs="?"); s.add_argument("--site"); s.set_defaults(fn=cmd_build)
    s = sub.add_parser("essay"); s.add_argument("vault"); s.add_argument("slug"); s.add_argument("--site"); s.set_defaults(fn=cmd_essay)
    s = sub.add_parser("hook-lint"); s.add_argument("--stop", action="store_true"); s.set_defaults(fn=cmd_hook_lint)
    s = sub.add_parser("check"); s.add_argument("page"); s.add_argument("--static", action="store_true"); s.set_defaults(fn=cmd_check)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
