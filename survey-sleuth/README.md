# Survey Sleuth

A skill that audits survey instruments (Word, XLSForm, PDF, pasted text) for measurement error and instrument-integrity problems before they go to the field. It behaves as a checker, not a co-author: it flags issues against explicit criteria and leaves every substantive call to the researcher.

---

## 1. Role and philosophy

Survey Sleuth acts as a survey methodology auditor. It surfaces problems in strict priority order:

1. **Measurement validity** — does the question actually operationalize the construct it claims to measure?
2. **Measurement error** — could the response process systematically distort the answer (leading wording, anchoring, priming, unrealistic recall demands)?
3. **Instrument integrity** — does the form correctly control who is asked what, under what conditions, with valid skip logic and schema?
4. **Instrument improvements** — clarity and leanness fixes with no substantive measurement concern attached.

Measurement findings are always reviewed ahead of instrument findings. A skip-logic or schema defect is filed under instrument integrity unless it changes the construct measured, the population that receives the question, the response task, or the resulting data, in which case both the defect and its measurement consequence are reported.

Core rules it follows throughout:

- Flags issues only against an explicit written criterion. It never silently rewrites meaning.
- Applies only intent-independent structural fixes, always logged, always confirmable, never applied silently.
- Every flag traces to exactly one written criterion clause.
- Severity (potential consequence) and confidence (strength of evidence) are tracked separately. When unsure which confidence level applies, it picks the lower one.
- The researcher makes the final substantive call, always.
- Mechanically-easy-to-detect defects are not allowed to crowd out harder-to-spot but more consequential measurement risks.
- For measurement_validity and measurement_error findings specifically, there's a deliberate cost asymmetry: a false positive costs a researcher a few seconds of dismissal, while a false negative ships a biased item to every respondent and contaminates the dataset permanently. So when genuinely uncertain, it flags at LOW severity and "possible" confidence rather than staying silent. This does not apply to instrument_integrity or instrument_improvement findings, where a more conservative default holds.
- For every measurement finding, it explains the likely error mechanism before proposing a remedy.
- Suggested wording is always a draft, never an assumed redefinition of the construct.

### Finding domains

Every finding belongs to exactly one primary domain:

- `MEASUREMENT_VALIDITY`
- `MEASUREMENT_ERROR`
- `INSTRUMENT_INTEGRITY`
- `INSTRUMENT_IMPROVEMENT`
- `MISC_MEASUREMENT_RISK` — a genuine-seeming measurement risk that doesn't fit any named check. Always low confidence unless evidence is strong.

An instrument-integrity finding may additionally carry a `measurement_consequence` flag.

### Severity scales

Measurement severity and instrument severity are on separate scales and are never compared directly. Measurement findings are reviewed first regardless of severity level.

**Measurement severity:** CRITICAL (strong risk of materially invalid measurement), HIGH (substantial, plausible systematic distortion), MEDIUM (meaningful but narrower or less certain distortion), LOW (minor measurement-quality concern).

**Instrument severity:** HIGH (corrupts data collection, routing, or interpretation), MEDIUM (materially reduces robustness or efficiency), LOW (operational polish).

---

## 2. Inputs

The skill runs on four independent input slots. Any of them may be empty; the skill degrades gracefully and says explicitly what's missing rather than failing.

### Slot A: Reference folder

A directory pointed to at session start, structured as:

```
references/
├── instruments/   prior questionnaires from the same or similar studies
├── conventions/    org standards: ceilings, scales, naming rules
├── codebooks/      variable definitions and value ranges used before
└── methods/        methodology notes, checklists, style guides
```

On load, it prints an inventory of what was found per subfolder, parses a conventions file if present and loads it as defaults, and indexes prior instruments to extract variable names and observed value ranges where parseable. If no folder is supplied, it proceeds on built-in defaults and says so explicitly, noting that plausibility checks will rely on general knowledge only.

### Slot B: Study context block

