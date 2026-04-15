---
name: commit-til
description: Review staged changes and create a conventional commit with TIL extraction. Use when the user asks to commit, says "/commit", or wants help writing a commit message. Generates commit messages compatible with code-diary's categorization and TIL parsing.
---

# Commit with TIL Extraction

Create a git commit using conventional commit format, identifying any learning moments as TIL entries that code-diary can parse.

## Step 1 — Review Changes

Run these commands to understand what's being committed:

```
git diff --cached
git status
git log --oneline -5
```

Read the staged diff carefully. Understand what changed and why before writing anything.

## Step 2 — Determine Commit Type

Choose one type based on the **primary intent** of the change:

| Type | When to use |
|------|-------------|
| `feat` | New functionality visible to users or consumers |
| `fix` | Bug fix — something was broken, now it works |
| `refactor` | Code restructuring with no behavior change |
| `docs` | Documentation only (README, comments, JSDoc) |
| `chore` | Maintenance (deps, config, tooling, CI scripts) |
| `test` | Adding or updating tests only |
| `style` | Formatting, whitespace, semicolons — no logic change |
| `perf` | Performance improvement with no behavior change |
| `build` | Build system or external dependency changes |
| `ci` | CI/CD pipeline configuration changes |

If the change spans multiple types, pick the one that describes the main purpose. A feature that also adds tests is `feat`, not `test`.

## Step 3 — Choose a Scope (optional)

Add a scope in parentheses if it clarifies which part of the codebase is affected:

- `feat(auth): add token refresh` — scope narrows the area
- `fix(parser): handle empty input` — scope identifies the module

Skip the scope if the change is broad or the type alone is clear enough.

## Step 4 — Write the Subject Line

Format: `type(scope): lowercase imperative summary`

Rules:
- Under 72 characters total
- Lowercase after the colon
- Imperative mood ("add", "fix", "remove" — not "added", "fixes", "removing")
- No period at the end
- Describe **what** the commit does, not how

Good: `feat(api): add rate limiting to auth endpoints`
Bad: `feat(api): Added rate limiting functionality to the authentication endpoints.`

## Step 5 — Identify TIL Opportunities

Scan the changes for learning moments. A TIL is worth adding when:

- **First-time API or library usage** — you used a Node.js built-in, language feature, or tool flag you haven't used in this project before
- **Non-obvious bug root cause** — the fix was straightforward but the "why" was surprising
- **Performance discovery** — something was faster/slower than expected
- **Config or tooling insight** — a flag, setting, or environment behavior that isn't widely known
- **Platform or version quirk** — behavior that differs across OS, Node versions, or browsers

If any apply, add `TIL:` lines in the commit body. Format matters:

```
TIL: the thing you learned
```

- **Case-sensitive**: must be exactly `TIL:` (not `til:` or `Til:`)
- One TIL per line
- Can appear anywhere in the body — start of line, middle of sentence, etc.
- Multiple TILs per commit are fine (one per line)
- Keep them concise — one sentence, no trailing period needed

code-diary's parser finds these via `line.indexOf("TIL:")` and extracts everything after `TIL:` to end-of-line, trimmed.

**Not every commit needs a TIL.** Most won't. Only add them when there's a genuine insight worth recording.

## Step 6 — Compose the Body (when needed)

Add a body when:
- The "why" isn't obvious from the subject
- There are TIL items to include
- The change has notable trade-offs or alternatives considered
- There's context that would help a future reader

Skip the body when the subject says it all.

Body format:
```
<blank line after subject>
Brief explanation of why this change was made.

TIL: something interesting discovered during this work
```

## Step 7 — Create the Commit

Stage the relevant files and create the commit. Use a heredoc for the message to preserve formatting:

```bash
git add <specific files>
git commit -m "$(cat <<'EOF'
type(scope): subject line

Optional body with context.

TIL: optional learning if applicable
EOF
)"
```

Do not use `git add -A` or `git add .` — stage specific files to avoid accidentally including sensitive or unrelated files.

## Examples

**Simple commit, no body:**
```
feat(config): add settings.json loader
```

**Commit with body and TIL:**
```
fix(git): handle timezone offsets with half-hour increments

India Standard Time (+0530) and similar half-hour offsets were being
truncated to whole hours during day segment calculation.

TIL: not all UTC offsets are whole hours — IST is +05:30, Nepal is +05:45
```

**Refactor, no TIL:**
```
refactor(markdown): extract daily file formatting into separate function

Preparing for the aggregate subcommand which needs to parse and
re-format daily entries independently.
```
