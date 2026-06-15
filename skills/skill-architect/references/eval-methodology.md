# Skill evaluation methodology

Use this reference when a skill change should be tested, not merely reviewed.

## Evaluation ladder

| Level | Use when | Method |
|---|---|---|
| Static validation | Every skill change | frontmatter, links, word count, lockfile, security manifest, hashes |
| Trigger scenario | Description or retrieval changes | list realistic prompts that should and should not load the skill |
| Forward test | Behavior-shaping workflow changes | fresh agent/session uses the skill on a realistic task with expected answer withheld |
| Baseline comparison | Skill claims to improve agent behavior | compare output without skill vs with skill |
| Blind comparison | Quality is subjective | hide which output used which skill; grade against rubric |
| Benchmark loop | High-value repeated workflow | run many prompts, aggregate pass/fail and failure modes |

## [Anthropic `skill-creator`](https://www.skills.sh/anthropics/skills/skill-creator) lessons

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

- skill version
- prompt
- fixture files or repo state
- expected behavior withheld from the agent
- transcript or summary
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
