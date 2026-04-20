---
name: splitting-stacks
description: "Splits the current feature branch into a semantically grouped stack of GitHub PRs with correct base-branch chaining. Analyzes commits by type and file overlap, proposes a stack plan for approval, then creates branches, verifies each builds green, pushes, and opens chained draft PRs via gh."
when_to_use: "When the user has a feature branch with several commits and says 'split into a stack', 'stack this branch', 'make this a stacked PR', 'publish this as a stack', or invokes /splitting-stacks."
disable-model-invocation: true
allowed-tools: Read Write Bash(git log *) Bash(git show *) Bash(git diff *) Bash(git status *) Bash(git branch *) Bash(git checkout *) Bash(git cherry-pick *) Bash(git rev-parse *) Bash(git rev-list *) Bash(git merge-base *) Bash(git config *) Bash(git push *) Bash(gh pr create *) Bash(gh pr list *) Bash(gh auth status) Bash(npm run typecheck) Bash(npm test *) Bash(npm run test *)
effort: high
---

## Current state

**Current branch:**
!`git rev-parse --abbrev-ref HEAD`

**Working tree:**
!`git status --porcelain`

**Commits ahead of main:**
!`git rev-list --count main..HEAD 2>/dev/null || echo "NO_MAIN"`

**Merge commits in range (must be empty):**
!`git log --merges --oneline main..HEAD 2>/dev/null || echo ""`

**Commits (oldest first):**
!`git log --reverse --format="%H %s" main..HEAD 2>/dev/null`

**gh auth:**
!`gh auth status 2>&1 | head -2`

## Goal

Turn one feature branch with N commits into a stack of dependent draft PRs on
GitHub, grouped semantically (not one-PR-per-commit). The original branch is
left untouched as a safety net.

## Workflow

Track progress with this checklist. Copy it into your response and check items
off as you go — state must be explicit so rollback is clean.

```
Stack Progress:
- [ ] Stage 1: Preflight passed
- [ ] Stage 2: Commits analyzed
- [ ] Stage 3: Plan proposed; user approved
- [ ] Stage 4: Branches built + verified green
- [ ] Stage 4: Branches pushed
- [ ] Stage 4: PRs created
- [ ] Stage 5: Back on original branch, report printed
```

### Stage 1 — Preflight

Any failure below is a hard stop. Do not proceed.

- **Current branch** is not `main`. If on `main`, stop.
- **Working tree** is empty. If dirty, tell the user to commit or stash. Don't
  auto-stash.
- **Commits ahead of main** ≥ 2. If 1, print "Nothing to split — only 1 commit
  ahead of `main`" and exit. If 0 or `NO_MAIN`, stop.
- **Merge commits in range** is empty. If any merge commits, stop with:
  "Merge commits in the range are not supported in v1. Rebase your branch onto
  `main` first."
- **gh auth** shows "Logged in to github.com". If not, stop.

Record:
- `ORIGINAL_BRANCH` — from current branch
- `BASE_SHA` — `git merge-base main HEAD`

### Stage 2 — Analyze

For each commit in **Commits (oldest first)**, gather:

1. Conventional-commit type from the subject using this regex (lifted from
   `src/categorize.ts:12`):
   `^(feat|fix|refactor|docs|chore|test|style|perf|build|ci)(\(.+\))?:`
2. Files touched: `git show --name-only --pretty='' <sha>`
3. Size: `git show --shortstat --pretty='' <sha>` → insertions, deletions

Build a commit×file matrix in your head. Derive:

- **Foundational commits**: touch files that ≥1 later commit also touches.
- **Independent commits**: touch files that no other commit touches.
- **Dependent commits**: touch files that an earlier commit introduced.

Read `CLAUDE.md` for project conventions (commit types, branch naming).

### Stage 3 — Propose plan

Apply grouping heuristics in this order:

1. `refactor`/`chore`/`build`/`ci` commits that introduce files consumed by
   later commits go into the **foundation group** (first in the stack).
2. `feat` commits that depend on foundation files go into later groups, in
   original commit order.
3. `fix`/`docs`/`test` commits absorb into the nearest group that shares files.
   A commit fully disjoint from every other commit gets its own group.
4. Within a group, preserve the commits' original relative order.
5. Target **2–5 groups**. If you'd produce 1 group, report "Commits are too
   coupled to split meaningfully" and stop. If you'd produce >5, merge the
   smallest adjacent groups until ≤ 5.

Branch names: `<type>/<kebab-slug-of-group-intent>`. The slug describes the
group, not a single commit. Keep under 50 chars.

Emit the plan in **exactly** this format, then stop:

```
# Proposed stack (N PRs)

## 1. <type>/<slug-1>  →  base: main
- <short-sha-1> <subject-1>
- <short-sha-2> <subject-2>

## 2. <type>/<slug-2>  →  base: <type>/<slug-1>
- <short-sha-3> <subject-3>

## 3. <type>/<slug-3>  →  base: <type>/<slug-2>
- <short-sha-4> <subject-4>

Reply "go" to execute, or tell me how to adjust (e.g. "move <sha> to group 2",
"rename group 1 to refactor/util", "merge groups 2 and 3").
```

**Do not proceed to Stage 4 until the user replies with approval.** Accept
free-form edits and re-emit the revised plan. Only "go" (or clearly
affirmative) triggers execution.

### Stage 4 — Execute

Only after explicit approval. Announce the start: "Executing stack — stay on
this branch; don't touch git."

For each group G in order (group 1 first):

1. `git checkout -b <G.branch> <G.parent>` where `G.parent` is `main` for group
   1, previous group's branch otherwise.
2. `git cherry-pick -x <G.shas in order>`.
   - `-x` records the original SHA in the cherry-pick commit body.
   - On conflict: `git cherry-pick --abort` and go to **Rollback**.
3. `npm run typecheck`. Non-zero → capture stderr and go to **Rollback**.
4. `npm test -- --run` (add `--run` so vitest exits after one pass). Non-zero
   → capture stderr and go to **Rollback**.

After every group builds green:

5. `git push -u origin <branch-1> <branch-2> <branch-3> ...` — one command,
   all branches at once.
6. For each group G, write `/tmp/pr-<G.branch-basename>.md` with the body
   template below, then:
   ```
   gh pr create --draft \
     --base <G.parent> --head <G.branch> \
     --title "<G.title>" \
     --body-file /tmp/pr-<G.branch-basename>.md
   ```

**PR body template** (substitute `<...>` fields):

```
## Summary
<one-line description derived from the group's intent — not verbatim from a commit>

## Commits
- `<short-sha-1>` <subject-1>
- `<short-sha-2>` <subject-2>

## Stack
<stack diagram — see Stage 5>

## Test plan
- [x] `npm run typecheck`
- [x] `npm test` (green at every layer)
```

**Title**: Use the group's conventional-commit-style one-liner, e.g.
`refactor(util): add shared util module for sort and sha helpers`. If the group
has one commit, use that commit's subject. If multiple, synthesise.

### Stage 5 — Report

1. `git checkout $ORIGINAL_BRANCH`.
2. Verify `git status --porcelain` is empty.
3. Print the stack diagram with PR URLs:

```
Stack created (all draft):

#<n> <G.title>
     <G.parent> ← <G.branch>
     <pr-url>

...

Original branch `<ORIGINAL_BRANCH>` is untouched. Graphite will pick up the
chain automatically at https://app.graphite.dev.
```

Do **not** delete the original branch.

## Rollback

Triggered by: cherry-pick conflict, typecheck failure, or test failure during
Stage 4 steps 1–4. Never triggered after Stage 4 step 5 (push).

1. If mid-cherry-pick: `git cherry-pick --abort`.
2. `git checkout $ORIGINAL_BRANCH`.
3. For each branch created in this run: `git branch -D <branch>`.
4. Report, in this exact shape:

```
Rollback: stack build failed.

Failed on group <n> (<G.branch>) at <stage>:
  <captured stderr, first 40 lines>

Branches deleted locally: <list>
Remote untouched.
You are back on `<ORIGINAL_BRANCH>` with a clean tree.
```

If the failure is a cherry-pick conflict, also name the conflicting SHA.

## Anti-patterns

- **Do not** `git rebase`, `git reset --hard`, or mutate `$ORIGINAL_BRANCH` at
  any point. Cherry-pick only.
- **Do not** push until every branch locally builds green.
- **Do not** create a regular PR if Stage 4 step 6 fails halfway — report what
  succeeded, let the user finish with `gh`. Do not auto-delete remote branches.
- **Do not** use `AskUserQuestion` for plan approval. Plain text only — the
  user may want to rewrite the plan, which is a freeform edit, not a choice.
- **Do not** expand scope in v1 (see out-of-scope list below).

## Out of scope (v1)

- Hunk-level splitting of a single commit
- Merge commits in the branch range (preflight rejects)
- `gt` CLI integration — raw `git` + `gh` is enough; Graphite reads the base
  chain from GitHub PR pointers
- Auto-restack when `main` moves
- Trunk branches other than `main`

## Worked examples

See [examples.md](examples.md) for 2 traces: a clean 3-group split and a
grouping with a `test` commit absorbed into its sibling.

## Evals

See `evals/*.md` for 4 scenarios used to validate the skill end-to-end.
