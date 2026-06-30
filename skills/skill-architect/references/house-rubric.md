# Portable rubric for agent skills

This rubric defines what an industry-standard, multi-agent skill should satisfy before it becomes central to any working directory, project, skill collection, repository, or agent runtime.

## Precedence

1. Current working context: CWD, project conventions, repository rules, runtime constraints, and available checks.
2. This portable rubric.
3. Vendor guidance: Anthropic, OpenAI/Codex, Antigravity, Azure/Copilot-style agents, Craft, Cursor, and others.
4. Individual authoring preferences.

In `skills4sh`, examples of this rubric in practice can be inspected across the existing skills, with `docs/SKILL_AUTHORING_STANDARD.md` as that project's binding local standard.

## Required qualities

| Quality | Pass condition |
|---|---|
| Retrieval clarity | Description contains a concise capability clause plus concrete trigger/use conditions: phrases, contexts, tools, paths, file types, or named situations. |
| Predictability | The skill steers the agent toward the same process each run: invocation fit is intentional, branches are distinct, steps have checkable completion criteria, and pruning removes no-op or stale guidance. |
| Portable core | The main workflow can be followed by a generic file-reading agent without vendor-only assumptions. |
| Progressive disclosure | `SKILL.md` contains the operating path; long comparisons, matrices, and edge cases live in linked references. |
| Local compliance | Frontmatter, license, version, lockfiles, security manifests, README/plugin metadata, hashes, and runtime conventions match the current project or repository's expectations when present. |
| Evidence-backed guidance | Claims about quality, defects, or external tools cite files, commands, or primary sources. |
| Embedded-code correctness | Any shipped CI, shell, or code — helper scripts, snippets, workflow examples — is reviewed for functional correctness and executed against a fixture, not merely security-scanned or read for shape; audits report the fixture command and observed output or mark the check skipped with risk. |
| Executable-surface triage | Skill audits catch common code-review-adjacent risks — untested snippets, fail-open logic, shell/runtime portability, external tool/network fragility, path/quoting hazards, credential boundaries, parser edge cases, and missing CI visibility — then route deep algorithm/security/performance analysis to a code-review lens. |
| Enumeration consistency | Mode names, command tables, scaffold templates, descriptions, tests, and reference lists agree; any added mode or helper appears everywhere needed or is intentionally absent with rationale. |
| Severity calibration | Findings are rated by user/release impact, blast radius, and ability to mask other failures — not by patch size or whether the bug sits in prose, helper code, or CI. |
| Deterministic helpers | Repeated fragile actions use scripts/assets only when they reduce risk and are documented. |
| Verification path | The skill names the commands, evals, or fixture checks that prove changes work. |
| Handoff durability | Plans, audits, and distilled proposals can be understood by a fresh agent or future session without hidden conversation context. |

## Portable file model

The portable model is intentionally simple:

```text
skills/<skill-name>/
├── SKILL.md        # required entrypoint
├── LICENSE         # recommended or required by many repositories
├── references/     # optional detailed docs
└── assets/         # optional icons, templates, inert helper scripts
```

Other projects may allow `scripts/`, `examples/`, or `evals/` as top-level directories. Follow the CWD/project/repository's documented layout when present; in `skills4sh`, prefer the established layout unless its standard changes.

## Body size

Keep `SKILL.md` lean enough to load cheaply. Use these default word bands for the body (excluding frontmatter); when a local standard defines its own bands, the local standard wins.

| Skill type | Target body size |
|---|---:|
| Simple reference or narrow command | 300–700 words |
| Normal workflow skill | 1,000–2,000 words |
| Complex workflow skill | 2,000–3,500 words, with justification |
| Above 3,500 words | Extract detail into `references/` before merge unless there is a clear review reason |

Long comparisons, matrices, troubleshooting, and extended examples belong in `references/`, not the body. "Lean enough" is not a judgment call when these bands apply — measure the body and place it in a band.

## Frontmatter rubric

A strong description has two required parts: a concise capability clause and concrete trigger/use conditions. It does five jobs:

1. Names exact user phrases.
2. Names file paths, tools, APIs, or error messages.
3. States contexts where the skill should load even if the phrase differs.
4. Front-loads leading words that the user, docs, or codebase already use.
5. Avoids becoming a workflow summary.

Preferred pattern:

```yaml
description: "Capability summary. Use when the user asks to \"create X\", \"fix Y\", or \"review Z\"; when paths include `foo.config.js`; or when debugging named failure modes."
```

Allowed short pattern when the capability is obvious from the skill name:

```yaml
description: "Use when the user asks to \"create X\", \"fix Y\", or \"review Z\"; when paths include `foo.config.js`; or when debugging named failure modes."
```

Legacy valid pattern:

