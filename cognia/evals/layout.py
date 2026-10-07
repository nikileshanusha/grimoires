"""Layout test for the explainer shell: no page should ever overflow, whatever its content.

Builds a stress page (a 600-word screen, a very wide equation with a long symbol list, a figure with a
gate, three sliders and a long caption, a declared diagram with long labels, a hand-drawn diagram with
labels too long for their cards, bars) plus the Saez example, and runs the shell's layout probes
(#check-layout) at several window sizes and text sizes. Any "layout:" line is a bug in the shell
(core/engine/assets), never in a page. Run it after changing cognia.js or cognia.css.

Run: python evals/layout.py [--shots DIR]   (--shots also saves a screenshot of each stress screen at 1366x768)
"""
import json, os, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VAULT_PY = ROOT / "core" / "vault.py"
EXAMPLE = ROOT / "core" / "engine" / "examples" / "saez-2001-explainer.html"
SIZES = ["1366x768", "1024x640", "1920x1080", "390x844"]
FONT_SIZES = [13, 15, 18]

WORDS = ("the top rate taxes only the slice of income above the line so a fatter tail means more income sits "
         "in that slice and the mechanical gain grows while the behavioural loss depends on how much reported "
         "income shrinks when the take-home share falls ").split()


def prose(n):
    ws = (WORDS * (n // len(WORDS) + 1))[:n]
    return "".join(f"<p>{' '.join(ws[i:i + 70])}.</p>" for i in range(0, n, 70))


STRESS = f"""<!--@title Stress 2026-->
<!--@source A page built to overflow: long prose, wide equations, crowded figures.-->
<!--@rail-->
<section class="screen" data-title="Start" data-min="1"><div class="text">
  <div class="kicker"><b>Start</b></div><h1>Every screen fits, whatever is on it.</h1>
  <div class="prose">{prose(90)}</div></div>
  <div class="fig"><figure>
    <div class="diagram" data-flow="right" aria-label="A chain of eight ideas">
      <div class="node" id="n1"><b>\\(a\\)</b> The Pareto tail of the income distribution above the line</div>
      <div class="node" id="n2"><b>\\(\\bar g\\)</b> Social weight on top earners' marginal consumption</div>
      <div class="node" id="n3"><b>\\(e\\)</b> Elasticity of taxable income with respect to the net-of-tax rate</div>
      <div class="node" id="n4">Income above the line, the slice the rate actually taxes</div>
      <div class="node loss" id="n5">Behavioural loss: less reported income to tax</div>
      <div class="node" id="n6">Mechanical gain: more tax on the same income</div>
      <div class="node ref" id="n7">Welfare loss to top earners, weighted</div>
      <div class="node acc" id="n8"><b>\\(\\tau^*\\)</b> The revenue-maximising top marginal rate</div>
      <span class="edge" data-from="n1" data-to="n4">sets the size of</span>
      <span class="edge" data-from="n4" data-to="n6">sizes</span>
      <span class="edge" data-from="n3" data-to="n5">sizes</span>
      <span class="edge" data-from="n2" data-to="n7">discounts</span>
      <span class="edge acc" data-from="n6" data-to="n8">raises</span>
      <span class="edge" data-from="n5" data-to="n8">lowers</span>
      <span class="edge" data-from="n7" data-to="n8">lowers</span>
      <span class="edge" data-from="n8" data-to="n4">feeds back into</span>
    </div>
    <figcaption><b>Figure 1.</b> Eight ideas in a chain. <b>What to notice:</b> the arrows. <small>Source: illustration.</small></figcaption>
  </figure></div>
</section>
<section class="screen" data-title="Long" data-min="4"><div class="text">
  <div class="kicker"><b>Finding 1 of 3</b> · too much text</div>
  <h2>A screen with six hundred words still fits, because the shell pages it instead of overflowing.</h2>
  <div class="prose">{prose(600)}</div>
  <div class="evidence" data-src="Stress 2026, p. 1"><p class="design">What was compared, at some length, to make the block tall enough to matter.</p><p class="result">What it showed, about 29% more missing, with a long tail of qualifications.</p><p class="strength">How well it holds, and what else moves it, in a sentence that runs on.</p></div>
  <div class="note"><b>Illustration.</b> A note that can be moved under the figure or folded away. {prose(40)}</div>
</div>
<div class="fig">
  <div class="gate" data-answer="less" data-unlocks="#s1 #s2 #s3"><p>Predict first: if \\(e\\) doubles, the best rate…</p>
    <div class="opts"><button class="btn" data-choice="half" data-why="Not quite.">halves</button><button class="btn" data-choice="less" data-why="Right.">falls, but by less than half</button></div>
    <div class="verdict" hidden></div></div>
  <figure>
    <svg id="figS" role="img" aria-label="A plot with three sliders"></svg>
    <div class="controls">
      <div class="readout"><small>tax lost</small><span id="sOut"></span></div>
      <label for="s1"><span>elasticity <span class="sym">e</span></span><b id="s1v"></b><input type="range" id="s1" min="0" max="1.5" step="0.05" value="0.25" disabled></label>
      <label for="s2"><span>tail <span class="sym">a</span></span><b id="s2v"></b><input type="range" id="s2" min="1.2" max="3" step="0.1" value="1.5" disabled></label>
      <label for="s3"><span>weight <span class="sym">g</span></span><b id="s3v"></b><input type="range" id="s3" min="0" max="1" step="0.05" value="0" disabled></label>
    </div>
    <figcaption><b>Figure 2.</b> The curve moves with all three sliders. <b>What to notice:</b> {prose(80)} <small>Source: illustration with chosen values, not from the paper.</small></figcaption>
  </figure>
</div></section>
<section class="screen" data-title="Wide" data-min="3"><div class="text">
  <div class="kicker"><b>Finding 2 of 3</b> · a wide equation</div>
  <h2>A long equation shrinks to its column.</h2>
  <div class="prose"><p>{' '.join(WORDS[:40])}.</p></div>
  <div class="equation" data-src="eq. 9, p. 14"><p class="eq">\\[ \\tau^* = \\frac{{1 - \\bar g}}{{1 - \\bar g + a\\,e}} + \\frac{{\\partial \\mathrm{{revenue}}_{{top}}}}{{\\partial \\tau}} \\cdot \\frac{{z_m - \\bar z}}{{z_m}} + \\sum_{{i=1}}^{{N}} \\omega_i\\,\\frac{{dz_i}}{{d(1-\\tau)}}\\,\\frac{{1-\\tau}}{{z_i}} - \\lambda\\,\\mathrm{{deadweight}}_{{loss}} \\]</p>
    <dl class="where"><dt>\\(\\tau^*\\)</dt><dd>best top rate</dd><dt>\\(\\bar g\\)</dt><dd>social weight</dd><dt>\\(a\\)</dt><dd>Pareto tail</dd><dt>\\(e\\)</dt><dd>elasticity</dd>
    <dt>\\(z_m\\)</dt><dd>mean top income</dd><dt>\\(\\bar z\\)</dt><dd>the line</dd><dt>\\(\\omega_i\\)</dt><dd>weights</dd><dt>\\(\\lambda\\)</dt><dd>shadow cost</dd></dl></div>
  <div class="prose">{prose(200)}</div>
</div></section>
<section class="screen" data-title="Drawn" data-min="2"><div class="text">
  <div class="kicker"><b>Finding 3 of 3</b> · a hand-drawn figure</div>
  <h2>Labels too long for their cards wrap, and colliding labels move apart.</h2>
  <div class="prose">{prose(120)}</div>
</div><div class="fig"><figure>
  <svg viewBox="0 0 800 500" role="img" aria-label="Cards with long labels">
    <g class="node"><rect x="20" y="40" width="150" height="60" rx="10" class="card"/><text x="95" y="74" text-anchor="middle" class="tb">Income above the line that the rate taxes</text></g>
    <g class="node"><rect x="320" y="40" width="120" height="50" rx="10" class="card-acc"/><text x="380" y="70" text-anchor="middle" class="t">The best top rate in the model</text></g>
    <text x="400" y="300" class="ts">a free label in the middle</text>
    <text x="410" y="304" class="ts">another label on top of it</text>
    <text x="700" y="490" class="t">a label that runs off the edge of the drawing</text>
  </svg>
  <figcaption><b>Figure 3.</b> Cards. <b>What to notice:</b> the labels. <small>Source: illustration.</small></figcaption>
</figure></div></section>
<section class="screen" data-title="Bars" data-min="1"><div class="text">
  <div class="kicker"><b>Check</b></div><h2>Bars come from data.</h2><div class="prose"><p>{' '.join(WORDS[:30])}.</p></div>
</div><div class="fig"><figure>
  <svg id="figB" role="img" aria-label="Bars"></svg>
  <figcaption><b>Figure 4.</b> Rates by bracket. <b>What to notice:</b> the last bar. <small>Source: illustration.</small></figcaption>
</figure></div></section>
<!--@glossary-->
<!--@help-->
<!--@script-->
fig("#figS", (svg, w, h) => {{
  const e = +$("#s1").value, a = +$("#s2").value, g = +$("#s3").value;
  $("#s1v").textContent = e.toFixed(2); $("#s2v").textContent = a.toFixed(1); $("#s3v").textContent = g.toFixed(2);
  const t = (1 - g) / (1 - g + a * e); $("#sOut").textContent = Math.round(t * 100) + "%";
  const p = plot(w, h, {{ x: [0, 1.5], y: [0, 1], xTitle: "Elasticity e", yTitle: "Best top rate" }});
  svg.innerHTML = p.axes + `<path class="acc-line" d="${{curve(x => (1 - g) / (1 - g + a * x), 0.01, 1.5, 80, p.X, p.Y)}}"/>` +
    label(p.X(e), p.Y(t) - 10, "the best rate at this elasticity, read off the curve", {{ maxWidth: 140, anchor: "middle", bg: true }}) +
    label(p.X(e) + 6, p.Y(t) - 6, "a second label placed on top of the first one", {{ bg: true }});
}}, ["#s1", "#s2", "#s3"]);
fig("#figB", (svg, w, h) => {{
  svg.innerHTML = bars(w, h, {{ cats: ["10", "12", "22", "24", "32", "35", "37"], values: [10, 12, 22, 24, 32, 35, 37], y: [0, 40], xTitle: "Bracket (%)", yTitle: "Marginal rate (%)", acc: [6] }}).svg;
}});
"""


def run(page, size, fs):
    out = subprocess.run([sys.executable, str(VAULT_PY), "check", str(page), "--layout", "--json", "--size", size, "--fs", str(fs)],
                         capture_output=True, text=True, encoding="utf-8")
    line = next((l for l in reversed(out.stdout.splitlines()) if l.startswith("{")), None)
    if not line:
        raise SystemExit(f"check did not report for {page.name} at {size}: {out.stdout[-400:]} {out.stderr[-400:]}")
    return json.loads(line)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    shots = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
    with tempfile.TemporaryDirectory() as d:
        v = Path(d) / "v"
        subprocess.run([sys.executable, str(VAULT_PY), "init", str(v)], check=True, capture_output=True)
        w = v / "writing" / "t" / "stress"
        w.mkdir(parents=True)
        stress = w / "stress-explainer.html"
        stress.write_text(STRESS, encoding="utf-8")
        example = w / EXAMPLE.name
        example.write_text(EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
        bad = 0
        for page in (stress, example):
            for size in SIZES:
                for fs in FONT_SIZES:
                    res = run(page, size, fs)
                    lay = [p for p in res["problems"] if p.startswith("layout:")]
                    bad += len(lay)
                    print(f"{page.stem:24} {size:>9} fs={fs:<3} pages={res['pages']} {'OK' if not lay else str(len(lay)) + ' problem(s)'}")
                    for p in lay:
                        print("   ", p)
        if shots:
            sys.path.insert(0, str(ROOT / "core"))
            import vault
            Path(shots).mkdir(parents=True, exist_ok=True)
            built = Path(d) / "v-site" / "t" / "stress" / "stress-explainer.html"
            for i in range(5):
                for fs in (13, 18):
                    with tempfile.TemporaryDirectory() as prof:
                        subprocess.run([vault.find_browser(), "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={prof}",
                                        "--window-size=1366,768", "--virtual-time-budget=8000", f"--screenshot={Path(shots).resolve() / f'stress-{i}-fs{fs}.png'}",
                                        built.as_uri() + f"#{i}&fs={fs}"], capture_output=True, timeout=120)
            print("screenshots in", shots)
    print("OK" if not bad else f"{bad} layout problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
