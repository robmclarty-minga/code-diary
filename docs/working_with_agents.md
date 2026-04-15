# Working with AI Agents

code-diary is a small CLI that produces structured markdown. That combination — small surface area, plain text output, single command invocation — makes it useful as a building block for AI agents that need context about what you've been working on.

## Why agents like this tool

Most AI agents operate by reading text and calling shell commands. code-diary fits that model exactly:

- **Single command, zero interaction.** `code-diary` runs to completion and exits. No prompts, no interactive menus, no confirmation dialogs. An agent can shell out to it the same way it runs `git status` or `ls`.
- **Structured markdown output.** The daily files follow a predictable format: a date heading, a TIL section, per-repo commit lists with SHAs, categories, and diff stats. An agent can parse this reliably or simply include it as context.
- **Idempotent.** An agent can run code-diary multiple times without worrying about duplicate entries or corrupted state. If it ran earlier in the day, running again just merges in new commits.
- **Zero exit code on success.** Standard unix conventions — agents don't need special error handling beyond checking the exit code.

## Patterns

### Morning briefing

An agent that prepares a daily briefing can run code-diary as its first step to gather a structured summary of yesterday's work:

```bash
code-diary --date $(date -v-1d +%Y-%m-%d)
```

Then read the resulting daily file and use it as context for summarizing activity, drafting standup notes, or comparing against today's calendar.

### Catch-up after time away

An agent helping you prepare for a Monday standup or a return from vacation can backfill an entire range:

```bash
code-diary --since 1w
```

This generates entries for each day in the last week (skipping days with no commits), plus updated weekly and monthly reports. The agent can then read the weekly report for a consolidated view.

### Retro and review prep

Before a sprint retro or a performance review, an agent can generate a month's worth of diary entries and read the monthly report:

```bash
code-diary --since 1m --date 2026-03-31
```

The monthly report includes a summary table of commits per repo broken down by category (features, fixes, refactors, etc.) and all TIL items — exactly the kind of structured data an agent needs to draft a review summary.

### Scheduled automation

Pair code-diary with a cron job or a scheduled agent trigger so diary entries accumulate without any manual invocation:

```bash
# crontab: run at end of each workday
0 18 * * 1-5 code-diary
```

Other agents or automations can then read from the output directory at any time, knowing the data is current.

### Feeding other tools

The output files are plain markdown in a predictable directory structure:

```
<output-dir>/
  daily/    # code-diary-YYYY-MM-DD.md
  weekly/   # code-diary-YYYY-MM-W#.md
  monthly/  # code-diary-YYYY-MM.md
```

An agent can:

- Read a specific day: `cat <output-dir>/daily/code-diary-2026-04-15.md`
- List available entries: `ls <output-dir>/daily/`
- Search across all entries: `grep -r "TIL:" <output-dir>/daily/`
- Include a weekly summary as context for a larger task

Because the format is markdown, agents can include diary content directly in their context window without any transformation step.

## Design choices that matter for agents

**No API key, no network calls.** code-diary reads local git repos and writes local files. An agent doesn't need to manage credentials, handle rate limits, or deal with network failures.

**Predictable file naming.** Files are named `code-diary-YYYY-MM-DD.md` (daily), `code-diary-YYYY-MM-W#.md` (weekly), and `code-diary-YYYY-MM.md` (monthly). An agent can construct the expected path for any date without listing the directory.

**Config-driven defaults.** Once `~/.code-diary/settings.json` is set up with repos, authors, and output directory, the agent invocation is just `code-diary` with no arguments. Less to template, less to get wrong.

**Small, auditable codebase.** The entire tool is roughly a dozen TypeScript files with zero runtime dependencies. If an agent's operator wants to understand exactly what a tool does before granting it shell access, code-diary is easy to audit.
