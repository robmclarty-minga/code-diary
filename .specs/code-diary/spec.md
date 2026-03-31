# Spec: code-diary

**Pitch**: `.specs/code-diary/pitch.md`
**Status**: Draft

---

## §1 — Context

Developers who want a lightweight record of their daily work have no tool that reads the signal already present in their commits and turns it into something readable. The problem is described in `.specs/code-diary/pitch.md`.

This spec defines `code-diary`: a zero-dependency Node.js CLI that reads `git log` output from one or more repositories, categorizes the commits found for a given date, and appends a structured markdown entry to a monthly diary file on the local filesystem.

---

## §2 — Functional Overview

### Core workflow

The user invokes `code-diary` from the command line, passing one or more repository paths and an optional target date. The tool:

1. Queries `git log` for each repository to retrieve commits made on the target date, filtering out merge commits.
2. Parses commits into structured data: SHA, subject, author, timestamp, branch, file-change stats.
3. Categorizes each commit using deterministic heuristics based on conventional commit prefixes and changed file types.
4. Extracts any TIL items from commit messages containing the string `TIL:`.
5. Produces a time breakdown by bucketing commit timestamps into day segments (morning, afternoon, evening).
6. Generates a formatted markdown entry from the structured data.
7. Appends the entry to `diary/YYYY-MM.md` in the configured output directory, creating the file and `diary/` folder if they do not exist.

When multiple repos are provided, all of their commits appear within the same daily entry, under separate repo-level headings.

### Replace confirmation

If a diary entry for the target date already exists in the monthly file, the CLI prompts:

```
An entry for YYYY-MM-DD already exists. Replace it? [y/N]
```

The user must type `y` or `Y` to proceed. Any other input, or no input at all, causes the command to exit without modifying the file. When running non-interactively (stdin is not a TTY — e.g., piped or redirected), the tool exits without prompting.

### Output file location

The output file is always `diary/YYYY-MM.md` relative to the configured output directory (default: current working directory). The `diary/` subdirectory and the monthly file are created automatically if absent.

---

## §3 — Actors and Permissions

There is a single actor: the **local user** running the CLI. There is no authentication, no roles, and no multi-user model.

The user can:
- Invoke `code-diary` with any combination of valid CLI arguments.
- Pass any repo path they have read access to on the local filesystem.
- Specify any output directory they have write access to.
- Choose whether to replace an existing diary entry when prompted.

The tool reads from git repositories and writes to the local filesystem. It does not access any network resource, user account, or external service.

---

## §4 — Data Model

The tool has no database. All persistent output is plain markdown files on disk.

The internal in-memory data structures produced during a run are:

### `Commit`

A single git commit parsed from `git log` output.

| Field | Type | Notes |
|---|---|---|
| `sha` | `string` | Full 40-character SHA |
| `subject` | `string` | First line of commit message |
| `body` | `string` | Remainder of commit message after subject, may be empty |
| `author` | `string` | Author name from git config |
| `timestamp` | `Date` | Commit author date, preserving the timezone offset from git |
| `filesChanged` | `FileStat[]` | Per-file stat entries from `--stat` output |
| `insertions` | `number` | Total lines added across all changed files |
| `deletions` | `number` | Total lines removed across all changed files |

### `FileStat`

One entry from `--stat` output per changed file.

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | Relative path within the repo |
| `insertions` | `number` | Lines added |
| `deletions` | `number` | Lines removed |

### `CategorizedCommit`

A `Commit` extended with derived fields.

| Field | Type | Notes |
|---|---|---|
| `...Commit` | — | All `Commit` fields |
| `category` | `CommitCategory` | Derived from heuristics (see §6) |
| `tilItems` | `string[]` | Zero or more TIL strings extracted from subject/body |
| `daySegment` | `DaySegment` | Derived from commit hour |

### `CommitCategory` (exhaustive enum)

| Value | Trigger |
|---|---|
| `feat` | Subject starts with `feat:` or `feat(` |
| `fix` | Subject starts with `fix:` or `fix(` |
| `refactor` | Subject starts with `refactor:` or `refactor(` |
| `docs` | Subject starts with `docs:` or `docs(` |
| `chore` | Subject starts with `chore:` or `chore(` |
| `test` | Subject starts with `test:` or `test(` |
| `style` | Subject starts with `style:` or `style(` |
| `perf` | Subject starts with `perf:` or `perf(` |
| `build` | Subject starts with `build:` or `build(` |
| `ci` | Subject starts with `ci:` or `ci(` |
| `other` | No recognized prefix; fallback |

