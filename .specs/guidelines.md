# Guidelines — code-diary

## Stack

- **Runtime**: Node.js (ESM)
- **Language**: TypeScript with `strict: true`, `noUncheckedIndexedAccess`
- **Standard library**: `child_process` (built-in) for git operations
- **No runtime dependencies** — zero external packages in production
- **Dev tools**: TypeScript compiler (`tsc`), Vitest (test runner), linter (project-configured)
- **Distribution**: Compiled JS via `tsc`, exposed through `bin` field in `package.json`

## Architecture

The project is a flat collection of small, focused modules. There are no layers in the traditional MVC sense — each module owns one responsibility and exposes a narrow set of named functions.

Dependency direction flows inward: CLI entry point imports from core modules; core modules do not import from the CLI. Modules communicate by passing values, not by sharing mutable state.

Typical module layout:

```text
src/
  cli.ts               # Entry point; parses argv, calls core functions
  git.ts               # git log parsing, child_process wrappers
  markdown.ts          # Markdown generation from structured data
  fileIO.ts            # File read/write operations
  types/
    diary.ts           # TypeScript types and validation schemas
```

Each module exports a small number of focused functions. No module should need to know how another module implements its internals — only its exported interface.

## Conventions

### Naming

| Thing | Style | Example |
|---|---|---|
| Files | camelCase | `gitLog.ts`, `markdownGen.ts` |
| Functions | camelCase | `parseCommits`, `formatEntry` |
| Types / interfaces | PascalCase | `DiaryEntry`, `CommitRange` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_DATE_FORMAT`, `MAX_LINE_LENGTH` |

### Imports

Use `.js` extensions on all relative imports (required for ESM):

```typescript
// correct
import { parseCommits } from "./gitLog.js";
import type { DiaryEntry } from "./types/diary.js";

// wrong
import { parseCommits } from "./gitLog";
import { DiaryEntry } from "./types/diary.js"; // type-only import must use `import type`
```

### Exports

Named exports only. No default exports.

```typescript
// correct
export const parseCommits = (raw: string): Commit[] => { ... };
export type { Commit };

// wrong
export default function parseCommits() { ... }
```

### Functions

Prefer factory functions and closures over classes. When a function needs shared configuration, pass it explicitly rather than storing it on an object.

```typescript
// correct — factory function, explicit dependencies
export const makeGitReader = (repoPath: string) => {
  const readLog = (range: string): string => { ... };
  const readDiff = (sha: string): string => { ... };
  return { readLog, readDiff };
};

// wrong — class with instance state
export class GitReader {
  constructor(private repoPath: string) {}
  readLog(range: string) { ... }
}
```

### Style

- Semicolons always
- No implicit `any` — all parameters must be explicitly typed
- Prefer `const` over `let`; avoid `var`
- Prefer early returns over deeply nested conditionals

### Error handling

Throw at system boundaries (e.g., when a git subprocess fails, when a required file is missing). Do not swallow errors silently. Wrap low-level errors with context before re-throwing:

```typescript
// correct
try {
  const result = spawnSync("git", ["log", range], { cwd: repoPath });
  if (result.status !== 0) {
    throw new Error(`git log failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString();
} catch (err) {
  throw new Error(`Failed to read git log at ${repoPath}: ${String(err)}`);
}

// wrong — silent swallow
try {
  return spawnSync("git", ["log", range]).stdout.toString();
} catch {
  return "";
}
```

## Patterns

### Git log parsing

Git subprocess calls are synchronous (`spawnSync`). Raw stdout is passed to a pure parser function that returns typed data. The subprocess call and the parser are kept in separate functions so parsing logic is testable without spawning a process.

```typescript
// src/gitLog.ts
import { spawnSync } from "child_process";
import type { Commit } from "./types/diary.js";

const GIT_LOG_SEPARATOR = "---COMMIT---";

export const readGitLog = (repoPath: string, range: string): string => {
  const result = spawnSync(
    "git",
    ["log", range, `--pretty=format:%H%n%s%n%an%n%ai%n${GIT_LOG_SEPARATOR}`],
    { cwd: repoPath, encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(`git log failed (${range}): ${result.stderr}`);
  }

  return result.stdout;
};

export const parseGitLog = (raw: string): Commit[] => {
  return raw
    .split(GIT_LOG_SEPARATOR)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [sha, subject, author, date] = block.split("\n");
      if (!sha || !subject || !author || !date) {
        throw new Error(`Malformed commit block: ${block}`);
      }
      return { sha, subject, author, date: new Date(date) };
    });
};
```

### Markdown generation

Markdown is produced by pure functions that take structured data and return strings. No template engines. String concatenation or array joins are fine.

```typescript
// src/markdown.ts
import type { DiaryEntry } from "./types/diary.js";

export const formatDiaryEntry = (entry: DiaryEntry): string => {
  const lines: string[] = [
    `## ${entry.date} — ${entry.title}`,
    "",
    `**Author:** ${entry.author}`,
    "",
    "### Commits",
    "",
    ...entry.commits.map((c) => `- \`${c.sha.slice(0, 7)}\` ${c.subject}`),
    "",
  ];

  return lines.join("\n");
};

export const formatDiaryDocument = (entries: DiaryEntry[]): string => {
  const header = "# Code Diary\n\n";
  return header + entries.map(formatDiaryEntry).join("\n---\n\n");
};
```

### File I/O

File operations are isolated in their own module. Functions accept and return strings; callers decide what to do with the result. Errors propagate up — no silent fallbacks to empty strings.

```typescript
// src/fileIO.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export const readFile = (filePath: string): string => {
  return readFileSync(filePath, "utf8");
};

