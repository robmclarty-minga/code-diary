# code-diary

Zero-dependency Node.js CLI that reads git log output from one or more repos, categorizes commits for a given date, and appends a structured markdown entry to a monthly diary file.

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
code-diary <repo-path> [<repo-path>...] [--date <YYYY-MM-DD>] [--output <dir>]
```

### Arguments

| Argument | Description |
|---|---|
| `<repo-path>` | One or more paths to git repositories (required) |
| `--date <YYYY-MM-DD>` | Date to generate the entry for (defaults to today) |
| `--output <dir>` | Directory where the diary file is written (defaults to current directory) |

### Examples

```bash
# Generate a diary entry for today from one repo
code-diary ~/projects/my-app

# Generate for a specific date across multiple repos
code-diary ~/projects/api ~/projects/frontend --date 2025-06-15

# Write output to a specific directory
code-diary ~/projects/api --output ~/notes
```

### Output

Diary entries are written to `<output>/diary/<YYYY-MM>.md`, organized by month. Each daily entry includes:

- **Today I Learned** — items extracted from commit messages containing `TIL:` (e.g., `feat(auth): add OAuth flow TIL: refresh tokens expire separately`)
- **Per-repo commit lists** — commits sorted chronologically with short SHA, subject, category, and diff stats

If an entry for the given date already exists, you will be prompted to replace it.

Example output:

```markdown
# Code Diary — 2025-06

## 2025-06-15

### Today I Learned
- refresh tokens expire separately (`a1b2c3d`, my-app)

### my-app
- `a1b2c3d` feat(auth): add OAuth flow — feat (+120 / -5)
- `e4f5g6h` fix(db): connection pool timeout — fix (+8 / -3)

---
```

## Development

```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type-check without emitting
npm run test       # Run tests with Vitest
```

## License

ISC
