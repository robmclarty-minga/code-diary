# code-diary

Automatic developer diary. Run `code-diary` once a day (or multiple times — it's safe to re-run) and it reads your git history, categorizes your commits, extracts TILs, and writes structured daily, weekly, and monthly markdown reports. Zero dependencies beyond Node.js and git.

## Quick Start

1. **Install**

   ```bash
   git clone <repo-url> && cd code-diary
   npm install && npm run build
   npm link   # makes `code-diary` available everywhere
   ```

2. **Configure** (`~/.code-diary/settings.json`)

   ```json
   {
     "output-dir": "~/diary",
     "repos": ["~/Projects/api", "~/Projects/web"]
   }
   ```

3. **Run**

   ```bash
   code-diary
   ```

That's it. Every time you run `code-diary`, it:

- Creates (or updates) today's daily entry from your configured repos
- Merges new commits into the existing file if you've already run it today
- Regenerates weekly and monthly aggregate reports for the current month

All artifacts land in your output directory:

```
diary/
  daily/    # code-diary-YYYY-MM-DD.md
  weekly/   # code-diary-YYYY-MM-W#.md
  monthly/  # code-diary-YYYY-MM.md
```

## Automate It

The command is designed to run unattended. A single invocation handles the full pipeline, so only one scheduled job is needed:

```bash
# crontab example: run at 6pm every weekday
0 18 * * 1-5 /usr/local/bin/code-diary
```

Running multiple times for the same date is always safe — new commits merge in and reports regenerate from the latest data.

## What You Get

Each daily entry includes:

- **Today I Learned** — items extracted from commit messages containing `TIL:` (e.g., `feat(auth): add OAuth flow TIL: refresh tokens expire separately`)
- **Per-repo commit lists** — commits sorted chronologically with short SHA, subject, category, and diff stats

Example:

```markdown
# Code Diary — 2025-06-15

## 2025-06-15

### Today I Learned
- refresh tokens expire separately (`a1b2c3d`, my-app)

### my-app
- `a1b2c3d` feat(auth): add OAuth flow — feat (+120 / -5)
- `e4f5g6h` fix(db): connection pool timeout — fix (+8 / -3)

---
```

Weekly and monthly reports aggregate these daily entries into higher-level summaries.

## CLI Reference

```
code-diary [<repo-path>...] [--date <YYYY-MM-DD>] [--output <dir>]
code-diary aggregate [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--output <dir>]
```

| Argument | Description |
|---|---|
| `<repo-path>` | One or more repo paths (reads from config if omitted) |
| `--date <YYYY-MM-DD>` | Date to generate the entry for (defaults to today) |
| `--output <dir>` | Output directory (defaults to config or cwd) |
| `-h, --help` | Show help message and exit |

CLI arguments override config values. If `repos` is set in your config, you can run `code-diary` with no arguments at all.

### Aggregate Subcommand

Aggregate runs automatically after each `code-diary` invocation. You can also run it standalone for a broader date range:

```bash
code-diary aggregate                                  # regenerate all reports
code-diary aggregate --from 2025-06-01 --to 2025-06-30  # specific range
```

| Argument | Description |
|---|---|
| `--from <YYYY-MM-DD>` | Start date (defaults to earliest diary entry) |
| `--to <YYYY-MM-DD>` | End date (defaults to today) |
| `--output <dir>` | Output directory (defaults to config or cwd) |

## Requirements

- Node.js >= 18
- Git installed and available on `PATH`

## Development

```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type-check without emitting
npm run test       # Run tests with Vitest
```

## License

ISC
