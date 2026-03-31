# Plan: code-diary

**Spec**: `.specs/code-diary/spec.md`
**Status**: Draft

---

## S1 — Technical Summary

`code-diary` is a zero-dependency Node.js CLI written in TypeScript (strict ESM) that reads `git log` output from one or more local repositories and appends a structured markdown entry to a monthly diary file. The implementation is a flat collection of pure, focused modules: `cli.ts` orchestrates argument parsing and top-level flow; `git.ts` shells out via `spawnSync` and owns raw log parsing; `categorize.ts` applies deterministic heuristics to produce `CategorizedCommit` values; `markdown.ts` renders `DiaryEntry` data to a markdown string; `fileIO.ts` handles all filesystem reads and writes; and `types/diary.ts` holds all shared TypeScript types. The CLI entry point is compiled to `dist/cli.js` via `tsc` and exposed through the `bin` field in `package.json`. There is no server, no database, and no network access.

---

## S2 — Architecture

### Component diagram

```
┌─────────────────────────────────────────────────────┐
│                      cli.ts                         │
│  - parse argv                                       │
│  - validate inputs                                  │
│  - orchestrate: git → categorize → markdown → file  │
│  - handle replace prompt                            │
└──────┬────────────────────────────────────┬─────────┘
       │                                    │
       ▼                                    ▼
┌─────────────┐                    ┌─────────────────┐
│   git.ts    │                    │    fileIO.ts     │
│ - spawnSync │                    │ - readFile       │
│ - readGitLog│                    │ - writeFile      │
│ - parseGitLog                    │ - fileExists     │
└──────┬──────┘                    └─────────────────┘
       │
       ▼
┌──────────────────┐
│  categorize.ts   │
│ - categorizeCommit│
│ - extractTilItems│
│ - assignDaySegment
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  markdown.ts     │
│ - formatDiaryEntry
│ - findExistingEntry
│ - replaceEntry   │
└──────────────────┘

┌──────────────────┐
│  types/diary.ts  │
│  (shared types)  │
└──────────────────┘
```

### Component responsibilities

| Component | Responsibility | Key boundary |
|---|---|---|
| `cli.ts` | Argument parsing, input validation, top-level orchestration, replace prompt, stdout/stderr output, exit codes | Does not contain business logic beyond wiring |
| `git.ts` | `spawnSync` calls to `git log`, raw stdout parsing into `Commit[]` | No markdown, no filesystem access beyond the subprocess call |
| `categorize.ts` | Pure heuristic functions: assign `CommitCategory`, extract `TilItem[]`, assign `DaySegment` | No subprocesses, no filesystem |
| `markdown.ts` | Render `DiaryEntry` to a markdown string; detect and splice existing entries in file content | No subprocess calls, no filesystem access |
| `fileIO.ts` | `readFileSync` / `writeFileSync` / `mkdirSync` wrappers | No git logic, no markdown logic |
| `types/diary.ts` | TypeScript type aliases for all shared data structures | No runtime logic |

### Integration with existing systems

This is a greenfield tool. It integrates with the local filesystem (read/write) and with the `git` binary on the system PATH via `spawnSync`. No other system integration.

---

## S3 — Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Git subprocess API | `spawnSync` (synchronous) | The tool is a short-lived CLI; async adds no benefit and complicates control flow |
| Git log format | Custom `--pretty=format:` with a unique commit separator | Allows reliable block-based parsing without ambiguity from newlines in commit bodies |
| `--stat` parsing | Parse the summary line from `--stat` output (insertions/deletions totals) plus individual file lines | `--stat` provides enough data for heuristics; full `--diff` is out of scope per pitch |
| Date-range filter | `--after="YYYY-MM-DD 00:00:00" --before="YYYY-MM-DD 23:59:59"` with `--no-merges` | Matches spec BR-2; boundary behavior (Q4) is validated at runtime with real git |
| Timezone handling | Use git's embedded UTC offset (`%ai`) without normalization | Spec BR-5 and pitch "rabbit holes" section explicitly prohibit normalization |
| Commit separator | A sentinel string (`---COMMIT---`) appended to each commit record via `--pretty` | Same pattern as guidelines; isolates blocks robustly against body newlines |
| Interactive prompt | `readline` from Node.js stdlib | Zero-dep constraint; `readline` handles TTY detection natively |
| TTY detection | `process.stdin.isTTY` | Spec FM-8: non-interactive environments skip the prompt and exit 1 |
| Module format | ESM with `.js` extensions | Required by guidelines and `package.json` `"type": "module"` |
| Build output | `tsc` to `dist/`, committed to repo | Matches guidelines infrastructure; `dist/` is the distributed artifact |
| Test runner | Vitest | Project standard per guidelines |

