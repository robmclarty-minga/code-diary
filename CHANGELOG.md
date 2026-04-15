# Changelog

## 1.1.0

- Create project configuration, types, and module stubs
- Correct SHA lengths to 40 characters in gitLog.txt
- Implement core data pipeline parsing and categorization
- Implement parseGitLog, readGitLog, and all categorize.ts functions
- Implement markdown generation, entry management, and file I/O
- Implement CLI argument parsing, validation, and orchestration
- Add unit tests for parseArgs, isValidDate, and validateRepoPaths
- Implement full CLI wiring with TTY-aware readline and orchestration pipeline
- Swap commit separator to lead each block instead of trail
- Add --help / -h flag with usage documentation
- Use NUL-byte sentinels to prevent body text from breaking parser
- Add settings.json loader with CLI arg merging
- Switch to daily single-entry files
- Integrate config, daily output path, and aggregate routing
- Add subcommand for weekly and monthly reports
- Add commit-til skill for conventional commits and TIL extraction
- Add daily file merge logic
- Always regenerate reports from latest data
- Auto-merge daily files and trigger aggregate
- Expand ~ in repo and output-dir paths
- Add --since flag for date-range backfill
- Add authors setting for multi-identity filtering
- Filter commits by author email in git log
- Resolve per-repo author identity and wire through pipeline
- Remove diary/ subdirectory nesting from output paths
- Add version bump skill with skills 2.0 best practices
- Use hash-based release boundary detection in version skill
