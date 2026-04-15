import { createInterface } from "readline";
import { resolve, join } from "path";
import { existsSync } from "fs";
import { readGitLog, parseGitLog } from "./git.js";
import { buildRepoEntry, buildDiaryEntry } from "./categorize.js";
import { formatDiaryEntry, formatDailyFile, } from "./markdown.js";
import { writeFile, fileExists } from "./fileIO.js";
import { loadSettings, resolveArgs } from "./config.js";
import { runAggregate } from "./aggregateCli.js";
const USAGE = `Usage: code-diary [<repo-path>...] [--date <YYYY-MM-DD>] [--output <dir>]
       code-diary aggregate [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--output <dir>]\n`;
const HELP = `Usage: code-diary [<repo-path>...] [options]
       code-diary aggregate [options]

Read git log output from one or more repos, categorize commits for a given
date, and write a structured markdown entry to a daily diary file.

Arguments:
  <repo-path>          Path to a git repository (reads from config if omitted)

Subcommands:
  aggregate            Generate weekly and monthly reports from daily entries

Options:
  --date <YYYY-MM-DD>  Date to generate the entry for (default: today)
  --output <dir>       Directory for diary output (default: config or cwd)
  -h, --help           Show this help message and exit

Config:
  Settings are read from ~/.code-diary/settings.json (if it exists):
    "output-dir"  (string)    Default output directory
    "repos"       (string[])  Default repo paths (used when none given on CLI)

Examples:
  code-diary ./my-project
  code-diary ~/repos/api ~/repos/web --date 2026-03-30
  code-diary . --output ~/diary
  code-diary                          # uses repos from config
  code-diary aggregate --from 2026-03-01 --to 2026-03-31
`;
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
    return {
        repoPaths,
        date,
        outputDir,
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
export const promptReplace = (date) => {
    return new Promise((res) => {
        if (!process.stdin.isTTY) {
            res(false);
            return;
        }
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`An entry for ${date} already exists. Replace it? [y/N] `, (answer) => {
            rl.close();
            res(answer === "y" || answer === "Y");
        });
    });
};
export const buildOutputPath = (outputDir, date) => {
    return join(resolve(outputDir), "diary", "daily", `code-diary-${date}.md`);
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
    const repoEntries = repoPaths.map((repoPath) => {
        const absPath = resolve(repoPath);
        const raw = readGitLog(absPath, date);
        const commits = parseGitLog(raw);
        return buildRepoEntry(absPath, commits);
    });
    const nonEmpty = repoEntries.filter((r) => r.commits.length > 0);
    if (nonEmpty.length === 0) {
        process.stdout.write(`No commits found for ${date}.\n`);
        return;
    }
    const diaryEntry = buildDiaryEntry(date, nonEmpty);
    const markdown = formatDiaryEntry(diaryEntry);
    const outputPath = buildOutputPath(outputDir, date);
    if (fileExists(outputPath)) {
        const shouldReplace = await promptReplace(date);
        if (!shouldReplace) {
            process.exit(1);
        }
    }
    const content = formatDailyFile(date, markdown);
    writeFile(outputPath, content);
    process.stdout.write(`Wrote diary entry for ${date} to ${outputPath}\n`);
};