No divergences from guidelines. No rejected alternatives for choices that are directly inherited from guidelines.

---

## S4 — Data Access Patterns

This feature does not interact with a database. All "data access" is filesystem reads and writes of plain text files plus synchronous git subprocess calls.

### Git log query pattern

`git log` is called once per repository with a single invocation that captures everything needed in one pass. The format string is constructed to produce self-delimiting commit blocks:

```typescript
// src/git.ts
import { spawnSync } from "child_process";
import type { Commit } from "./types/diary.js";

const COMMIT_SEPARATOR = "---COMMIT---";

const GIT_FORMAT = [
  "%H",   // full SHA
  "%s",   // subject
  "%b",   // body (may be empty, may contain newlines)
  "---BODY_END---",
  "%an",  // author name
  "%ai",  // author date, ISO 8601 with offset
  COMMIT_SEPARATOR,
].join("%n");

export const readGitLog = (repoPath: string, date: string): string => {
  const result = spawnSync(
    "git",
    [
      "log",
      "--no-merges",
      `--after=${date} 00:00:00`,
      `--before=${date} 23:59:59`,
      "--stat",
      `--pretty=format:${GIT_FORMAT}`,
    ],
    { cwd: repoPath, encoding: "utf8" },
  );

  if (result.error) {
    // spawnSync sets result.error when the binary is not found
    throw new Error(`git is not available on PATH.`);
  }

  if (result.status !== 0) {
    throw new Error(
      `git log failed at ${repoPath}: ${result.stderr}`,
    );
  }

  return result.stdout;
};
```

### File read/write pattern

Monthly diary files are read once (to check for an existing entry) and written once (to append or replace). Intermediate directories are created on write:

```typescript
// src/fileIO.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export const readFile = (filePath: string): string => {
  return readFileSync(filePath, "utf8");
};

export const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
};

export const fileExists = (filePath: string): boolean => {
  return existsSync(filePath);
};
```

### Repo validation pattern

Validation happens before any git operations, failing fast on the first bad path:

```typescript
// src/cli.ts (validation fragment)
import { existsSync, statSync } from "fs";
import { resolve, join } from "path";

const validateRepoPaths = (paths: string[]): void => {
  for (const p of paths) {
    const abs = resolve(p);
    if (!existsSync(abs)) {
      process.stderr.write(`Error: path "${p}" does not exist.\n`);
      process.exit(2);
    }
    if (!existsSync(join(abs, ".git"))) {
      process.stderr.write(
        `Error: "${p}" is not a git repository (no .git found).\n`,
      );
      process.exit(2);
    }
  }
};
```

---

## S5 — Interface Implementation

The sole interface is the `code-diary` CLI. There is no REST API, MCP tool, or server.

### Argument parsing

Node.js `process.argv` is parsed manually (no third-party parser). Positional arguments are repo paths; `--date` and `--output` are named flags:

```typescript
// src/cli.ts (argv parsing fragment)
export type CliArgs = {
  repoPaths: string[];
  date: string;
  outputDir: string;
};

export const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2); // strip node + script path
  const repoPaths: string[] = [];
  let date: string | undefined;
  let outputDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--date" && args[i + 1]) {
      date = args[++i]!;
    } else if (arg === "--output" && args[i + 1]) {
      outputDir = args[++i]!;
    } else if (arg !== undefined && !arg.startsWith("--")) {
      repoPaths.push(arg);
    }
  }

  if (repoPaths.length === 0) {
    process.stderr.write(
      "Usage: code-diary <repo-path> [<repo-path>...] [--date YYYY-MM-DD] [--output <dir>]\n",
    );
    process.exit(2);
  }

  // Default to today's date in local timezone
  const resolvedDate = date ?? new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  if (!isValidDate(resolvedDate)) {
    process.stderr.write(
      "Error: --date must be a valid date in YYYY-MM-DD format.\n",
    );
    process.exit(2);
  }

  return {
    repoPaths,
    date: resolvedDate,
    outputDir: outputDir ?? process.cwd(),
  };
};
```

