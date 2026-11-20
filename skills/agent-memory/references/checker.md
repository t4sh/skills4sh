# Index checker

Load this reference when Sync, Maintain, or Status needs the index compared with the memory files and the host can run Node.js 22 or later from a shell. The checker is optional. Memory stays plain files that need no tool; when Node.js or a shell is unavailable, use the [manual comparison](#manual-comparison), which covers the same differences.

## Run it

```text
node <skill-directory>/assets/scripts/check-memory.mjs <project-root> [--json] [--today YYYY-MM-DD]
```

`<skill-directory>` is the directory that holds this skill's `SKILL.md`. `<project-root>` is the directory that contains `.agent-memory/`; the `.agent-memory/` path itself also works.

- The [script](../assets/scripts/check-memory.mjs) only reads. It never writes, renames, or deletes a file, makes no network call, has no dependencies, and does not follow symbolic links below the path it is given.
- Pass `--today` when the task supplies the date; otherwise the script uses the local date.
- Use `--json` to read counts and items reliably; the default output is text for people.
- Do not install anything to make it run. If `node` is missing or older than 22, do the manual comparison.
- The checker reports. Changes are still made by the operation that is running, under that operation's rules. Status and other read-only requests change nothing.

| Exit code | Meaning |
|---|---|
| 0 | No errors. Review items may still be listed. |
| 1 | At least one error. |
| 2 | Usage error: unknown option, bad `--today`, or a path that is not a directory. |

## What it checks

It reads `.agent-memory/index.yaml` and the frontmatter of every `.md` file in the eight type directories, including subdirectories. It ignores `.agent-memory/README.md` and never prints a file's body.

| Code | Meaning | What Sync or Maintain does |
|---|---|---|
| `unindexed-file` | A memory file has no index entry | Add the entry from the file's frontmatter |
| `orphan-entry` | An index entry has no file at `.agent-memory/{id}.md`, and no skipped path could contain it | Remove the entry only after confirming it is absent |
| `index-mismatch` | The entry's `type`, `title`, or `status` differs from the file's frontmatter | Read the file and refresh the entry. Each such file counts once as updated externally |
| `index-missing-field`, `index-duplicate-id` | An entry lacks `id`, `type`, `title`, or `status`, or an `id` is listed twice | Complete or merge the entry from the file's frontmatter |
| `index-missing` | `index.yaml` is absent; the message says when a legacy `INDEX.yaml` is present | Run Init, or Migrate for the legacy name |
| `index-unparsed`, `frontmatter-unparsed` | The YAML is outside the subset the templates use, so nothing was assumed | Open the named file at the reported line and compare it by hand; report the YAML problem |
| `frontmatter-missing`, `missing-field`, `invalid-field` | No frontmatter block, a required field is missing or empty, or a single-value field holds a list | Report it and ask before changing the file |
| `id-mismatch`, `type-directory-mismatch`, `invalid-type` | `id` differs from the path, or `type` does not match the directory or the schema | Report it and ask whether to move the file or correct the field |
| `invalid-status`, `invalid-date` | `status` is not `active` or `archived`, or a date is not a real `YYYY-MM-DD` date | Report it and ask before changing the file |
| `memory-dir-missing` | There is no `.agent-memory/` | Follow the rule for a missing `.agent-memory/` in `SKILL.md` |

Review items never change the exit code:

| Code | Meaning | Where it is handled |
|---|---|---|
| `expired` | `expires` is before today on a file that is not archived | Maintain step 2: ask update, archive, or remove |
| `superseded-still-active` | Another file names this one in `supersedes`, and this one is still `active` | Maintain step 2: flag for archival |
| `outside-type-directory` | A markdown file or directory sits outside the type directories and was not checked | A legacy flat file needs Migrate; otherwise report it |
| `symlink-skipped` | A symbolic link was not followed | Check its target by hand if it should be memory. An index path covered by a skipped link is not reported as orphan because the checker cannot establish whether the file exists |

The checker does not judge staleness by age, the 90-day review of archived entries, content overlap, session cleanup, or secrets. Maintain steps 2 to 4 still cover those.

## Use the JSON output in reports

| JSON field | Report line |
|---|---|
| `summary.unindexedFiles` | Sync report: New files found |
| `summary.orphanEntries` | Sync report: Orphan entries |
| `summary.mismatchedFiles` | Sync report: Updated externally |
| `summary.byType` | Health report: By type |
| `summary.byStatus.archived` | Health report: Archived |
| `review` items with code `expired` | Health report: Expired |

The three parity counts are `null` when the index could not be read. In that case report that parity was not checked by the tool and compare by hand. After Sync or Maintain has applied its fixes, run the checker again; it exits 0 when the index and the files agree.

## Manual comparison

Use this when the checker cannot run. It needs only file reads.

1. Read `.agent-memory/index.yaml` and list each entry's `id`, `type`, `title`, and `status`.
2. List the `.md` files in the type directories. A file's expected `id` is its path below `.agent-memory/` without `.md`.
3. A file whose `id` is not in the index is unindexed. Remove an entry as an orphan only when the path is confirmed absent. Preserve entries under skipped links or uninspected directories and list them for review.
4. For each remaining pair, compare the entry's `type`, `title`, and `status` with the file's frontmatter. A difference means the file was updated externally.
5. While the frontmatter is open, check it against the [schema](templates.md#memory-file-frontmatter-schema): required fields present, `id` equal to the path, `type` matching the directory, `status` either `active` or `archived`, and dates in `YYYY-MM-DD`.
