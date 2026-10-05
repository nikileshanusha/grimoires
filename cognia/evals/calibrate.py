"""Measure how many words of prose fit one screen at 1366x768 (figure screen and solo screen).
Run: python evals/calibrate.py   Prints the largest word count with no overflow for each kind."""
import re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VAULT_PY = ROOT / "core" / "vault.py"
WORD = "plain words keep the sentence short and clear for a reader ".split()
COUNTS = list(range(100, 520, 30))


def prose(n):
    ws = (WORD * (n // len(WORD) + 1))[:n]
    paras = [" ".join(ws[i:i + 55]) + "." for i in range(0, n, 55)]
    return "".join(f"<p>{p}</p>" for p in paras)


def screen(n, fig):
    figure = '<div class="fig"><figure><svg viewBox="0 0 400 300" role="img" aria-label="x"><rect width="400" height="300" class="card"/><text x="20" y="40">label</text></svg><figcaption><b>Figure 1.</b> x <b>What to notice:</b> y <small>Source: z.</small></figcaption></figure></div>' if fig else ""
    return (f'<section class="screen" data-title="{"fig" if fig else "solo"} {n}"><div class="text"><div class="kicker">Finding 1 of 1</div>'
            f'<h2>A short claim that sets the point.</h2><div class="prose">{prose(n)}</div></div>{figure}</section>')


def main():
    with tempfile.TemporaryDirectory() as d:
        v = Path(d) / "v"
        subprocess.run([sys.executable, str(VAULT_PY), "init", str(v)], check=True, capture_output=True)
        f = v / "writing" / "t" / "t" / "t-explainer.html"
        f.parent.mkdir(parents=True)
        start = '<section class="screen" data-title="s"><div class="text"><div class="kicker"><b>Start</b></div><h1>t</h1><div class="prose"><p>x</p></div></div></section>'
        rail = start + "".join(screen(n, True) for n in COUNTS) + "".join(screen(n, False) for n in COUNTS)
        f.write_text(f"<!--@title t-->\n<!--@source t-->\n<!--@rail-->\n{rail}\n<!--@glossary-->\n<!--@help-->\n<!--@script-->\n", encoding="utf-8")
        out = subprocess.run([sys.executable, str(VAULT_PY), "check", str(f)], capture_output=True, text=True, encoding="utf-8").stdout

    bad = {}
    if "--debug" in sys.argv:
        print(chr(10).join(l for l in out.splitlines() if "kicker" not in l and "sofar" not in l))
    for m in re.finditer(r"\((fig|solo) (\d+)\): text column overflows by (\d+)px", out):
        if int(m.group(3)) > 2: bad.setdefault(m.group(1), set()).add(int(m.group(2)))
    for kind in ("fig", "solo"):
        fit = [n for n in COUNTS if n not in bad.get(kind, set())]
        print(kind, "largest fitting word count:", max(fit) if fit else None)


if __name__ == "__main__":
    main()