### Top-level orchestration

The `run` function in `cli.ts` owns the complete execution flow:

```typescript
// src/cli.ts (run function)
import { resolve, join } from "path";
import { createInterface } from "readline";
import { readGitLog, parseGitLog } from "./git.js";
import { buildRepoEntry } from "./categorize.js";
import { formatDiaryEntry, findExistingEntry, replaceEntry, appendEntry } from "./markdown.js";
import { readFile, writeFile, fileExists } from "./fileIO.js";

export const run = async (argv: string[]): Promise<void> => {
  const { repoPaths, date, outputDir } = parseArgs(argv);
  const absRepoPaths = repoPaths.map((p) => resolve(p));

  validateRepoPaths(absRepoPaths);

  // Collect repo entries
  const repoEntries = absRepoPaths
    .map((repoPath) => {
      const raw = readGitLog(repoPath, date);
      const commits = parseGitLog(raw);
      return buildRepoEntry(repoPath, commits);
    })
    .filter((entry) => entry.commits.length > 0);

  if (repoEntries.length === 0) {
    process.stdout.write(`No commits found for ${date}.\n`);
    return;
  }

  const diaryEntry = buildDiaryEntry(date, repoEntries);
  const markdown = formatDiaryEntry(diaryEntry);

  const outputPath = join(resolve(outputDir), "diary", `${date.slice(0, 7)}.md`);
  const fileContent = fileExists(outputPath) ? readFile(outputPath) : null;

  if (fileContent !== null && findExistingEntry(fileContent, date)) {
    if (!process.stdin.isTTY) {
      process.exit(1);
    }

    const confirmed = await promptReplace(date);
    if (!confirmed) {
      process.exit(1);
    }

    const updated = replaceEntry(fileContent, date, markdown);
    writeFile(outputPath, updated);
  } else {
    const updated = appendEntry(fileContent, date, markdown);
    writeFile(outputPath, updated);
  }

  process.stdout.write(`Wrote diary entry for ${date} to ${outputPath}\n`);
};
```

### Replace prompt

```typescript
// src/cli.ts (prompt fragment)
const promptReplace = (date: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      `An entry for ${date} already exists. Replace it? [y/N] `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y");
      },
    );
  });
};
```

### Error handling in CLI

All thrown errors from `git.ts` and `fileIO.ts` propagate up to a top-level catch in the entry point:

```typescript
// src/index.ts (entry point)
import { run } from "./cli.js";

run(process.argv).catch((err: unknown) => {
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(2);
});
```

---

## S6 — File Structure

```
code-diary/
├── src/
│   ├── index.ts                  # Entry point: calls run(), top-level catch → exit 2
│   ├── cli.ts                    # parseArgs, validateRepoPaths, run, promptReplace
│   ├── git.ts                    # readGitLog (spawnSync), parseGitLog (pure parser)
│   ├── categorize.ts             # categorizeCommit, extractTilItems, assignDaySegment, buildRepoEntry, buildDiaryEntry
│   ├── markdown.ts               # formatDiaryEntry, findExistingEntry, replaceEntry, appendEntry
│   ├── fileIO.ts                 # readFile, writeFile, fileExists
│   ├── types/
│   │   └── diary.ts              # All shared types: Commit, FileStat, CategorizedCommit,
│   │                             #   CommitCategory, DaySegment, RepoEntry, DiaryEntry, TilItem
│   └── __tests__/
│       ├── git.test.ts           # Tests for parseGitLog (pure parser only)
│       ├── categorize.test.ts    # Tests for categorizeCommit, extractTilItems, assignDaySegment
│       ├── markdown.test.ts      # Tests for formatDiaryEntry, findExistingEntry, replaceEntry
│       ├── fileIO.test.ts        # Tests for readFile, writeFile (using tmp paths or vi.mock)
│       └── cli.test.ts           # Tests for parseArgs, validateRepoPaths logic
├── test/
│   └── fixtures/
│       ├── gitLog.txt            # Raw git log output fixture for parser tests
│       └── diaryMonth.md         # Existing diary file fixture for entry detection tests
├── dist/                         # Compiled output (committed to repo)
│   ├── index.js
│   ├── cli.js
│   ├── git.js
│   ├── categorize.js
│   ├── markdown.js
│   ├── fileIO.js
│   └── types/
│       └── diary.js
├── package.json                  # name, version, bin: { "code-diary": "./dist/index.js" }, type: "module"
├── tsconfig.json                 # strict, noUncheckedIndexedAccess, ESM, target ES2022
└── vitest.config.ts              # test configuration
```

