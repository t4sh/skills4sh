# Skill evaluation methodology

Use this reference when a skill change should be tested, not merely reviewed.

## Evaluation ladder

| Level | Use when | Method |
|---|---|---|
| Static validation | Every skill change | frontmatter, links, word count, lockfile, security manifest, hashes |
| Trigger scenario | Description or retrieval changes | list realistic prompts that should and should not load the skill |
| Forward test | Behavior-shaping workflow changes | fresh agent/session uses the skill on a realistic task with expected answer withheld |
| Baseline comparison | Evaluating an update or claiming benefit | previous vs proposed revision for regressions; no-skill vs with-skill for benefit over no skill |
| Blind comparison | Quality is subjective | hide which output used which skill; grade against rubric |
| Benchmark loop | High-value repeated workflow | run many prompts, aggregate pass/fail and failure modes |

## [Anthropic `skill-creator`](https://github.com/anthropics/skills/tree/main/skills/skill-creator) lessons

The Anthropic `skill-creator` is valuable because it treated skill authoring like product iteration:

1. Draft the skill.
2. Run with-skill and baseline tasks.
3. Capture transcripts and timing.
4. Grade outputs against assertions or a rubric.
5. Review qualitative differences.
6. Rewrite the skill.
7. Repeat until behavior improves.

Preserve that discipline even when the heavy harness is not restored.

## [Obra `writing-skills`](https://www.skills.sh/obra/superpowers/writing-skills) lesson

The useful test-driven documentation rule is:

> If the agent was not observed failing without the skill, the skill may be documenting taste rather than teaching missing behavior.

Apply this most strongly to discipline-enforcing skills, review rubrics, safety rules, and workflow skills that try to prevent shortcuts.

## Match guidance to the failure