A one-time-per-study block the user fills in (and can save into the references folder):

```yaml
study_name:
research_objective:
population:
region_setting:
language_of_administration:
literacy_level: low | medium | high
translation_planned: yes | no
mode: face-to-face | phone | self-administered
sensitive_topics_expected: []
intentional_primes: []
known_exemptions: []
```

Defaults if left unanswered are literacy=medium, primes=none, exemptions=none. This context feeds directly into the sensitive-topic-placement check, the jargon-strictness check, recall norms by population, and exemption handling.

### Slot C: Questionnaire input

Word (.docx) is the primary path. XLSForm (.xlsx), PDF, and pasted text are also accepted, though XLSForm supports the fullest audit (see the parsing section below).

### Slot D: Custom instructions

Free-text overrides supplied at session start or mid-session. Precedence, lowest to highest: built-in criteria, then references/conventions, then study context, then custom instructions.

One exception: custom instructions cannot suppress a HIGH-severity structural error (broken skip logic, orphaned questions, malformed expressions). If a custom instruction conflicts with a HIGH finding, the instruction is still applied but the conflict is reported explicitly. Custom instructions are logged verbatim in the report header so audits stay reproducible.

---

## 3. Output

The output is a compact, structured result, not a long default wall of text. The preferred artifact is a lightweight interactive HTML review workspace, presented as a layer over the structured findings rather than the audit itself.

### What each finding contains

Every finding is a structured record with a domain, issue type, severity, confidence, the specific criterion it violates, the reasoning mechanism, supporting evidence, and a suggested remedy. It also carries a reasoning trace with four fixed fields: what was checked, the comparison set used, why it fired, and the source of the check (references folder, study context, built-in default, or general reasoning). This trace is mandatory on every finding, whether it came from a structural check, a constraint inference, or a judgment call, so the same transparency is available regardless of which phase produced it.

### Review flow order

1. Measurement validity findings
2. Measurement-error findings
3. Instrument-integrity findings
4. Instrument-improvement findings
5. Needs researcher input

The workspace supports filtering by domain, severity, confidence, and issue type; previous and next navigation; accept, edit, reject, or needs-input decisions; and shows surrounding questionnaire context for whichever item is active. The researcher's decision state is stored separately from the original audit finding, so the audit itself never needs to be regenerated after a decision is made.

### Default rendered view

The default view shows counts and the review queue, not exhaustive reasoning up front. Any finding can be expanded to show its criterion, mechanism, evidence, suggested remedy, methodology reference, and relevant surrounding questions. CSV and XLSForm exports remain optional add-ons; Markdown is a fallback interchange format, never the primary review surface.

---

## 4. How a run actually works

### Phase 0: Load and inventory

The skill detects or collects Slots A through D, prints a slot status table (references found, context loaded, questionnaire ingested with a question count, custom instructions noted), ingests the questionnaire per the parsing rules, and prints an inventory of question count, section count, option-set count, and skip-condition count before confirming scope with the user.

### Phase 1A: Structural checks (deterministic, XLSForm only)

These are hard rules with no discretion involved, generally HIGH severity:

- **Skip-logic integrity** — a follow-up that references a specific prior answer but has no relevant condition; a condition referencing a variable never defined upstream or one asked later in the form; a branch condition that can never be true given the upstream answer options.
- **Schema defects** — duplicate question names get auto-fixed by renaming with a logged change; a choice list referenced but never defined gets flagged (never invented); orphaned unreachable questions; malformed expressions like unbalanced parentheses.
- **Filter-question consistency** (partial support outside XLSForm) — a screening question whose stated options make a later unconditional follow-up nonsensical for some respondents gets flagged as possible missing skip logic.

### Phase 1B: Constraint plausibility checker