Prefix matching is case-insensitive.

### `DaySegment` (exhaustive enum)

Bucketing is based on the commit's local hour (using the timezone offset in the git timestamp).

| Value | Hour range |
|---|---|
| `morning` | 05:00 – 11:59 |
| `afternoon` | 12:00 – 16:59 |
| `evening` | 17:00 – 23:59 |
| `night` | 00:00 – 04:59 |

### `RepoEntry`

All commits from a single repository for the target date, after categorization.

| Field | Type | Notes |
|---|---|---|
| `repoPath` | `string` | Absolute path to the repository |
| `repoName` | `string` | Basename of `repoPath` |
| `commits` | `CategorizedCommit[]` | Sorted ascending by timestamp |

### `DiaryEntry`

The full structured content for one day's diary entry, before markdown rendering.

| Field | Type | Notes |
|---|---|---|
| `date` | `string` | `YYYY-MM-DD` format, in the local timezone of the machine running the tool |
| `repos` | `RepoEntry[]` | One entry per repo, in the order repos were passed on the CLI |
| `tilItems` | `TilItem[]` | All TIL items across all repos, deduplicated by exact text match |

### `TilItem`

| Field | Type | Notes |
|---|---|---|
| `text` | `string` | The TIL content extracted from the commit message (everything after `TIL:` up to end-of-line) |
| `repoName` | `string` | The repo the commit came from |
| `sha` | `string` | Short SHA (7 characters) of the source commit |

---

## §5 — Interfaces

### CLI: `code-diary`

**Command signature**

```
code-diary <repo-path> [<repo-path>...] [--date <YYYY-MM-DD>] [--output <dir>]
```

**Arguments and flags**

| Argument/Flag | Type | Required | Default | Description |
|---|---|---|---|---|
| `<repo-path>` | string (repeatable) | Yes (at least one) | — | Path to a git repository on the local filesystem. May be relative or absolute. Resolved relative to the current working directory. |
| `--date <YYYY-MM-DD>` | string | No | Today's date in the local timezone | The date to generate an entry for. Must match the format `YYYY-MM-DD` exactly. |
| `--output <dir>` | string | No | Current working directory | Directory in which to write `diary/YYYY-MM.md`. Created if it does not exist. |

**Behavior**

1. Validates all repo paths. Each path must resolve to a directory that contains a `.git` entry (file or directory). If any repo path is invalid, the command exits with code 2 and an error message identifying the bad path before performing any git operations.
2. Validates `--date` format if provided. If the value does not match `YYYY-MM-DD` or is not a valid calendar date, exits with code 2.
3. For each repo, queries `git log` for commits on the target date.
4. If the target date entry already exists in the output file, prompts the user (see §2). If the user declines or the process is non-interactive, exits with code 1.
5. Generates the markdown entry and writes it to `<output>/diary/YYYY-MM.md`.
6. Prints a single confirmation line to stdout on success:

   ```
   Wrote diary entry for YYYY-MM-DD to <resolved output path>
   ```

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | Entry written successfully |
| `1` | User declined to replace an existing entry |
| `2` | Any error (bad arguments, invalid path, git failure, file I/O failure) |

**Stdout / stderr**

- All user-facing messages (confirmation, replace prompt) go to stdout.
- All error messages go to stderr.
- No other output is produced.

---

## §6 — Business Rules

### BR-1: Target date determination

If `--date` is not provided, the target date is today's date in the local system timezone. The date is computed once at startup and used consistently for all repos and for the output filename.

### BR-2: Commit filtering

`git log` is invoked with:
- `--no-merges` to exclude merge commits.
- A date range selecting commits whose author date falls on the target date in the author's local timezone (i.e., commits where the date portion of `%ai` matches `YYYY-MM-DD`). The exact filter is `--after="YYYY-MM-DD 00:00:00" --before="YYYY-MM-DD 23:59:59"` using the target date, applied without timezone conversion — the comparison is made against each commit's author timestamp as-is.
- `--stat` to retrieve per-file change counts.
- A `--pretty=format:` that captures SHA, subject, body, author name, and author timestamp.

