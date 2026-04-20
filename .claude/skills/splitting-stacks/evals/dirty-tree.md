# Eval: preflight rejects a dirty working tree

## Setup

```
git checkout -b eval/dirty-tree main
git commit --allow-empty -m "feat(eval): commit 1"
git commit --allow-empty -m "refactor(eval): commit 2"
git commit --allow-empty -m "feat(eval): commit 3"
git commit --allow-empty -m "test(eval): commit 4"

# Dirty the tree
echo "untracked junk" > eval_dirty.txt
```

## Invocation

```
/splitting-stacks
```

## Expected behavior

- [x] Skill stops at Stage 1.
- [x] Error message explicitly names a dirty working tree and tells the user
  to commit or stash first.
- [x] Zero new branches created (`git branch --list 'refactor/*' 'feat/*'`
  unchanged from before invocation).
- [x] Zero pushes (`git reflog --date=iso -20 | grep push` unchanged).
- [x] `git status --porcelain` still shows `?? eval_dirty.txt` after the skill
  exits — the skill did not touch the working tree.

## Teardown

```
rm eval_dirty.txt
git checkout main && git branch -D eval/dirty-tree
```
