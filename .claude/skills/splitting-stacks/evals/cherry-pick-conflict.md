# Eval: cherry-pick conflict during group 2 triggers clean rollback

## Setup

Craft a branch where commits A and C touch the same line in the same file,
but the skill's grouping will put A in group 1 and C in group 2 — which means
group 2 will try to cherry-pick C onto a parent branch that doesn't contain A,
causing a conflict.

```
git checkout -b eval/cp-conflict main

# Baseline file
echo "export const value = 1;" > src/eval_conflict.ts
git add src/eval_conflict.ts
git commit -m "refactor(conflict): add initial value"  # A

# Independent refactor elsewhere
cat >> src/cli.ts <<'EOF'
export const _evalConflict = true;
EOF
git add src/cli.ts
git commit -m "refactor(cli): add eval marker"  # B

# Edit A's file on the same line — this will conflict if cherry-picked
# without A in the parent
echo "export const value = 99;" > src/eval_conflict.ts
git add src/eval_conflict.ts
git commit -m "feat(conflict): bump value to 99"  # C
```

Force the plan so group 2 lands C without A:

- Propose: group 1 = [B], group 2 = [A, C] would pick cleanly; you need to
  steer the skill toward group 1 = [B], group 2 = [C], group 3 = [A], or
  similar. Simplest: when the skill prints its plan, reply with an explicit
  regrouping that forces C onto a parent that lacks A.

Realistic regrouping reply:

```
Move A to group 3. Group 1 = [B], Group 2 = [C], Group 3 = [A].
```

Then reply `go`.

## Expected behavior

- [x] Group 1 branch built, typechecks, tests pass, cherry-picks B cleanly.
- [x] Group 2 branch created off group 1.
- [x] `git cherry-pick -x <C>` **fails** with a conflict in `src/eval_conflict.ts`.
- [x] Skill runs `git cherry-pick --abort`.
- [x] Skill checks out `eval/cp-conflict`.
- [x] Skill deletes the group 1 and group 2 branches locally (`git branch -D`).
- [x] `git status --porcelain` is empty.
- [x] **No branches pushed** to origin (`git reflog` shows no push).
- [x] **No PRs created** on GitHub (`gh pr list --author @me` unchanged).
- [x] Error report includes:
  - "Failed on group 2 (...) at cherry-pick"
  - the conflicting SHA (short form of C)
  - the list of branches deleted locally
  - confirmation user is back on `eval/cp-conflict` with clean tree.

## Teardown

```
git checkout main && git branch -D eval/cp-conflict
```
