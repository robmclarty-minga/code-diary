# Eval: single-commit branch exits with "nothing to split"

## Setup

```
git checkout -b eval/single-commit main
git commit --allow-empty -m "feat(eval): sole commit"
```

## Invocation

```
/splitting-stacks
```

## Expected behavior

- [x] Skill stops at Stage 1.
- [x] Exit is non-error (skill does not report failure — it reports "nothing
  to split" and stops cleanly).
- [x] Message is exactly: `Nothing to split — only 1 commit ahead of \`main\`.`
  (or a near-verbatim variant).
- [x] Zero branches created.
- [x] `git branch --show-current` is still `eval/single-commit`.
- [x] `git status --porcelain` is empty.

## Teardown

```
git checkout main && git branch -D eval/single-commit
```
