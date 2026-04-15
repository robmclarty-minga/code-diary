# code-diary

Zero-dependency Node.js CLI that reads git log output from one or more repos, categorizes commits for a given date, and writes a structured markdown entry to a daily diary file. Automatically generates weekly and monthly aggregate reports after each run.

## Requirements

- Node.js >= 18
- Git installed and available on `PATH`

## Installation

```bash
# Clone the repo
git clone <repo-url>
cd code-diary

# Install dev dependencies and build
npm install
npm run build

# Link globally (optional — makes `code-diary` available everywhere)
npm link
```

## Usage

```
code-diary [<repo-path>...] [--date <YYYY-MM-DD>] [--output <dir>]
code-diary aggregate [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--output <dir>]
```

### Arguments

| Argument | Description |
|---|---|
| `<repo-path>` | One or more paths to git repositories (reads from config if omitted) |
| `--date <YYYY-MM-DD>` | Date to generate the entry for (defaults to today) |
| `--output <dir>` | Directory where diary files are written (defaults to config or cwd) |
| `-h, --help` | Show help message and exit |

### Examples

```bash
# Generate a diary entry for today from one repo
code-diary ~/projects/my-app

# Generate for a specific date across multiple repos
code-diary ~/projects/api ~/projects/frontend --date 2025-06-15

# Write output to a specific directory
code-diary ~/projects/api --output ~/diary

# Use repos from config (no repo paths needed)
code-diary
```

### Aggregate Subcommand

Generate weekly and monthly reports from daily diary entries. Reports are regenerated from the latest daily entry data each time, so they always reflect the current state of your daily files.

Aggregate runs automatically at the end of each `code-diary` invocation (scoped to the entry's month). You can also run it standalone for a broader date range:

```bash
# Regenerate all reports
code-diary aggregate

# Regenerate reports for a specific date range
code-diary aggregate --from 2025-06-01 --to 2025-06-30

# Specify output directory
code-diary aggregate --output ~/diary
```

| Argument | Description |
|---|---|
| `--from <YYYY-MM-DD>` | Start date (defaults to earliest diary entry) |
| `--to <YYYY-MM-DD>` | End date (defaults to today) |
| `--output <dir>` | Diary output directory (defaults to config or cwd) |

## Config

Optional settings file at `~/.code-diary/settings.json`:

```json
{
  "output-dir": "~/diary",
  "repos": ["~/Projects/api", "~/Projects/web"]
}
```

When `repos` is set, you can run `code-diary` with no positional arguments and it will read from the configured repositories. CLI arguments override config values.

## Output

Daily entries are written to `<output>/diary/daily/code-diary-YYYY-MM-DD.md`, one file per day. Each entry includes:

- **Today I Learned** — items extracted from commit messages containing `TIL:` (e.g., `feat(auth): add OAuth flow TIL: refresh tokens expire separately`)
- **Per-repo commit lists** — commits sorted chronologically with short SHA, subject, category, and diff stats

If an entry for the given date already exists, new data is merged in. Repos covered by the current run get fresh data from git log; repos present in the existing file but not in the current run are preserved. This makes the command safe to run multiple times a day or from a scheduled task — no data is lost.

Weekly and monthly reports are written alongside daily entries:

```
diary/
  daily/    # code-diary-YYYY-MM-DD.md
  weekly/   # code-diary-YYYY-MM-W#.md
  monthly/  # code-diary-YYYY-MM.md
```

Example daily entry:

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

## Scheduled Use

The command is designed to run unattended. A single invocation handles the full pipeline — daily entry creation/merge plus aggregate report generation — so only one scheduled job is needed.

```bash
# crontab example: run at 6pm every weekday
0 18 * * 1-5 /usr/local/bin/code-diary --output ~/diary
```

Running multiple times for the same date is safe: new commits are merged into the existing daily file and aggregate reports are regenerated from the latest data.

## Development

```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type-check without emitting
npm run test       # Run tests with Vitest
```

## License

ISC
