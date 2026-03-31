# Pitch: code-diary

## Problem

Developers finish a day of coding and have no easy way to answer the question: "what did I actually do today?" Git logs exist, but they are designed for machines and version control workflows, not for human reflection. The log is noisy — full of merge commits, rebase artifacts, and terse one-liners with no grouping or context. Scanning it to reconstruct a narrative of your day requires manual effort that most developers simply skip.

Work journals and daily standup notes are commonly kept by hand in a notes app or scratchpad. That means either duplicating the information already encoded in commits, or skipping the journal entirely because it is too much friction. Neither outcome is good.

Individual developers who want a lightweight record of their work — for personal reflection, weekly reviews, or standup prep — have no tool that reads the signal that already exists in their commits and turns it into something readable.

## Appetite

This is a small initiative: a few days of focused work, targeting 3–4 build phases in trellis-exec. The tool should be deliverable and useful quickly. Complexity must be resisted at every turn. If a decision would add a phase to the build, it is probably out of scope.

There is no hard deadline, but the appetite is deliberately constrained to keep the tool simple and shippable. A basic but reliable tool delivered fast is worth more than a feature-complete tool that drags on.

## Shape

A Node.js CLI (`code-diary`) with zero runtime dependencies, written in TypeScript following the conventions in `guidelines.md`.

The core flow:

1. Accept one or more repo paths via CLI arguments, plus an optional date flag (defaults to today).
2. For each repo, shell out to `git log` (synchronous `spawnSync`) to retrieve commits from the target date. Filter out merge commits by default.
3. Parse raw git log output into typed `Commit` objects using a pure parser function that is separately testable.
4. Categorize each commit using heuristics: conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.), file types changed (from `--stat` output), and diff stats.
5. Group commits by repo and branch into a structured `DiaryEntry`.
6. Extract any commit messages tagged with `TIL:` into a "Today I Learned" section.
7. Estimate a time breakdown by bucketing commit timestamps into segments of the day.
8. Generate a formatted markdown entry from the structured data using pure functions.
9. Append the entry to `diary/YYYY-MM.md` in the output directory (default: current working directory), creating the file and `diary/` folder if needed.

Module breakdown follows the guidelines layout: `cli.ts`, `git.ts`, `categorize.ts`, `markdown.ts`, `fileIO.ts`, `types/diary.ts`. Each module owns one responsibility and exposes named exports only.

## No-Gos

- No web UI, no server, no background daemon or file watcher.
- No database. Output is plain markdown files on the filesystem.
- No AI or LLM summarization. All categorization is deterministic heuristics.
- No integration with external services (Slack, Jira, GitHub, Linear, etc.).
- No interactive prompts or TUI. The command runs once and exits.
- No syncing or diffing existing diary files — this tool only appends.
- No support for non-git version control systems (SVN, Mercurial, etc.).
- No `--watch` mode or scheduled execution. Scheduling is the user's concern (cron, etc.).

## Rabbit Holes

**Multi-repo complexity.** It is tempting to build a discovery mechanism that crawls a directory tree for git repos, handles nested repos, detects monorepos, and so on. Keep it simple: the user passes an explicit list of repo paths. Iterate over the list. No discovery, no recursion.

**Timezone normalization.** Git stores commit timestamps with timezone offsets. It is tempting to normalize everything to UTC or to the system timezone. Do not. Use the timezone information git provides as-is. Attempting to normalize across repos from different machines is a correctness trap that adds complexity for negligible benefit.

**Sophisticated time estimation.** Commit timestamps are a rough proxy for time spent. It is tempting to build a heuristic that infers session boundaries, accounts for gaps, or estimates focus time. A simple bucketing approach (morning / afternoon / evening based on commit hour) is enough. Anything more elaborate will be wrong in interesting ways and will take time to build.

**Diff content analysis.** Pulling full diff content per commit to analyze what changed is tempting for richer categorization. The `--stat` output (file names and line counts) is sufficient for heuristic categorization and is much cheaper to parse. Full diff content is a rabbit hole.

**Configuration files.** It is tempting to add a `.code-diary.json` or `~/.config/code-diary/config.json` to store defaults. CLI arguments are enough for the initial version. A config file can be its own small pitch later.
