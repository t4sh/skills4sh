---
name: skill-architect
description: "Create, audit, and refactor portable agent skills (`SKILL.md`). Use when asked to \"plan a skill\", \"create a skill\", \"review a skill\", \"fix skill validation errors\", \"improve a skill\", \"compare skill rubrics\", \"distill a skill from sessions\", \"reconcile skill plans\", or \"teach skill authoring\"; when turning a recurring workflow into reusable agent instructions; when a skill is not triggering; when paths include `skills/*/SKILL.md`; or when the request concerns skill trigger descriptions, skill evals, or skill-authoring rubrics such as skill-creator or Skill Development. Not for running another skill that the request names (for example \"use skill-creator\"), for employee, game, or other non-agent skills, or for general prompt writing."
license: MIT
compatibility: macOS, Linux, or Windows; optional helper scripts require Python >=3.10; validation and inspection require PyYAML 6.0.3 on Python 3.10-3.14
metadata:
  author: t4sh
  version: "2.0.0"
  tags: skill-authoring, skill-creator, skill-review, skill-rubric, agent-skills, multi-agent, anthropic, openai, grok, openclaw
---

# Skill Architect

Architect portable, high-quality agent skills from a vendor-neutral perspective. Use this skill as an independent planning, creation, review, refactoring, comparison, distillation, reconciliation, and teaching layer for any agent skill repository or runtime.

## Non-negotiables

- Do not make a vendor-specific skill the portable rubric verbatim.
- Do not reinstall upstream `skill-creator` over an existing skill without checking provenance and collision risk.
- Do not ship loose summary-only descriptions; the description must include a concise capability clause and concrete trigger/use conditions.
- Do not add unlinked reference files.
- Do not add helper scripts without a concrete repeatability benefit and a validation path.
- Do not treat `skills.sh` popularity as quality proof; inspect source, tests, security posture, and portability.

## Reference files

| File | Load when |
|---|---|
| [references/house-rubric.md](references/house-rubric.md) | Acting in any mode (mode rules and done conditions); writing or reviewing a description; checking predictability, invocation fit, completion criteria, pruning, enumeration consistency, executable-surface triage, and severity calibration |
| [references/workflow-steps.md](references/workflow-steps.md) | Running procedure steps 2-8: intake list, layer split, audit packet, draft shape, checks versus judgment, and handoff rules |
| [references/eval-methodology.md](references/eval-methodology.md) | Testing triggers, building test-vector catalogs, setting up lightweight harnesses, comparing baseline behavior, planning pressure tests, or filling the PR review packet |
| [references/helper-runtime.md](references/helper-runtime.md) | Running any helper script: isolated uv/venv commands, interpreter selection, helper limits, and unavailability reporting |
| [references/vendor-adapters.md](references/vendor-adapters.md) | Runtime install roots, pointer files, and vendor metadata that must stay out of the portable workflow |
| [references/naming-and-packaging.md](references/naming-and-packaging.md) | Avoiding slug collisions, deciding names, updating lockfiles/security manifests, and packaging repo updates |
| [references/comparative-study.md](references/comparative-study.md) | Comparing Anthropic, OpenAI, Matt Pocock, Obra, Azure, Antigravity, or other skill-development/authoring/creator patterns |

## Command modes

Use command-like modes when the user names one explicitly. If no mode is named, infer the closest mode from the request and state the assumption. Before acting, read the chosen mode's rule in the [command mode rubric](references/house-rubric.md#command-mode-rubric); finish only when its [done condition](references/house-rubric.md#done-conditions) holds.