No other filtering is applied by default. All branches reachable from HEAD are included unless overridden; this is the default `git log` behavior.

### BR-3: Commit categorization

Category is assigned by inspecting the commit subject line:

1. Strip leading whitespace.
2. Check whether the lowercased subject matches `^(feat|fix|refactor|docs|chore|test|style|perf|build|ci)(\(.+\))?:`. Use the matched prefix as the category.
3. If no prefix matches, assign `other`.

If a single commit subject matches multiple prefixes (not possible with this pattern), the first match wins.

### BR-4: TIL extraction

A TIL item is extracted from any commit message (subject or body) that contains the string `TIL:` (case-sensitive). The extracted text is everything after `TIL:` up to the end of the line, trimmed of leading and trailing whitespace.

A single commit may yield multiple TIL items if `TIL:` appears more than once (once in the subject, once or more in the body).

At the `DiaryEntry` level, TIL items from all repos are combined. Items with identical `text` after trimming are deduplicated; the first occurrence (by repo order, then commit timestamp order) is retained.

### BR-5: Time breakdown

Each `CategorizedCommit` is assigned a `DaySegment` based on the hour component of its author timestamp, using the timezone offset embedded in the git timestamp. The mapping is defined in §4.

The diary entry includes a summary table showing commit counts per `DaySegment`, omitting segments with zero commits.

### BR-6: Multi-repo ordering and structure

When multiple repos are passed:
- Repos appear in the diary entry in the order they were specified on the CLI.
- Each repo gets a heading within the daily entry.
- TIL items from all repos are aggregated into a single "Today I Learned" section that appears before the per-repo sections.

### BR-7: Existing entry detection

When writing the diary file, the tool scans the existing file content for a heading that matches the target date. The heading format used is `## YYYY-MM-DD`. If a line matching this pattern is found anywhere in the file, the entry is considered to already exist.

If replacing, the existing entry is removed — from its heading line through the line immediately before the next `## ` heading (or end of file) — and the new entry is written in the same location, preserving all other content in the file.

### BR-8: Output file structure

The monthly file `diary/YYYY-MM.md` has the following structure:

```markdown
# Code Diary — YYYY-MM

## YYYY-MM-DD

### Today I Learned
- Item text (`abc1234`, repo-name)

### repo-name

- `abc1234` feat: add something — feat (+12 / -3)

...additional repos...

---
```

- The file begins with a top-level heading `# Code Diary — YYYY-MM` if it is newly created. If the file already exists, this heading is preserved.
- Each daily entry opens with `## YYYY-MM-DD`.
- A "Today I Learned" section is included only if at least one TIL item exists for the day.
- Within each repo section, commits are listed flat, sorted ascending by timestamp. No branch grouping.
- Each commit line is formatted as: `` - `<short-sha>` <subject> — <category> (+<insertions> / -<deletions>) ``
- A horizontal rule (`---`) separates daily entries.

### BR-9: Empty repo handling

If a repo has no commits on the target date (after filtering), its section is omitted from the diary entry. If all repos have no commits, the entry is not written and the tool prints a message to stdout and exits with code 0.

---

## §7 — Failure Modes

### FM-1: Repo path does not exist

**Scenario**: A path passed as a `<repo-path>` argument does not exist on the filesystem.
**Expected behavior**: The tool exits immediately with code 2 and a stderr message: `Error: path "<path>" does not exist.`
**How to verify**: Run `code-diary /nonexistent/path`, verify exit code 2 and the error message on stderr.

### FM-2: Path exists but is not a git repository

**Scenario**: A path is a valid directory but does not contain `.git`.
**Expected behavior**: Exit code 2, stderr message: `Error: "<path>" is not a git repository (no .git found).`
**How to verify**: Run `code-diary /tmp`, verify exit code 2 and the error message on stderr.

### FM-3: git subprocess fails

**Scenario**: `git log` exits with a non-zero status (e.g., corrupt repo, git not on PATH, permission error).
**Expected behavior**: Exit code 2, stderr message includes the repo path and the git stderr output.
**How to verify**: Run with a repository whose `.git/HEAD` has been corrupted; verify exit code 2 and that stderr includes the repo path.

### FM-4: git not installed

