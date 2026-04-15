---
name: version
description: "Bumps the package.json version (major/minor/patch), generates a changelog entry from git history since the last release, and commits the result."
when_to_use: "When the user says 'version', 'bump', 'release', 'cut a release', 'v1.2.3', or any semver-like string."
argument-hint: "[major|minor|patch|vX.Y.Z]"
disable-model-invocation: true
allowed-tools: Read Edit Bash(git log *) Bash(git add *) Bash(git commit *) Bash(git status *) Bash(git diff *) Bash(git rev-list *) Bash(node *)
effort: medium
---

## Current state

**Current version:**
!`node -p "require('./package.json').version"`

**Previous release commit:**
!`git log --extended-regexp --format="%H %s" --grep="^v[0-9]+\.[0-9]+\.[0-9]+$" | head -1 || echo "NONE"`

**Working tree:**
!`git status --porcelain`

**Recent commits (hash + subject):**
!`git log -50 --format="%H %s" --reverse`

**CHANGELOG.md header:**
!`head -30 CHANGELOG.md 2>/dev/null || echo "NO_CHANGELOG"`

## Input

`$ARGUMENTS` is one of:
- `major`, `minor`, or `patch` (default: `patch`)
- An explicit version: `1.2.3` or `v1.2.3`

## Workflow

### 1. Pre-flight

- If **Working tree** is non-empty, STOP — tell the user to commit or stash first.
- If **Current version** failed, there is no `package.json` — stop.
- Identify commits since the last release by finding the **Previous release
  commit** hash in **Recent commits**. All commits after that hash are new.
  If there is no previous release, all commits are new.
- If there are no new commits, tell the user there are no changes to release.
  Do not proceed.

### 2. Compute next version

- If explicit version, validate it is strictly greater than current. Error if not.
- If bump level, increment per standard semver rules.

Convention: `package.json` and `CHANGELOG.md` use bare version (`1.2.3`).
Commit message uses `v`-prefixed form (`v1.2.3`).

### 3. Generate changelog entry

Transform each commit into a changelog bullet:
- Strip conventional-commit prefixes (`feat(scope): ` → just the summary)
- Capitalize the first letter
- One `- ` bullet per line
- Order: features first, fixes second, everything else after
- Collapse only when commits share the same scope and describe the same change

Filter out the previous version commit and merge commits (`^Merge `).

If **CHANGELOG.md header** above exists, match its style exactly (header format,
bullet style, date presence).

### 4. Update files (parallel)

Make BOTH edits in the same response:

a) **`package.json`**: Update only the `"version"` field.
b) **`CHANGELOG.md`**: Insert the new entry before the first `^## ` line.
   If no CHANGELOG.md exists, create one with a `# Changelog` header.

### 5. Commit and report

Stage and commit in one command:
```
git add package.json CHANGELOG.md && git commit -m "vX.Y.Z"
```

Do NOT push, tag, or publish unless the user explicitly asks.

If a pre-commit hook fails, fix the issue, re-stage, and create a NEW commit
(never `--amend`). If the hook fails twice, stop and ask the user.

Print the new version, old version, and changelog bullets.