| Mode | Use when | Steps | Primary reference | Output |
|---|---|---|---|---|
| `skill-architect: plan` | Designing a skill, repo standard, gate, release, or migration before editing | 1-4, 8 | [Portable rubric](references/house-rubric.md), [Naming and packaging](references/naming-and-packaging.md) | Scope, affected files, standards, verification path, rollback notes |
| `skill-architect: create` | Creating a new portable skill or scaffolding a skill folder | 1-8 | [Portable rubric](references/house-rubric.md), [Naming and packaging](references/naming-and-packaging.md) | `SKILL.md` plus linked references/assets/scripts and repo metadata plan |
| `skill-architect: audit` | Reviewing an existing skill or skill repo against the rubric | 1-3, 5, 7, 8 | [Portable rubric](references/house-rubric.md) | Source-cited findings table, mechanical gate status, patch recommendations; read-only unless patching is also requested |
| `skill-architect: fix` | Applying narrow deterministic fixes that `validate_skill.py` can prove | 1, 2, 6, 7 | [Portable rubric](references/house-rubric.md), [Helper runtime](references/helper-runtime.md) | Dry-run patch list or applied safe fixes, then validation output |
| `skill-architect: refactor` | Improving an existing skill without changing its purpose | 1-8 | [Portable rubric](references/house-rubric.md), [Eval methodology](references/eval-methodology.md) | Trigger rewrite, reference split, routing cleanup, verification updates |
| `skill-architect: compare` | Comparing upstream skill-development, authoring, or creator rubrics | 1-3, 8 | [Comparative study](references/comparative-study.md) | Evidence matrix, reusable rules, adoption/rejection decisions |
| `skill-architect: distill` | Reviewing one session, a session ID/path, or a group of sessions to extract a reusable skill | 1-4, 8 | [Portable rubric](references/house-rubric.md), [Eval methodology](references/eval-methodology.md) | Session evidence map, reusable workflow, skill proposal or draft, eval plan |
| `skill-architect: reconcile` | Refreshing stale skill plans, audits, session-distilled proposals, or blocked skill backlogs | 1, 2, 5, 7, 8 | [Eval methodology](references/eval-methodology.md), [Portable rubric](references/house-rubric.md) | Updated status, drift decisions, retired/reopened items, next executable plan |
| `skill-architect: teach` | Explaining skill authoring standards or coaching a user/agent | 1, 2 | [Portable rubric](references/house-rubric.md), [Vendor adapters](references/vendor-adapters.md) | Concise lesson, examples, and next-step exercise or checklist |

Run the steps listed for the mode in the order given; a step that is not listed is skipped, not failed. Step 8 applies only when another agent or a later session will act on the output.

## Procedure

Each step's detail is in [workflow steps](references/workflow-steps.md) under the same step number. A step is finished only when its `Done when` cell holds.