This replaces any fixed ceiling table and runs on every numeric question, in two steps. First, semantic classification: the skill infers what the variable measures from the stem wording (age, count, money, weight, duration, area, percentage, score, ID, and so on) and states the classification explicitly. Second, range inference, checked in priority order: references-folder evidence first (with the source cited), then a conventions-file default, then domain reasoning from semantics (a percentage bounded 0 to 100, a rural household head's age bounded roughly 15 to 100, a plot size in hectares flagged above 100), and only as a last resort a proposed lower bound alone with the upper bound marked as needing researcher input.

Findings are then tiered: a missing constraint with a confident range gets auto-fixed with the rationale logged; a present-but-implausible constraint (age under 200, negative income allowed) gets a proposed replacement shown as a diff for the researcher to confirm.

### Phase 2: Judgment checks

A named checklist of qualitative checks, each with an explicit criterion, a fix pattern, and, where relevant, non-violation lookalikes so it doesn't over-flag compliant items that merely contain trigger words. Checks include, among others:

- **Jargon and literacy mismatch** — technical or bureaucratic terms unlikely to be understood by the target population, flagged only when a low-literacy context has been confirmed. Fix pattern is a plain-language substitution, retaining the formal term in enumerator guidance where useful.
- **Redundancy** — two questions capturing the same construct with the same recall period and unit of analysis, compared across all question pairs.
- **Order effects and priming** — an earlier question that plausibly shifts a later answer, such as general satisfaction asked before specific trust items.
- **Missing or inconsistent non-response coding** — a question where "don't know" or "refused" is plausible but has no non-response path, or the instrument uses inconsistent sentinel codes across questions. This is always shown as a diff for confirmation, never silently auto-fixed, because it touches every downstream analysis script keyed to those values.
- **Undefined term or construct** — a central term (household member, employment, disability, regular work, and so on) that respondents or enumerators could reasonably define differently, with no definition given anywhere in the instrument.
- **Response-option completeness** — for closed-category questions, the skill builds a reference set first (from a codebook, a conventions default, or a built-in standard list for common demographic categories) before ever looking at the form's own options, then diffs the two. This exists specifically to avoid the common failure mode of catching one missing category while missing an equally real one nearby, since that happens whenever completeness is judged from memory instead of against a fixed list. It also checks for an "other, specify" catch-all.

Full worked exemplars, severity-calibration pairs, and disconfirmation examples for every check live in a separate examples reference file, loaded during this phase rather than held in context for the whole session.

### Phase 3: Disconfirmation pass

The skill is explicitly designed around a limitation: within a single session there's no such thing as genuinely fresh evaluation context, since the candidate flag and its original reasoning are still sitting in the transcript. Asking the same context to disprove its own just-generated conclusion tends to either rubber-stamp it or perform disproof without real independence.

So for every HIGH or CRITICAL candidate, it issues a genuinely separate evaluation: a fresh prompt containing only the question stem, response options, the cited criterion, and directly relevant surrounding context, with no reference to the candidate flag or the fact that it was flagged. If that independent judgment disagrees or surfaces a disconfirming reason, the flag is downgraded or discarded. For MEDIUM and LOW candidates, a cheaper in-context disconfirmation attempt is used instead, since the cost of a rubber-stamped false negative is smaller there; a "survival" through this pass is treated as weaker evidence than a genuinely independent agreement.

Nothing is discarded silently. Every discarded or downgraded candidate goes into a collapsed appendix with its disconfirming reason attached, and the overall discard rate for the session is surfaced so a researcher can sanity-check whether the tool is being too trigger-happy about killing its own flags.

### Phase 3.5: Gap-hunting pass

Phase 3 only tries to kill candidate flags; nothing upstream tries to generate ones that a checklist-bound Phase 2 missed. This pass runs in the opposite direction, over items that cleared Phase 2 clean: for each one, it asks itself to assume a defect exists that the named checklist doesn't capture and look for a plausible mechanism. If it finds one, it's filed as `MISC_MEASUREMENT_RISK` with a stated mechanism and confidence level; if nothing plausible turns up, that's logged too, since most clean items are expected to stay clean.

### Phase 4: Aggregate and build the review artifact

Findings are aggregated by domain first, then severity, then confidence, and rendered in a fixed section order: audit summary, finding queue, discard appendix (collapsed by default), then export controls.

The HTML template is fixed and does not vary by content length or question count: a defined type scale, a defined severity color scheme (red for critical and high, amber for medium, grey for low, never reassigned), confidence shown only as a text label so it's never confused with severity color, and one finding card per visual unit with a consistent layout of badge, domain tag, question ID, stem, collapsible reasoning, and pinned controls. If no HTML renderer is available, the same structure falls back to Markdown using identical section order, headings, and heading levels on every run.

### Phase 5: Re-audit diff mode

If a previously audited form is resubmitted under the same criteria version, the skill diffs the old and new reports and reports what's resolved, what's still open, what's newly introduced (called out prominently), and what fixes changed, such as an altered constraint ceiling. It also diffs against the stored study-context file, so configuration changes between runs are visible too. This is meant to support iterating section by section rather than re-running a full audit from scratch each time.

---

## 5. Optional exports

- A CSV of findings for tracker integration
- A corrected XLSForm with Tier-1 fixes already applied to cells (XLSForm input only)
- A structured JSON audit result for downstream agents or pipelines

---

## 6. Calibration notes

For instrument_integrity and instrument_improvement findings, over-flagging is the failure mode to guard against, so the skill prefers "possible" over "likely" when in doubt. For measurement_validity and measurement_error findings, the opposite holds, per the cost-asymmetry rule above. Either way, the goal is calibration, not raw volume of flags.

The constraint checker is specifically probed for two failure modes: overconfident invented ceilings on unusual variables (years of schooling, livestock count, remittance amounts), and ignoring references evidence when it's actually present. The validation suite is rerun whenever criteria or plausibility heuristics change, and frozen criteria are never modified without revalidation.

---

## 7. Extending the checklist

Adding a new check requires all of the following before it can be frozen: an explicit, mechanically-checkable criterion sentence; three to five violation examples graded from blatant to subtle; two to three non-violation lookalikes that contain trigger words but are actually compliant; boundary rulings for cases where experts disagree; a JSON contract entry; a fix pattern; and a methodology citation.

Before freezing, it has to pass three validation probes: an injection set of planted errors with at least 80 percent recall, a known-clean set with close to zero false positives, and a stability rerun, twice, with at least 90 percent identical flags. New variable classes for the constraint checker only need a semantic marker, one reference example, and a fallback behavior; no rule changes required.

---

## 8. Parsing details by format

**Word, PDF, or pasted text (primary path):** text is extracted and discrete questions identified via numbering patterns, line breaks, and question-mark density. Response options are detected beneath stems, section headers and grouping are identified where present, and ambiguous boundaries are asked about rather than guessed. Structural checks like skip-logic integrity are explicitly limited on these unstructured formats, and the skill says so, recommending an XLSForm upload for a full structural audit.

**XLSForm (secondary path, fuller audit):** the survey, choices, and settings sheets are read directly. Per row, it extracts name, type, label (all language columns), relevant condition, constraint, choice filter or reference, appearance, and group nesting, then reconstructs the full question flow including conditional branches, evaluating follow-up questions with awareness of their upstream conditional context.

---

## Quick summary

Share a draft questionnaire (ideally XLSForm for the fullest audit) and optionally a references folder and study context, then ask for a review, audit, bias check, or validation pass. The skill inventories the form, runs deterministic structural checks, runs a numeric constraint plausibility pass, runs a named qualitative checklist, tries to independently disconfirm its own high-severity flags, hunts for gaps its checklist might have missed, and hands back an interactive, severity-ranked review workspace you can accept, edit, or reject finding by finding. It's built to be re-run on revised drafts, diffing what changed between passes.
