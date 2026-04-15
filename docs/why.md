# Why code-diary

## The problem

At the end of a workday, you know what you did. A week later, it's fuzzy. By the time a retro, a 1-on-1, or a performance review comes around, you're reconstructing your contributions from memory, stale Jira tickets, and `git log --oneline | head -50`.

Git history has all the raw data, but it's noisy. Merge commits, fixups, dependency bumps, and multi-repo sprawl bury the signal. Extracting a coherent narrative requires effort you won't spend consistently.

## The approach

code-diary automates the boring part: reading git logs, categorizing commits by type, pulling out the interesting bits, and writing a clean markdown file. You run it once (or schedule it), and it produces a daily entry that's immediately useful and accumulates into weekly and monthly summaries over time.

### Design decisions

**Markdown output.** Markdown is human-readable, diffable, greppable, and understood by every tool in the ecosystem. No databases, no proprietary formats, no lock-in. Your diary is a folder of text files.

**Zero dependencies.** The entire tool runs on Node.js built-ins. No package ecosystem to keep current, no supply chain surface, no breakage from transitive updates. It installs and builds with `npm install && npm run build` and that's the end of the dependency story.

**Idempotent re-runs.** Running code-diary twice for the same date doesn't duplicate entries — it merges new commits into the existing file. This means you can run it on a cron, run it manually, run it from a script, and never worry about corrupted output.

**Convention-aware.** If you write conventional commits (`feat(scope): message`), code-diary categorizes them automatically. If you don't, everything lands under `other` and still works fine. The `TIL:` convention is opt-in — drop it into any commit message and it gets surfaced in a dedicated section.

**Multi-repo, multi-identity.** Most developers touch more than one repo and may have different git identities across them (personal email, work email, contractor email). code-diary handles both: configure multiple repos and author emails, and it produces a single unified diary.

### What it's not

code-diary is not a time tracker, a project management tool, or an analytics dashboard. It doesn't measure productivity or generate metrics. It writes down what you did in your own repos so that you — or an agent acting on your behalf — can refer back to it later.

## Who it's for

Anyone who writes code across one or more git repos and wants a low-effort record of their work. It's particularly useful if you:

- Do regular standups, retros, or 1-on-1s and need to recall what you shipped
- Work across multiple repos or identities and want a unified view
- Use AI agents that benefit from structured context about your recent activity
- Prefer plain text files you own over SaaS tools you don't
