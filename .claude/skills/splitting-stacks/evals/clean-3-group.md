# Eval: clean three-group split

## Setup

Starting from a clean `main`, build a disposable branch with 5 commits of
mixed type that naturally split into 3 groups:

```
git checkout -b eval/clean-3-group main

# Group 1 — foundational util module (2 commits)
echo 'export const A = 1;' > src/eval_util.ts
echo 'export const B = 2;' >> src/eval_util.ts
git add src/eval_util.ts
git commit -m "refactor(util): add A constant"
echo 'export const C = 3;' >> src/eval_util.ts
git add src/eval_util.ts
git commit -m "refactor(util): add B and C constants"

# Group 2 — consumer of group 1
cat >> src/cli.ts <<'EOF'
import { A } from "./eval_util.js";
export const _evalA = A;
EOF
git add src/cli.ts
git commit -m "refactor(cli): import A from util module"

# Group 3 — independent feature + its test
cat > src/eval_feature.ts <<'EOF'
export const evalFeature = (x: number) => x * 2;
EOF
cat > src/__tests__/eval_feature.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { evalFeature } from "../eval_feature.js";
describe("evalFeature", () => {
  it("doubles", () => expect(evalFeature(3)).toBe(6));
});
EOF
git add src/eval_feature.ts src/__tests__/eval_feature.test.ts
git commit -m "feat(eval): add evalFeature helper"
git commit --allow-empty -m "test(eval): evalFeature coverage" # separate test commit
```

## Invocation

```
/splitting-stacks
```

User replies `go` when prompted.

## Expected behavior

- [x] Preflight passes.
- [x] Proposed plan has 3 groups, roughly:
  1. `refactor/<util-slug>` ← main (2 util commits)
  2. `refactor/<cli-slug>` ← group 1 (cli import commit)
  3. `feat/<eval-slug>` ← group 2 (feature + its test)
- [x] After `go`: 3 branches created locally, in order.
- [x] Each branch passes `npm run typecheck` and `npm test`.
- [x] All 3 branches pushed to `origin` in one command.
- [x] 3 draft PRs created via `gh pr create`, with correct `--base` pointers.
- [x] `gh pr list --state open --json baseRefName,headRefName` shows the chain.
- [x] Script ends with `git branch --show-current` = `eval/clean-3-group` and
  `git status --porcelain` empty.

## Teardown

```
gh pr list --head <branch> --json number --jq '.[].number' | xargs -I{} gh pr close {} --delete-branch
git branch -D <group-branches> 2>/dev/null
git checkout main && git branch -D eval/clean-3-group
```