export const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
};
```

### Type definitions

Types live in `src/types/`. Prefer `type` aliases over `interface` unless declaration merging is needed. Export types with `export type`.

```typescript
// src/types/diary.ts

export type Commit = {
  sha: string;
  subject: string;
  author: string;
  date: Date;
};

export type DiaryEntry = {
  title: string;
  date: string;
  author: string;
  commits: Commit[];
};

export type DiaryConfig = {
  repoPath: string;
  outputPath: string;
  dateRange: string;
};
```

## Testing

- **Framework**: Vitest
- **File location**: `__tests__/` directories colocated next to the source file under test
  - Example: `src/gitLog.ts` is tested in `src/__tests__/gitLog.test.ts`
- **Naming**: `*.test.ts`
- **Import style**: import from `vitest` explicitly, not via globals

```typescript
// src/__tests__/gitLog.test.ts
import { describe, it, expect } from "vitest";
import { parseGitLog } from "../gitLog.js";

describe("parseGitLog", () => {
  it("parses a single commit block", () => {
    const raw = [
      "abc1234",
      "feat: add diary generation",
      "Jane Dev",
      "2026-03-30T10:00:00Z",
      "---COMMIT---",
    ].join("\n");

    const commits = parseGitLog(raw);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.sha).toBe("abc1234");
    expect(commits[0]?.subject).toBe("feat: add diary generation");
  });

  it("returns an empty array for empty input", () => {
    expect(parseGitLog("")).toEqual([]);
  });
});
```

**What to test:**
- Git log parsing logic (pure function — easy to unit test with fixture strings)
- Markdown generation (pure function — assert on output strings)
- File I/O helpers (use `tmp` paths or mock `fs` with `vi.mock`)

**What not to test:**
- The git subprocess itself (it is a system dependency)
- The CLI argument parsing wiring (test the functions it calls instead)

**Shared fixtures**: place reusable test data strings or objects in `test/fixtures/`.

## Check Command

```bash
npm run typecheck && npm run lint && npm run test
```

## Infrastructure

- **Distribution**: Published as an npm package. `bin` field in `package.json` points to the compiled CLI entry point in `dist/`.
- **Build**: `tsc` compiles `src/` to `dist/`. The `dist/` directory is committed to the repository — it is the artifact that users run.
- **No server, no database, no cloud dependencies.** The tool runs locally against a git repository on disk.
- **Environment**: No environment variables required for core operation. Any user configuration (repo path, output path) is passed via CLI arguments or a config file read at startup.
- **CI**: Run the check command (`npm run typecheck && npm run lint && npm run test`) on every pull request. Build (`tsc`) should also be verified to ensure `dist/` can be regenerated cleanly.