### Key structural notes

- `src/index.ts` is the sole entry point. It contains no logic beyond calling `run()` and catching errors. This keeps `cli.ts` importable in tests without triggering side effects.
- `src/__tests__/` is colocated with `src/` per guidelines. All test files are named `*.test.ts`.
- `test/fixtures/` holds reusable raw strings used across multiple test files.
- `dist/` mirrors `src/` structure and is committed.

---

## S7 — Error Handling Strategy

### Error propagation model

Errors are thrown at system boundaries and propagate up to the top-level catch in `src/index.ts`, which writes to stderr and exits with code 2. The only exception is deliberate `process.exit()` calls in `cli.ts` for validation errors, where the error message is written to stderr before exiting.

```
system boundary (git.ts, fileIO.ts)
  → throws Error with context
    → propagates through categorize / markdown (pure; no throws from these)
      → caught by run() caller in index.ts
        → stderr + exit(2)
```

### Error classification

| Source | Handling |
|---|---|
| `spawnSync` binary not found (`result.error`) | Throw `Error: git is not available on PATH.` |
| `spawnSync` non-zero exit | Throw with repo path + git stderr |
| Malformed git log block | Throw from `parseGitLog` with block content + repo path (caller wraps with repo context) |
| File read failure (`readFileSync` throws) | Propagate; index.ts catch writes stderr |
| File write / mkdir failure | Propagate; index.ts catch writes stderr |
| Invalid argv (bad path, bad date, no repos) | `process.stderr.write` + `process.exit(2)` directly in `cli.ts` |

### Wrapping pattern

Low-level errors are wrapped with context before re-throwing, following the guidelines pattern:

```typescript
// src/git.ts
export const readGitLog = (repoPath: string, date: string): string => {
  try {
    const result = spawnSync("git", [...], { cwd: repoPath, encoding: "utf8" });
    if (result.error) throw new Error("git is not available on PATH.");
    if (result.status !== 0) {
      throw new Error(`git log failed: ${result.stderr}`);
    }
    return result.stdout;
  } catch (err) {
    throw new Error(`Failed to read git log at ${repoPath}: ${String(err)}`);
  }
};
```

### Logging

This is a local CLI tool. There is no logging infrastructure. All user-facing output goes to stdout (success messages, prompts). All error output goes to stderr. No log files are written.

---

## S8 — Testing Strategy

### What is tested

| Module | What is tested | Why |
|---|---|---|
| `git.ts` — `parseGitLog` | All spec §8 parsing cases: three commits, empty string, malformed block, non-UTC offsets | Pure function; fixture-driven; fully deterministic |
| `categorize.ts` — `categorizeCommit` | All prefix variants, scoped prefix, `other` fallback, case-insensitivity | Pure function |
| `categorize.ts` — `extractTilItems` | Subject TIL, body TIL, multiple TIL, no TIL, dedup across repos | Pure function |
| `categorize.ts` — `assignDaySegment` | All 8 boundary hours from spec §8 | Pure function |
| `markdown.ts` — `formatDiaryEntry` | Correct headings, commit lines, TIL section presence/absence, flat sort, empty entry | Pure function |
| `markdown.ts` — `findExistingEntry` | Heading present → true, heading absent → false | Pure function on string |
| `markdown.ts` — `replaceEntry` | Removes old block, inserts new block, preserves other entries | Pure function on string |
| `fileIO.ts` — `writeFile` | Creates intermediate dirs, overwrites existing file | Uses actual tmp paths or `vi.mock("fs")` |
| `fileIO.ts` — `readFile` | Throws when file does not exist | Same |
| `cli.ts` — `parseArgs` | Missing repos → exit 2, bad `--date` → exit 2, defaults applied | Tested by mocking `process.exit` |

### What is not tested

| Omission | Reason |
|---|---|
| `readGitLog` (subprocess call) | System dependency; not unit-testable without spawning real git |
| `run()` end-to-end in unit tests | Integration concern; covered by manual integration test plan in spec §8 |
| `promptReplace` | Requires TTY; tested manually |
| The entry point `index.ts` | Contains no logic; wiring only |

