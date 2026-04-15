import { resolve, join } from "path";
import { existsSync } from "fs";
import { readGitLog, parseGitLog } from "./git.js";
import { buildRepoEntry, buildDiaryEntry } from "./categorize.js";
import { formatDiaryEntry, formatDailyFile, mergeDailyContent, } from "./markdown.js";
import { writeFile, fileExists, readFile } from "./fileIO.js";
import { loadSettings, resolveArgs } from "./config.js";
import { runAggregate } from "./aggregateCli.js";
import { findDailyFiles, generateReports } from "./aggregate.js";
import { parseDailyFile } from "./parseDiary.js";
const USAGE = `Usage: code-diary [<repo-path>...] [--date <YYYY-MM-DD>] [--since <N><d|w|m>] [--output <dir>]
       code-diary aggregate [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--output <dir>]\n`;
const HELP = `Usage: code-diary [<repo-path>...] [options]
       code-diary aggregate [options]

Read git log output from one or more repos, categorize commits for a given
date (or range of dates), and write structured markdown entries to daily
diary files. Days with no commits are skipped silently when ranging.

Arguments:
  <repo-path>          Path to a git repository (reads from config if omitted)

Subcommands:
  aggregate            Generate weekly and monthly reports from daily entries

Options:
  --date <YYYY-MM-DD>  End date of the window (default: today)
  --since <N><d|w|m>   Backfill a window ending at --date and extending back
                       N days (d), weeks (w), or months (m). E.g. 7d, 2w, 1m.
  --output <dir>       Directory for diary output (default: config or cwd)
  -h, --help           Show this help message and exit

Config:
  Settings are read from ~/.code-diary/settings.json (if it exists):
    "output-dir"  (string)    Default output directory
    "repos"       (string[])  Default repo paths (used when none given on CLI)

Examples:
  code-diary ./my-project
  code-diary ~/repos/api ~/repos/web --date 2026-03-30
  code-diary --since 2w                # backfill the last two weeks
  code-diary --since 1m --date 2026-03-31
  code-diary                           # uses repos from config, today only
  code-diary aggregate --from 2026-03-01 --to 2026-03-31
`;
const SINCE_REGEX = /^(\d+)([dwm])$/;
export const parseSince = (s) => {
    const m = s.match(SINCE_REGEX);
    if (!m)
        return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return { n, unit: m[2] };
};
export const computeStartDate = (endDate, offset) => {
    const [yStr, moStr, dStr] = endDate.split("-");
    const dt = new Date(parseInt(yStr, 10), parseInt(moStr, 10) - 1, parseInt(dStr, 10), 12);
    if (offset.unit === "d") {
        dt.setDate(dt.getDate() - offset.n);
    }
    else if (offset.unit === "w") {
        dt.setDate(dt.getDate() - offset.n * 7);
    }
    else {
        dt.setMonth(dt.getMonth() - offset.n);
    }
    return dt.toLocaleDateString("en-CA");
};
export const dateRange = (start, end) => {
    if (start > end)
        return [];
    const [yStr, moStr, dStr] = start.split("-");
    const dt = new Date(parseInt(yStr, 10), parseInt(moStr, 10) - 1, parseInt(dStr, 10), 12);
    const result = [];
    while (true) {
        const iso = dt.toLocaleDateString("en-CA");
        if (iso > end)
            break;
        result.push(iso);
        dt.setDate(dt.getDate() + 1);
    }
    return result;
};
export const isValidDate = (dateStr) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return false;
    }
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (month < 1 || month > 12) {
        return false;
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    return day >= 1 && day <= daysInMonth;
};
export const parseArgs = (argv) => {
    const args = argv.slice(2);
    const repoPaths = [];
    let date;
    let outputDir;
    let since;
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            process.stdout.write(HELP);
            process.exit(0);
        }
        else if (arg === "--date") {
            date = args[i + 1];
            i += 2;
        }
        else if (arg === "--output") {
            outputDir = args[i + 1];
            i += 2;
        }
        else if (arg === "--since") {
            since = args[i + 1];
            i += 2;
        }
        else {
            repoPaths.push(arg);
            i += 1;
        }
    }
    if (date === undefined) {
        date = new Date().toLocaleDateString("en-CA");
    }
    if (!isValidDate(date)) {
        process.stderr.write(`Error: --date must be a valid date in YYYY-MM-DD format.\n`);
        process.exit(2);
    }
    if (since !== undefined && parseSince(since) === null) {
        process.stderr.write(`Error: --since must be <N>d, <N>w, or <N>m (e.g. 7d, 2w, 1m).\n`);
        process.exit(2);
    }
    return {
        repoPaths,
        date,
        outputDir,
        since,
    };
};
export const validateRepoPaths = (paths) => {
    for (const p of paths) {
        const abs = resolve(p);
        if (!existsSync(abs)) {
            process.stderr.write(`Error: path "${p}" does not exist.\n`);
            process.exit(2);
        }
        if (!existsSync(join(abs, ".git"))) {
            process.stderr.write(`Error: "${p}" is not a git repository (no .git found).\n`);
            process.exit(2);
        }
    }
};
export const buildOutputPath = (outputDir, date) => {
    return join(resolve(outputDir), "diary", "daily", `code-diary-${date}.md`);
};
const aggregateMonth = (outputDir, date) => {
    const diaryDir = join(resolve(outputDir), "diary");
    const dailyFiles = findDailyFiles(join(diaryDir, "daily"));
    if (dailyFiles.length === 0) {
        return;
    }
    const month = date.slice(0, 7);
    const days = dailyFiles
        .map((filePath) => parseDailyFile(readFile(filePath)))
        .filter((day) => day.date.startsWith(month));
    if (days.length === 0) {
        return;
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    const { weeklyCount, monthlyCount } = generateReports(diaryDir, days);
    const parts = [];
    if (weeklyCount > 0) {
        parts.push(`${weeklyCount} weekly`);
    }
    if (monthlyCount > 0) {
        parts.push(`${monthlyCount} monthly`);
    }
    if (parts.length > 0) {
        process.stdout.write(`Updated ${parts.join(" and ")} report(s).\n`);
    }
};
const writeEntryForDate = (outputDir, date, repoPaths) => {
    const repoEntries = repoPaths.map((repoPath) => {
        const absPath = resolve(repoPath);
        const raw = readGitLog(absPath, date);
        const commits = parseGitLog(raw);
        return buildRepoEntry(absPath, commits);
    });
    const nonEmpty = repoEntries.filter((r) => r.commits.length > 0);
    if (nonEmpty.length === 0) {
        return false;
    }
    const outputPath = buildOutputPath(outputDir, date);
    const diaryEntry = buildDiaryEntry(date, nonEmpty);
    let content;
    if (fileExists(outputPath)) {
        const existingContent = readFile(outputPath);
        content = mergeDailyContent(existingContent, diaryEntry);
    }
    else {
        const markdown = formatDiaryEntry(diaryEntry);
        content = formatDailyFile(date, markdown);
    }
    writeFile(outputPath, content);
    process.stdout.write(`Wrote diary entry for ${date} to ${outputPath}\n`);
    return true;
};
export const run = async (argv) => {
    const args = argv.slice(2);
    if (args[0] === "aggregate") {
        return runAggregate(argv);
    }
    const cliArgs = parseArgs(argv);
    const settings = loadSettings();
    const resolved = resolveArgs(cliArgs, settings);
    const { repoPaths, date, outputDir } = resolved;
    if (repoPaths.length === 0) {
        process.stderr.write(USAGE);
        process.exit(2);
    }
    validateRepoPaths(repoPaths);
    const dates = cliArgs.since
        ? dateRange(computeStartDate(date, parseSince(cliArgs.since)), date)
        : [date];
    let wroteAny = false;
    for (const d of dates) {
        const wrote = writeEntryForDate(outputDir, d, repoPaths);
        if (wrote) {
            wroteAny = true;
        }
        else if (!cliArgs.since) {
            process.stdout.write(`No commits found for ${d}.\n`);
        }
    }
    if (cliArgs.since && !wroteAny) {
        process.stdout.write(`No commits found between ${dates[0]} and ${dates[dates.length - 1]}.\n`);
    }
    const monthsToAggregate = new Set(dates.map((d) => d.slice(0, 7)));
    for (const month of monthsToAggregate) {
        aggregateMonth(outputDir, `${month}-01`);
    }
};
