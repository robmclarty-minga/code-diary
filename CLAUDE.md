# code-diary

Zero-dependency Node.js CLI that reads git log output from one or more repos, categorizes commits for a given date, and appends a structured markdown entry to a monthly diary file.

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
  cli.ts            # Argument parsing, validation, orchestration
  git.ts            # git log subprocess + pure parser
  categorize.ts     # Commit categorization, TIL extraction, day segments
  markdown.ts       # Markdown generation, entry detection/replacement
  fileIO.ts         # Read/write/exists wrappers around Node fs
  types/
    diary.ts        # All shared TypeScript types
  __tests__/        # Colocated unit tests (*.test.ts)
test/
  fixtures/         # Shared test fixtures (gitLog.txt, diaryMonth.md)
dist/               # Compiled output (committed)
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

## Git Commits

Conventional commits: `type(scope): summary`
Types: feat, fix, refactor, test, docs, chore
