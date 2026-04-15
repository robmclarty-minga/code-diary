---
name: commit-til
description: Creates a conventional commit with TIL extraction for code-diary. Generates commit messages that code-diary's categorization and TIL parser can process.
when_to_use: When the user asks to commit, says "/commit", wants help writing a commit message, or says "commit this" or "commit my changes."
disable-model-invocation: true
allowed-tools: Bash(git diff *) Bash(git status *) Bash(git log *) Bash(git add *) Bash(git commit *) Read
---

# Commit with TIL Extraction

Create a conventional commit, extracting any learning moments as TIL entries for code-diary.

## Workflow

1. Run `git status`, `git diff --cached`, `git diff`, and `git log --oneline -5`.
2. **Auto-stage** all unstaged changes and untracked files, EXCEPT files matching the never-stage list below. Stage files by name — never use `git add -A` or `git add .`.
3. If nothing ends up staged, tell the user and stop.
4. Read the full staged diff. Understand what changed and why.
5. Write a conventional commit message: `type(scope): lowercase imperative summary`. This project recognizes: `feat|fix|refactor|docs|chore|test|style|perf|build|ci`.
6. Scan for TIL opportunities (see below). Add them to the commit body if found.
7. Commit immediately using a heredoc for multi-line messages. Do not ask for confirmation — the user invoked `/commit` because they want to commit.

If `$ARGUMENTS` are provided, use them as context for the commit scope or description.

### Never auto-stage

Skip these files entirely. If they are the ONLY uncommitted changes, tell the user what was skipped and why.

- `*.env*`, `*.pem`, `*.key`, `*.secret`, `credentials*`, `*token*` — secrets
- `*.log` — logs
- Binary files (images, archives, compiled blobs) — unless they are in a directory that clearly expects them (e.g., `test/fixtures/`)
- Any file over 100 KB

When in doubt about a file, stage it. The user prefers speed over caution for normal code files.

## TIL Format

code-diary's parser extracts TILs via `line.indexOf("TIL:")` and takes everything after `TIL:` to end-of-line, trimmed. The format is strict:

- Must be exactly `TIL:` — case-sensitive (not `til:` or `Til:`)
- One TIL per line, in the commit body
- Multiple TILs per commit are fine

**Most commits will NOT have a TIL.** Only add one when there's a genuine insight:
- First-time use of an API, language feature, or tool flag in this project
- Non-obvious bug root cause — the "why" was surprising
- Performance, config, or platform behavior that isn't widely known

## Edge Cases

- **Pre-commit hook failure**: The commit did not happen. Fix the issue, re-stage, and create a NEW commit. Never `--amend` after a hook failure.
- **Only ignored files remain**: Tell the user what was skipped and why.

## Example

```
fix(internal-tools): handle timezone offsets with half-hour increments

India Standard Time (+0530) and similar half-hour offsets were being
truncated to whole hours during day segment calculation.

TIL: not all UTC offsets are whole hours — IST is +05:30, Nepal is +05:45
```