### Test file organization

```
src/__tests__/
  git.test.ts          # parseGitLog only
  categorize.test.ts   # categorizeCommit, extractTilItems, assignDaySegment
  markdown.test.ts     # formatDiaryEntry, findExistingEntry, replaceEntry
  fileIO.test.ts       # readFile, writeFile
  cli.test.ts          # parseArgs
```

### Fixtures

`test/fixtures/gitLog.txt` — a raw git log string with three commits including one with a multi-line body, one with a TIL item, and one with a non-UTC offset (e.g., `+0530`). Used in `git.test.ts` and `categorize.test.ts`.

`test/fixtures/diaryMonth.md` — a monthly diary file with two existing entries. Used in `markdown.test.ts` for `findExistingEntry` and `replaceEntry` tests.

### Example test

```typescript
// src/__tests__/categorize.test.ts
import { describe, it, expect } from "vitest";
import { assignDaySegment } from "../categorize.js";

describe("assignDaySegment", () => {
  it.each([
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [23, "evening"],
    [0, "night"],
    [4, "night"],
  ])("hour %i → %s", (hour, expected) => {
    // Build an ISO timestamp at the given hour in UTC+0000
    const timestamp = new Date(`2026-03-30T${String(hour).padStart(2, "0")}:00:00+00:00`);
    expect(assignDaySegment(timestamp, "+0000")).toBe(expected);
  });
});
```

### vitest configuration

Standard vitest config; no browser mode needed. Coverage via v8 provider excluding `dist/`, `test/`, and `src/types/`:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      exclude: ["dist/**", "test/**", "src/types/**"],
    },
  },
});
```

---

## S9 — Deployment and Infrastructure

### Build

```bash
npm run build   # tsc → dist/
```

`tsconfig.json` targets ES2022, outputs to `dist/`, includes declaration files. `dist/` is committed to the repository and is the artifact that gets published and run.

### Distribution

Published as an npm package. `package.json`:

```json
{
  "name": "code-diary",
  "type": "module",
  "bin": {
    "code-diary": "./dist/index.js"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "...",
    "vitest": "...",
    "@vitest/coverage-v8": "..."
  }
}
```

The `dist/index.js` file must have a shebang: `#!/usr/bin/env node`.

### npm scripts

```json
{
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "...",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  }
}
```

### Environment variables

None required. All configuration is passed via CLI arguments.

### Health checks and monitoring

N/A — local CLI tool; no server, no monitoring infrastructure.

### CI

Run `npm run typecheck && npm run lint && npm test` on every pull request. Also run `npm run build` to verify `dist/` can be regenerated cleanly.

---

## S10 — Migration Path

N/A — greenfield feature, no migration concerns.

---

## Build phases for trellis-exec

The implementation maps cleanly to four phases:

### Phase 1 — Project scaffold and types

Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`. Define all types in `src/types/diary.ts`. Create empty module stubs (`cli.ts`, `git.ts`, `categorize.ts`, `markdown.ts`, `fileIO.ts`, `src/index.ts`) with correct exports so the project typechecks. Create `test/fixtures/` directory with initial fixture files. Verify: `npm run typecheck` passes.

### Phase 2 — Core data pipeline (git + categorize)

Implement `git.ts` (`readGitLog`, `parseGitLog`) and `categorize.ts` (`categorizeCommit`, `extractTilItems`, `assignDaySegment`, `buildRepoEntry`, `buildDiaryEntry`). Write all unit tests for these modules. Verify: `npm test` passes for `git.test.ts` and `categorize.test.ts`.

### Phase 3 — Markdown and file I/O

Implement `markdown.ts` (`formatDiaryEntry`, `findExistingEntry`, `replaceEntry`, `appendEntry`) and `fileIO.ts` (`readFile`, `writeFile`, `fileExists`). Write unit tests for both modules. Verify: `npm test` passes for `markdown.test.ts` and `fileIO.test.ts`.

### Phase 4 — CLI wiring and end-to-end

Implement `cli.ts` (`parseArgs`, `validateRepoPaths`, `run`, `promptReplace`) and `src/index.ts`. Write `cli.test.ts` for `parseArgs`. Run `npm run build` to produce `dist/`. Manually verify the integration test scenarios from spec §8. Verify: `npm run typecheck && npm run lint && npm test` all pass; `node dist/index.js` runs against a real repo.
