# code-diary

Zero-dependency Node.js CLI that reads git log output from one or more repos, categorizes commits for a given date, and writes a structured markdown entry to a daily diary file. Includes an `aggregate` subcommand that generates weekly and monthly reports from daily entries.

## Dev Commands

```bash
npm run build      # tsc → dist/
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
```

## Directory Layout

```
src/
  index.ts          # CLI entry point (shebang, calls run())
  cli.ts            # Argument parsing, validation, orchestration, subcommand routing
  config.ts         # Settings loader (~/.code-diary/settings.json)
  git.ts            # git log subprocess + pure parser
  categorize.ts     # Commit categorization, TIL extraction, day segments
  markdown.ts       # Markdown generation, daily file formatting
  fileIO.ts         # Read/write/exists wrappers around Node fs
  parseDiary.ts     # Parse daily diary markdown back into structured data
  aggregate.ts      # Aggregation logic (weekly/monthly report generation)
  aggregateCli.ts   # Aggregate subcommand CLI parsing + orchestration
  types/
    diary.ts        # Shared types (Commit, DiaryEntry, Settings, etc.)
    aggregate.ts    # Aggregate-specific types (ParsedDiaryDay, WeekDescriptor)
  __tests__/        # Colocated unit tests (*.test.ts)
test/
  fixtures/         # Shared test fixtures (gitLog.txt, dailyDiary.md, etc.)
dist/               # Compiled output (committed)
.claude/
  skills/
    commit-til/     # Conventional commit + TIL extraction skill
```

## Code Conventions

- **Language**: TypeScript, strict mode, `noUncheckedIndexedAccess`
- **Module system**: ESM (`type: "module"`). Use `.js` extensions on all relative imports.
- **Exports**: Named only. No default exports. Use `export type` for type-only exports.
- **Naming**: camelCase files/functions, PascalCase types, SCREAMING_SNAKE constants
- **Style**: Semicolons always. `const` over `let`. Early returns over nesting.
- **Functions**: Prefer factory functions and closures over classes.
- **Error handling**: Throw at boundaries with context. No silent swallowing.
- **Dependencies**: Zero runtime deps. Only Node.js built-ins.

## Testing

- **Framework**: Vitest (import `describe`, `it`, `expect` explicitly)
- **Location**: `src/__tests__/*.test.ts`
- **Fixtures**: `test/fixtures/`
- **What to test**: Pure functions (parsing, categorization, markdown gen, file I/O)
- **What not to test**: git subprocess itself, CLI wiring

## Config

Optional settings file at `~/.code-diary/settings.json`:
```json
{
  "output-dir": "~/diary",
  "repos": ["~/Projects/api", "~/Projects/web"]
}
```

## Output Structure

```
<output-dir>/
  daily/              # Daily entries (code-diary-YYYY-MM-DD.md)
  weekly/             # Weekly reports (code-diary-YYYY-MM-W#.md)
  monthly/            # Monthly reports (code-diary-YYYY-MM.md)
```

## Git Commits

Conventional commits: `type(scope): summary`
Types: feat, fix, refactor, test, docs, chore, style, perf, build, ci