**Scenario**: `git` is not on the system PATH.
**Expected behavior**: Exit code 2, stderr message: `Error: git is not available on PATH.`
**How to verify**: Run with PATH modified to exclude git; verify exit code 2 and the error message.

### FM-5: Output directory is not writable

**Scenario**: The `--output` path or its `diary/` subdirectory cannot be created or written to due to permissions.
**Expected behavior**: Exit code 2, stderr message includes the output path and the OS error.
**How to verify**: Run with an `--output` path owned by root with no write permission; verify exit code 2 and error on stderr.

### FM-6: Invalid --date format

**Scenario**: `--date` is provided but does not match `YYYY-MM-DD` or is not a valid calendar date (e.g., `2026-13-01`, `not-a-date`).
**Expected behavior**: Exit code 2, stderr message: `Error: --date must be a valid date in YYYY-MM-DD format.`
**How to verify**: Run `code-diary . --date 2026-99-99`, verify exit code 2 and error message.

### FM-7: No repo paths provided

**Scenario**: `code-diary` is invoked with no positional arguments.
**Expected behavior**: Exit code 2, usage help printed to stderr.
**How to verify**: Run `code-diary`, verify exit code 2 and usage output on stderr.

### FM-8: Non-interactive replace decline

**Scenario**: An entry for the target date already exists and stdin is not a TTY (command is piped or redirected).
**Expected behavior**: Exit without prompting; exit code 1; no modification to the diary file.
**How to verify**: Run `echo "" | code-diary <repo>` when an entry already exists; verify the file is unchanged and exit code is 1.

### FM-9: Malformed git log output

**Scenario**: `git log` produces output that does not conform to the expected format (e.g., custom `log.showSignature` config corrupts the format).
**Expected behavior**: Exit code 2 with a message identifying the malformed commit block and the repo.
**How to verify**: Mock a git log subprocess that returns a malformed string; verify the parser throws and the CLI exits with code 2.

---

## §8 — Success Criteria

### Automated tests

**Commit parsing**

- `parseGitLog` with a fixture string containing three commits returns an array of three `Commit` objects with correct SHA, subject, body, author, and timestamp fields.
- `parseGitLog` with an empty string returns an empty array.
- `parseGitLog` with a malformed block (missing required field) throws with a message identifying the problem.
- Timestamps with non-UTC offsets (e.g., `+0530`) are preserved as-is and the `DaySegment` is computed using the local hour for that offset.

**Commit categorization**

- `categorizeCommit` correctly assigns `feat` to a subject starting with `feat:`.
- `categorizeCommit` correctly assigns `feat` to a subject starting with `feat(scope):`.
- `categorizeCommit` correctly assigns `other` to a subject with no recognized prefix.
- Matching is case-insensitive: `Fix: ...` assigns `fix`.

**TIL extraction**

- A commit with `TIL: X` in the subject yields one TIL item with text `X`.
- A commit with `TIL: X` in the body yields one TIL item.
- A commit with `TIL: X` in the subject and `TIL: Y` in the body yields two TIL items.
- A commit with no `TIL:` yields zero TIL items.
- Duplicate TIL text across two repos is deduplicated; only the first occurrence is retained.

**Day segment bucketing**

- Hour 05 → `morning`, hour 11 → `morning`, hour 12 → `afternoon`, hour 16 → `afternoon`, hour 17 → `evening`, hour 23 → `evening`, hour 00 → `night`, hour 04 → `night`.

**Markdown generation**

- A `DiaryEntry` with one repo and two commits produces a markdown string that includes the `## YYYY-MM-DD` heading, a per-repo section, and the two commit lines with correct short SHAs and subjects.
- A `DiaryEntry` with one TIL item includes a "Today I Learned" section before the repo sections.
- A `DiaryEntry` with no TIL items does not include a "Today I Learned" heading.
- Commits within a repo section are listed flat (no branch grouping), sorted ascending by timestamp.
- A `DiaryEntry` where all repos have zero commits produces no output (empty string or a sentinel indicating nothing to write).

**Existing entry detection**

- `findExistingEntry` returns `true` when the target date heading is present in the file content.
- `findExistingEntry` returns `false` when the date is absent.
- `replaceEntry` removes the existing entry block and inserts the new block at the same location, leaving all other entries intact.

**File I/O**

- `writeFile` creates intermediate directories if they do not exist.
- `writeFile` overwrites an existing file without error.
- `readFile` throws when the file does not exist.

