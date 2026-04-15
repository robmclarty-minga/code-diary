import { resolve, join } from "path";
import { loadSettings, expandTilde } from "./config.js";
import { isValidDate } from "./cli.js";
import { findDailyFiles, generateReports } from "./aggregate.js";
import { parseDailyFile } from "./parseDiary.js";
import { readFile } from "./fileIO.js";
const AGGREGATE_USAGE = `Usage: code-diary aggregate [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--output <dir>]\n`;
const AGGREGATE_HELP = `Usage: code-diary aggregate [options]

Generate weekly and monthly reports from daily diary entries.
Reports are regenerated from the latest daily entry data.

Options:
  --from <YYYY-MM-DD>  Start date (default: earliest diary entry)
  --to <YYYY-MM-DD>    End date (default: today)
  --output <dir>       Diary output directory (default: config or cwd)
  -h, --help           Show this help message and exit

Examples:
  code-diary aggregate
  code-diary aggregate --from 2026-03-01 --to 2026-03-31
  code-diary aggregate --output ~/diary
`;
export const parseAggregateArgs = (argv) => {
    const args = argv.slice(3);
    let from;
    let to;
    let outputDir;
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            process.stdout.write(AGGREGATE_HELP);
            process.exit(0);
        }
        else if (arg === "--from") {
            from = args[i + 1];
            i += 2;
        }
        else if (arg === "--to") {
            to = args[i + 1];
            i += 2;
        }
        else if (arg === "--output") {
            outputDir = args[i + 1];
            i += 2;
        }
        else {
            process.stderr.write(`Unknown argument: ${arg}\n`);
            process.stderr.write(AGGREGATE_USAGE);
            process.exit(2);
        }
    }
    if (from !== undefined && !isValidDate(from)) {
        process.stderr.write(`Error: --from must be a valid date in YYYY-MM-DD format.\n`);
        process.exit(2);
    }
    if (to !== undefined && !isValidDate(to)) {
        process.stderr.write(`Error: --to must be a valid date in YYYY-MM-DD format.\n`);
        process.exit(2);
    }
    const settings = loadSettings();
    const resolvedDir = outputDir ?? settings["output-dir"] ?? process.cwd();
    const diaryDir = join(resolve(expandTilde(resolvedDir)), "diary");
    const today = new Date().toLocaleDateString("en-CA");
    return {
        diaryDir,
        from: from ?? "1970-01-01",
        to: to ?? today,
    };
};
export const runAggregate = async (argv) => {
    const aggArgs = parseAggregateArgs(argv);
    const { diaryDir, from, to } = aggArgs;
    const dailyFiles = findDailyFiles(join(diaryDir, "daily"));
    if (dailyFiles.length === 0) {
        process.stdout.write(`No daily diary files found in ${join(diaryDir, "daily")}\n`);
        return;
    }
    const days = dailyFiles.map((filePath) => {
        const content = readFile(filePath);
        return parseDailyFile(content);
    }).filter((day) => day.date >= from && day.date <= to);
    if (days.length === 0) {
        process.stdout.write(`No diary entries found in the specified date range.\n`);
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
    process.stdout.write(`Generated ${parts.join(" and ")} report(s) in ${diaryDir}\n`);
};