```yaml
description: "This skill should be used when the user asks to \"create X\", \"fix Y\", or \"review Z\"; when paths include `foo.config.js`; or when debugging named failure modes."
```

Avoid:

- loose summaries with no trigger/use clause: "Helps with skills"
- generic trigger-only descriptions with no retrieval detail: "Use when creating skills"
- synonym-only trigger branches that repeat one meaning several ways
- second-person descriptions: "Use this when you..."
- workflow summaries that omit retrieval cues
- vendor-only trigger names unless the skill is truly vendor-specific


## Command mode rubric

`skill-architect` uses modes to keep broad architecture work precise:

| Mode | Quality bar | Failure mode to avoid |
|---|---|---|
| `plan` | Names scope, standards, affected files, gates, and rollback before edits | vague roadmap with no verification path |
| `create` | Starts from concrete use cases and produces a portable core before adapters | scaffold-first skills with weak trigger descriptions |
| `audit` | Produces source-cited findings and separates mechanical failures from judgment calls | opinion-only reviews |
| `fix` | Applies only safe deterministic fixes with dry-run evidence and validation afterward | using a fixer to rewrite judgment-heavy content or guess broken anchors |
| `refactor` | Preserves skill intent while improving retrieval, disclosure, routing, or checks | churn-only rewrites or accidental behavior changes |
| `compare` | Cites inspected sources and records adopt/reject rationale | copying public patterns because they are popular |
| `distill` | Converts session evidence into reusable workflow, trigger, resource, and eval candidates | mistaking one-off session details for durable skill behavior |
| `reconcile` | Verifies stale plans/proposals against current files and retires fixed, rejected, or drifted items | re-reporting old findings without checking current reality |
| `teach` | Gives the smallest useful rule plus an example or exercise | dumping the full rubric without context |

## Body rubric

`SKILL.md` should answer:

1. What problem does this skill solve?
2. When does it apply after loading?
3. What is the shortest safe operating procedure?
4. Which reference file should be read for each deeper path?
5. What must not be done?
6. What verifies completion?

Every ordered step or command workflow should end with a checkable completion criterion. When the criterion is fuzzy, sharpen it before splitting the sequence; split only when visible later steps create premature-completion risk that the criterion cannot absorb.

Use imperative, objective language. Prefer routing tables over long prose.

## Reference rubric

Every reference file must be linked from `SKILL.md` and loaded only when relevant.

Good references include:

- comparative studies
- advanced patterns
- vendor adapter matrices
- security checklists
- eval methodology
- troubleshooting playbooks

Bad references include:

- unlinked notes
- session history
- duplicate `SKILL.md` prose
- stale install instructions better kept in root docs

## Helper rubric

Add helper assets only when they meet all conditions:

- The task is repeated or fragile.
- The helper is simpler than repeatedly generating code.
- Inputs and outputs are documented.
- The helper is inert unless explicitly run.
- The helper passes the available local security and validation checks.

## Predictability and pruning checks

Use these checks during `audit` and `refactor`, especially when a skill is long, branchy, or inconsistent across runs.

| Check | What to inspect | Pass condition |
|---|---|---|
| Invocation fit | Description/frontmatter, expected caller, and whether another skill must reach it | Model invocation is used only when autonomous agent reach or cross-skill reach is worth the context load; user-invoked skills stay human-routed unless a router skill is needed. |
| Branch uniqueness | Description triggers, command tables, and mode rules | Each branch represents a genuinely distinct task path; synonyms that rename one branch are collapsed. |
| Information hierarchy | Every major `SKILL.md` section and linked reference | Steps needed by every run stay in `SKILL.md`; branch-only or detailed reference moves behind a clear context pointer; related rules are co-located. |
| Completion criteria | Ordered steps, command workflows, and handoff plans | Each step has a checkable done condition; exhaustive criteria are used where thin legwork would miss important cases. |
| Premature completion | Long step sequences and vague done conditions | Sharpen fuzzy completion criteria first; only recommend splitting when later visible steps still pull the agent forward. |
| Leading words | Repeated concepts in descriptions, body, and repo docs | A compact pretrained term replaces repeated explanatory prose when it improves invocation or execution predictability. |
| Single source of truth | Repeated setup, command, security, or routing guidance | One authoritative location owns each behavior; other mentions point to it. |
| Relevance and sediment | Old dates, session history, obsolete branches, stale examples | Lines still affect current skill behavior; stale layers are removed or archived. |
| No-op test | Each sentence in isolation | The sentence changes behavior versus default agent behavior; otherwise delete it instead of polishing it. |
| Sprawl | Body word count and amount of in-file reference | The entrypoint remains lean; long matrices, troubleshooting, comparisons, and examples live in references. |

Report these as review findings with the same evidence bar as code findings: source-cited, actionable, scoped, testable where practical, and context-aware.

## Handoff plan rubric