### Integration tests (manual or semi-automated)

- Run `code-diary <path-to-real-repo>` on a day with known commits. Verify the file `diary/YYYY-MM.md` is created in the current directory with a correctly formatted entry.
- Run the same command a second time without committing anything new. Verify the prompt appears (when interactive) and the file is unchanged after declining.
- Run `code-diary <repo1> <repo2>` with two repos that both have commits on the same day. Verify the output file contains two repo-level sections within the same daily entry.
- Run `code-diary <repo> --output /tmp/test-output`. Verify the file appears at `/tmp/test-output/diary/YYYY-MM.md`.

### Architectural checks (review)

- `cli.ts` contains no business logic beyond argument parsing and orchestrating calls to core modules.
- `git.ts` contains no markdown generation.
- `markdown.ts` contains no filesystem access and no subprocess calls.
- `fileIO.ts` contains no git logic and no markdown generation.
- No module imports from `cli.ts`.
- All runtime dependencies are Node.js built-ins or the TypeScript stdlib. Zero external packages in `dependencies`.

---

## §9 — Constraints

### Scope constraints

- No web UI, server, or background daemon.
- No database. All output is plain markdown files on the local filesystem.
- No AI or LLM summarization. All categorization is deterministic heuristics only.
- No integration with external services (Slack, Jira, GitHub, Linear, or any other).
- No `--watch` mode or scheduled execution. Scheduling is the user's concern.
- No automatic repository discovery. The user must pass explicit repo paths.
- No support for non-git version control systems.
- No configuration file in this version. All input is via CLI arguments.
- No diffing or merging of existing diary files beyond the single-entry replace flow. The tool appends or replaces one entry at a time.
- The only interactive prompt is the replace confirmation. No TUI, no pager, no other interactive modes.

### Technical constraints

- Inherited from `guidelines.md`: TypeScript strict mode, `noUncheckedIndexedAccess`, ESM only, `.js` extensions in imports, named exports only, no default exports, zero runtime dependencies, `spawnSync` for git subprocesses.
- The tool must run correctly on Node.js 18 LTS or later. No Node.js version-specific APIs beyond that baseline.
- Timezone handling: commit timestamps are used as-is from git output (git provides the UTC offset in `%ai` format). No normalization to UTC or system timezone is performed. Day-segment bucketing uses the local hour from the embedded offset.
- The parser and categorizer are pure functions. They accept strings and return typed data. They must not access the filesystem or spawn subprocesses.

### Operational constraints

- The tool runs locally. There is no deployment, no cloud infrastructure, and no network access required.
- The tool is distributed as a compiled npm package. `dist/` is committed to the repository and is the artifact users run.

---

## §10 — Open Questions

### Q1 — Resolved

Branch grouping was dropped. Commits are listed flat within each repo section, sorted ascending by timestamp. No branch name is displayed or resolved.

### Q2: Handling repos with a large number of commits on the target date

**Question**: If a repo has hundreds of commits on a single day (e.g., a squash-heavy workflow or an automated commit pipeline), the diary entry could be extremely long. Should there be a cap on the number of commits displayed per repo, with a "and N more commits" note?

**Why deferred**: Edge case for the initial version. The appetite is small; adding truncation logic is extra complexity. Normal developer workflows produce a handful of commits per day.

### Q3: `--output` default behavior in relation to the repo paths

**Question**: When multiple repo paths are provided, should the output directory default to the first repo path's parent, the current working directory, or something else? The current spec defaults to the current working directory.

**Why deferred**: The current working directory default is the simplest and most predictable behavior. This question is only relevant if users find it surprising in practice.

### Q4: git log date range boundary behavior

**Question**: The filter `--after="YYYY-MM-DD 00:00:00" --before="YYYY-MM-DD 23:59:59"` interprets the boundary times in the committer's local timezone as preserved in the git log. Commits made exactly at `23:59:59` may or may not be included depending on git's boundary semantics (`--after` is exclusive, `--before` is inclusive in some versions). Is this sufficient, or should a different approach (e.g., `--since` / `--until` with explicit times) be used?

**Why deferred**: Boundary precision at exact second boundaries is unlikely to matter in practice. This should be validated during implementation against the actual git version behavior and corrected if needed without changing the spec's intent.