Classify observed behavior before choosing wording. This selectively adapts [Obra's failure-form guidance](comparative-study.md#source-freshness-and-historical-inputs); it does not make pressure testing mandatory for every edit.

| Observed failure | Guidance to try | Verification |
|---|---|---|
| Knows a rule but violates it under pressure | Explicit prohibition, relevant rationalization and stop condition | Replay the pressure scenario and observe compliance |
| Completes the task in the wrong shape | Positive output contract: required parts and their order | Check the resulting artifact against that contract |
| Omits a required element | Required field or slot in the artifact template | Check that the field is present and meaningfully filled |
| Applies a rule under the wrong condition | Observable trigger, action, and fallback | Exercise both matching and non-matching conditions |

For mixed failures, separate the causes. Do not turn every style problem into a prohibition list. Compare old and proposed wording on the same task with isolated contexts and withheld grading criteria; retain the smallest wording that addresses the observed failure. A wording micro-test does not replace a realistic forward test or demonstrate general superiority.

## Select the baseline and control the comparison

Use this comparison when behavior evaluation is warranted; changes fully covered by deterministic checks can remain on the static-validation rung. Before running, state the question, target revisions, fixtures, grading criteria and conditions:

- **Updating an existing skill:** compare the previous revision with the proposed revision. Preserve a snapshot or content hash of each, including relevant references and helpers. This tests regression relative to the existing contract.
- **Claiming benefit over no skill:** add a no-skill arm. Previous-versus-proposed evidence alone cannot establish that benefit.
- **New skill:** use no skill as the baseline when evaluating added value.

Keep the task, starting files, model/settings, available tools and budgets equivalent across arms. Use independent contexts and fresh copies of mutable fixtures so one run cannot teach or alter another. Grade with the same criteria; hide the revision labels when subjective grading matters. Record unavoidable differences as confounders rather than attributing them to the skill.

## Hold out retrieval prompts

Use a development/evaluation split when tuning a description. Assemble representative direct phrases, paraphrases, path cues and false friends; freeze an unseen evaluation set before editing. Do not tune against that set or expose its expected labels to the agent making the routing decision. If its results drive another rewrite, it becomes development data; reserve new unseen prompts for the next evaluation.

Report false positives and false negatives separately, with counts and denominators. No universal split ratio or prompt count is required. A hand-selected small set supports only a bounded retrieval check. Distinguish a description-only routing exercise from actual runtime skill discovery; testing an explicitly loaded skill does not prove automatic retrieval.

## Repeat only when the claim warrants it

Use repeated runs for claims of reliable behavioral improvement, speed or cost. Declare the repeat count and stopping rule before comparing; use the same number and conditions for each arm. Preserve every result, including failures, timeouts and retries. Report pass counts over attempted runs and variation in relevant measurements; separate successful-run latency from completion rate. Record token/timing provenance and mark unavailable metrics unavailable.

For small samples, show individual outcomes and avoid statistical-significance claims. Neither a single win nor an average without failures establishes reliability. Mechanical edits covered by deterministic checks do not need repeated agent runs, a benchmark service, or a mandatory iteration count. These measurement refinements selectively adapt [Anthropic's evaluation methods](comparative-study.md#source-freshness-and-historical-inputs).

## Test-vector catalog

For any behavior-shaping or review/routing skill, maintain a compact catalog of vectors. A vector is not a full benchmark; it is the smallest prompt, file fixture, or command that proves one important behavior.

| Vector type | Proves | Example |
|---|---|---|
| Direct trigger | Description retrieves the skill for obvious requests | "create a skill for X" |
| Adjacent trigger | Description handles likely user wording not copied verbatim | "turn this workflow into reusable agent instructions" |
| False friend | Skill does not over-trigger on nearby but wrong tasks | UI design request should not load a skill-authoring rubric |
| File/path cue | Paths, extensions, or config names route correctly | `skills/name/SKILL.md`, `agents/openai.yaml` |
| Mode command | Every documented mode maps to an output contract | `skill-architect: audit`, `skill-architect: reconcile` |
| Fixture command | Shipped helper/snippet executes on a minimal fixture | validator/fixer/scaffold temp directory |
| Negative fixture | Helper fails closed on malformed input | invalid frontmatter, broken anchor, missing file |
| Enumeration parity | Lists agree across description, mode table, scaffold, tests, docs | no missing mode in one surface |
| Severity calibration | Same defect is classified consistently by impact | masking sibling skills is high impact even if code delta is small |
| Adapter boundary | Vendor-specific metadata stays isolated | OpenAI YAML guidance does not rewrite portable core |

Use enough vectors to cover each changed behavior. Do not build a giant suite for metadata-only edits; record why static validation is sufficient.

## Prompt catalogs vs run evidence

Prompt-vector catalogs are useful, but they are not the same as executed eval evidence. Audit them by claim and risk:

| Evidence shape | Counts as | Missing before high-confidence claims |
|---|---|---|
| Prompt plus expected output only | Retrieval or fixture intent | Observed run status, transcript summary, or pass/fail result |
| Prompt plus baseline failure | Evidence of a real behavior gap | With-skill result and grading criteria |
| Prompt plus with-skill transcript/result | Forward-test evidence | Baseline comparison when claiming improvement over no skill |
| Baseline and with-skill runs plus rubric/blind grading | Strong behavior evidence | Maintenance cadence and last-run date |

For high-risk behavior-shaping, ops, safety, discipline, and review skills, flag prompt-only evals as incomplete evidence. Recommend optional fields or sidecar reports such as `baseline_failure`, `pressure`, `with_skill_result`, `status`, `last_run`, and observed transcript summaries. Keep lightweight prompt vectors acceptable for low-risk metadata or retrieval checks when the limitation is explicit.

## Harness setup notes

A lightweight harness is acceptable when it is reproducible and source-cited:

1. **Name the target.** Skill path, version, branch/commit, and changed surface.
2. **Create or name fixtures.** Use temp directories for helper scripts; use tiny sample skill folders or markdown files for validator/link behavior.
3. **Run fresh where behavior matters.** For forward tests, use a fresh agent/session or isolate context so the result comes from the skill, not prior conversation.
4. **Withhold expected answer.** The test prompt should not reveal the exact desired patch unless the skill is only being asked to execute a deterministic command.
5. **Capture command + output.** Include the exact command and observed stdout/stderr summary in the review packet.
6. **Record skip risk.** If a vector is skipped, state whether the remaining risk is low, medium, or high and what would reduce it.
7. **Patch the smallest cause.** When a vector fails, update trigger text, routing, references, helper behavior, or tests narrowly; then rerun the vector.

## Trigger test template

For every skill with meaningful retrieval risk, maintain a small set:

| Prompt | Expected | Reason |
|---|---|---|
| direct phrase | should trigger | exact phrase in description |
| adjacent phrase | should trigger | likely user wording |
| false friend | should not trigger | similar term but wrong domain |
| file-path cue | should trigger | path or extension in description |
| vendor cue | should trigger adapter only | e.g. OpenAI YAML, Claude plugin, Antigravity |

## Forward test template

A forward test packet should include:

- skill version and content snapshot/hash (versions can be unchanged during drafting)
- prompt
- fixture files or repo state
- expected behavior withheld from the agent
- transcript or summary
- baseline choice, conditions, and any confounders
- attempted runs, observed outcomes, and unavailable metrics
- pass/fail result
- patch decision

## Review packet template

```markdown
## Skill authoring audit

- Checklist derived before patch: yes/no
- Evidence table completed before patch: yes/no
- Mechanical checks run: list commands
- Fixture or forward test: prompt / skipped reason

| Check | Evidence | Result | Patch decision |
|---|---|---|---|
| Trigger specificity | `skills/name/SKILL.md:2` | pass/fail | keep/patch |
```

## When not to run heavy evals

Skip baseline/blind/benchmark loops when:

- the change is metadata-only and mechanical checks cover it
- the skill is a narrow reference with no behavior claim
- the cost exceeds the value and the limitation is reported

Still run static validation and cite what was skipped.