| # | Step | Do | Done when |
|---|---|---|---|
| 1 | Classify the request | Choose `plan`, `create`, `audit`, `fix`, `refactor`, `compare`, `distill`, `reconcile`, or `teach` before deciding files or checks. | One mode is named, or the inferred mode is stated as an assumption. |
| 2 | Read the local standard | Start with the current working context, not an upstream rubric: find the CWD/project/repository authoring standard, agent instructions, check commands, and target skill before editing. Local rules win over external rubrics ([detail](references/workflow-steps.md#step-2-read-the-local-standard)). | The governing standard and check commands are cited by path, or their absence is stated. |
| 3 | Gather use cases and pick the lens | Capture only the details that determine structure, using the [intake list](references/workflow-steps.md#step-3-gather-use-cases-and-pick-the-lens); ask one focused question only when a structural choice is ambiguous. Select the lens: structure, quality/evals, vendor compatibility, distribution governance, or predictability. | Each intake item is recorded or marked not applicable; each lens in scope is named; at most one clarifying question is open. |
| 4 | Plan the artifact | Decide the portable core, references, optional assets/scripts, vendor metadata, and validation path, assigning each planned file or section to a layer of the [portable/adapter split](references/workflow-steps.md#step-4-plan-the-artifact). | Every file to add or change is listed with its layer and the command that will verify it; the portable core holds no vendor-only assumption. |
| 5 | Review before patching | For a new skill, record requirements, fixtures, and acceptance checks before drafting. For existing content, fill the [audit packet](references/workflow-steps.md#step-5-review-before-patching) and run the [predictability and pruning pass](references/house-rubric.md#predictability-and-pruning-checks) before judging style or proposing edits. Execute shipped CI, shell, or code against a fixture rather than vouching for it by reading, then run the [executable-surface triage](references/house-rubric.md#review-rubric). | For a new skill, the pre-draft checklist cites the inputs and names its verification commands. For existing content, each packet row has `file:line` evidence and a keep/patch decision; each shipped script or snippet in scope has a fixture command with observed output or a skipped-risk note. |
| 6 | Draft or patch narrowly | Keep `SKILL.md` focused on routing and immediate behavior and move detail to `references/` ([draft rules](references/workflow-steps.md#step-6-draft-or-patch-narrowly)). Avoid churn-only rewrites; improve only the requested surface and directly related standard violations. | The diff touches only planned files, or each extra file is called out; the body is placed in a [size band](references/house-rubric.md#body-size); every reference is linked from `SKILL.md` with a load condition; each script or asset has a stated repeatability reason. |
| 7 | Verify mechanically | For a new draft, finish its audit packet with file evidence and run its behavior fixtures. Run repo checks or the closest local equivalent before handing back, routing each check to the layer that can decide it ([checks versus judgment](references/workflow-steps.md#deterministic-checks-vs-judgment)). In `skills4sh`, run the [packaging check list](references/naming-and-packaging.md#packaging-checklist). Run a security scan when new files contain scripts, shell examples, credentials guidance, or network examples. | Each check is reported as passed, failed, or skipped with its exact command; no eval, scan, or fixture test is claimed without a run. |
| 8 | Hand off | Write a plan, proposal, audit packet, or distilled skill spec for the weakest plausible executor, following the [handoff rules](references/workflow-steps.md#step-8-hand-off) and the [handoff plan rubric](references/house-rubric.md#handoff-plan-rubric). Record rejected findings or non-adopted patterns with one-line rationales. | The artifact gives exact paths or URLs, scope boundaries, verification commands with expected results, and STOP conditions; rejected findings are recorded with a rationale. |

## Helper scripts

Optional helper scripts live under `assets/scripts/` so they ship as inert skill assets. Read or run them only when the task needs deterministic inspection or scaffolding.

| Script | Use |
|---|---|
| [`assets/scripts/inspect_skill.py`](assets/scripts/inspect_skill.py) | Summarize a skill folder: files, frontmatter, body word count, and linked references |
| [`assets/scripts/validate_skill.py`](assets/scripts/validate_skill.py) | Run a local portable-skill validation pass against one skill folder, with warning-only progressive-disclosure hints |
| [`assets/scripts/fix_skill.py`](assets/scripts/fix_skill.py) | Dry-run or apply conservative deterministic fixes to `SKILL.md`; run `validate_skill.py` afterward |
| [`assets/scripts/scaffold_skill.py`](assets/scripts/scaffold_skill.py) | Create a starter skill folder; `--author` sets `metadata.author` (omitted otherwise) and `--openai-yaml` adds a Codex `agents/openai.yaml` |
| [`assets/scripts/run_uv.py`](assets/scripts/run_uv.py) | Start `uv` after removing inherited `UV_*` host configuration |

Validation and inspection need Python 3.10–3.14 plus the hash-pinned [Python dependency file](assets/scripts/requirements.txt) in an isolated runner, with every helper run as `python -E -B`. Never install validation dependencies into the global Python environment, and do not use `python -I`. Use the [helper runtime](references/helper-runtime.md) for exact uv, venv, and PowerShell commands, interpreter selection, helper limits, and when to report a helper unavailable.

**Author-only:** to evaluate Skill Architect itself, use the [mode scenario catalog](assets/evals/scenarios.json) as described in [Eval methodology](references/eval-methodology.md#evaluating-skill-architect-itself); skip it for any other task.