A plan or distilled skill proposal is the product when another agent or future session will execute it. It must be self-contained enough for a fresh executor:

- exact source paths, relevant excerpts, and local conventions
- in-scope and out-of-scope boundaries
- ordered steps with verification commands and expected results
- done criteria that are machine-checkable where possible
- drift checks when the plan depends on current file state
- STOP conditions for mismatches, failed verification, or scope expansion
- rejected findings or patterns with concise rationales

Avoid phrases like "as discussed" or "the relevant file" in handoff artifacts. Inline the context or cite where to read it.

## Enumeration consistency

Broad skills tend to repeat the same set of modes, helpers, checks, or references in several places. Audit those lists as one surface:

| Enumeration | Must stay consistent with |
|---|---|
| Frontmatter description modes/triggers | command-mode table, mode rules, scaffold defaults, tests |
| Command-mode table | mode rules, output contracts, eval vectors, docs examples |
| Helper script table | actual `assets/` files, validation tests, security manifest, lockfile |
| Reference file table | files on disk and all links from `SKILL.md` |
| Local gate list | package scripts, CI workflows, README/release docs |
| Severity labels | prior findings, skipped-risk notes, release-blocking policy |

Treat a mismatch as at least medium severity when it can route an agent to the wrong workflow, make a command look supported when it is not, or hide a missing verification path. Prefer deterministic checks once a list has a stable source of truth.

## Severity calibration

Rate by consequence, not aesthetics:

| Severity | Use when |
|---|---|
| Critical | The skill can cause destructive actions, credential exposure, supply-chain compromise, or unsafe execution without a clear stop condition. |
| High | The issue can mask other broken skills/checks, make CI or validators silently pass invalid work, corrupt release metadata, or produce materially wrong user output. |
| Medium | The issue creates recurring review noise, portability failures, brittle tests, incomplete fixtures, or misleading docs that a careful user can work around. |
| Low | The issue is cosmetic, local wording polish, or a non-blocking clarity improvement with little chance of changing behavior. |

Escalate one level when a problem is systematic across skills, hard to notice, or likely to recur. De-escalate only when a mechanical gate already catches it and the remaining problem is wording or ergonomics.

## Review rubric

When a skill ships executable material, first run this bounded triage before asking for a full code review:

| Surface | Skill-architecture question |
|---|---|
| Fixture coverage | Does each helper, snippet, or workflow example have a fixture command or an explicit skipped-risk note? |
| Failure mode | Does validation fail closed with actionable output instead of silently skipping risk? |
| Portability | Are shell, Python, Node, browser, or OS assumptions named and tested where practical? |
| External dependency | Are remote tools, registries, APIs, credentials, and network calls pinned, cached, mocked, or clearly isolated? |
| Input/path handling | Are file paths, quoting, links, anchors, and parser edge cases covered by deterministic checks? |
| CI visibility | Does the local project run the relevant check in CI, or is the limitation called out? |

Eval claims and adapter coverage need calibrated handling:

- Treat prompt-vector catalogs as retrieval/fixture evidence unless they also include observed run status, baseline failure, with-skill result, or transcript summary. For high-risk behavior-shaping, ops, safety, discipline, and review skills, prompt-only evals are incomplete evidence, not a universal CI failure.
- Treat missing or partial vendor adapters as a repository-policy question. If local docs require adapters, report missing metadata as a packaging gap; if no rule exists, report it as a policy decision and recommend either consistent adapters or an explicit selective-coverage rationale.
- Keep weak-description checks deterministic only when the rule is portable and low-false-positive. In `skills4sh`, generic trigger-only descriptions fail mechanically; richer trigger quality remains a review judgment.

Stop at triage. If the finding requires algorithm redesign, exploit analysis, performance profiling, concurrency review, or broad refactoring, hand it to a dedicated code-review lens and keep `skill-architect` focused on skill quality, evidence, and verification path.

A review finding is valid only when it is:

| Property | Requirement |
|---|---|
| Source-cited | Names `file:line`, command output, or primary source. |
| Actionable | Specifies the exact patch or decision. |
| Scoped | Avoids churn outside the requested surface. |
| Testable | Has a mechanical check, fixture, or prompt scenario where practical; embedded code requires a fixture transcript or an explicit skipped-risk note. |
| Context-aware | Respects local CWD/project/repository conventions over upstream defaults. |

## Acceptance checklist

Before merge, confirm:

- `SKILL.md` has required frontmatter and body below the hard word threshold.
- Every reference link resolves.
- Every reference file is linked from `SKILL.md`.
- README, agent instructions, plugin manifests, security manifests, lockfiles, and registries are updated where the local project or repository requires them.
- Hashes match the actual file contents.
- Security findings are either absent or documented with substantive reasons.
- The handoff reports exact checks run and their outcomes.
