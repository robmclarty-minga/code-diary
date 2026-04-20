# Worked examples

Two input→plan traces showing how commits map to groups. These illustrate the
grouping heuristics from SKILL.md Stage 3.

## Example 1 — Clean three-group refactor

### Input

```
$ git log --reverse --format='%h %s' main..HEAD
b1552c6 refactor(util): add shared util module for sort and sha helpers
17c19ca refactor(categorize,markdown): use shared util helpers
3d3a48f refactor(aggregate): use sortByDateDesc util for daily entry ordering
```

### File matrix

| sha      | files                                            |
| -------- | ------------------------------------------------ |
| b1552c6  | src/util.ts, src/__tests__/util.test.ts          |
| 17c19ca  | src/categorize.ts, src/markdown.ts               |
| 3d3a48f  | src/util.ts, src/__tests__/util.test.ts, src/aggregate.ts |

### Analysis

- `b1552c6` introduces `src/util.ts`. Files are re-touched by `3d3a48f`
  (adds `sortByDateDesc`). → **foundational**.
- `17c19ca` consumes `src/util.ts` (imports the helpers). → **depends on group 1**.
- `3d3a48f` extends `src/util.ts` _and_ consumes it in `src/aggregate.ts`. It
  depends on group 1 and is disjoint from group 2's files. → own group.

### Proposed plan

```
# Proposed stack (3 PRs)

## 1. refactor/util-module  →  base: main
- b1552c6 refactor(util): add shared util module for sort and sha helpers

## 2. refactor/use-util-in-categorize-markdown  →  base: refactor/util-module
- 17c19ca refactor(categorize,markdown): use shared util helpers

## 3. refactor/use-util-in-aggregate  →  base: refactor/use-util-in-categorize-markdown
- 3d3a48f refactor(aggregate): use sortByDateDesc util for daily entry ordering

Reply "go" to execute, or tell me how to adjust.
```

## Example 2 — Test commit absorbed into its sibling

### Input

```
$ git log --reverse --format='%h %s' main..HEAD
a001aaa feat(config): add authors setting for multi-identity filtering
a002bbb test(config): cover authors parsing edge cases
a003ccc feat(git): filter commits by author email in git log
a004ddd feat(cli): resolve per-repo author identity and wire through pipeline
a005eee docs(readme): document multi-identity filtering
```

### File matrix

| sha      | files                                                         |
| -------- | ------------------------------------------------------------- |
| a001aaa  | src/config.ts, src/types/diary.ts                             |
| a002bbb  | src/__tests__/config.test.ts                                  |
| a003ccc  | src/git.ts                                                    |
| a004ddd  | src/cli.ts                                                    |
| a005eee  | README.md                                                     |

### Analysis

- `a001aaa` introduces config plumbing touched (transitively) by every later
  commit. → **foundational**.
- `a002bbb` is a `test` commit whose only file is the test counterpart for
  `a001aaa`'s change. → **absorb into group 1**.
- `a003ccc` depends on the config shape from group 1 but is self-contained to
  `src/git.ts`. → own group.
- `a004ddd` wires CLI → both config and git. Depends on groups 1 and 2. →
  own group on top.
- `a005eee` is a `docs` commit documenting the whole feature. Disjoint files.
  Absorb into the topmost group (user-facing docs belong with the user-facing
  change). → **group 3**.

### Proposed plan

```
# Proposed stack (3 PRs)

## 1. feat/config-authors  →  base: main
- a001aaa feat(config): add authors setting for multi-identity filtering
- a002bbb test(config): cover authors parsing edge cases

## 2. feat/git-filter-by-author  →  base: feat/config-authors
- a003ccc feat(git): filter commits by author email in git log

## 3. feat/cli-resolve-author-identity  →  base: feat/git-filter-by-author
- a004ddd feat(cli): resolve per-repo author identity and wire through pipeline
- a005eee docs(readme): document multi-identity filtering

Reply "go" to execute, or tell me how to adjust.
```

### Why docs went with the topmost group

The `docs` commit references the whole end-to-end feature, not just config. If
it lived in group 1, the user-facing README would describe CLI behavior that
group 1 can't deliver on its own. Putting docs with the final layer keeps each
PR self-describing.
