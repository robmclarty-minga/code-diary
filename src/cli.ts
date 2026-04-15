import { createInterface } from "readline";
import { resolve, join } from "path";
import { existsSync } from "fs";
import type { CliArgs } from "./types/diary.js";
import { readGitLog, parseGitLog } from "./git.js";
import { buildRepoEntry, buildDiaryEntry } from "./categorize.js";
import {
  formatDiaryEntry,
  findExistingEntry,
  replaceEntry,
  appendEntry,
} from "./markdown.js";
import { readFile, writeFile, fileExists } from "./fileIO.js";

const USAGE = `Usage: code-diary <repo-path> [<repo-path>...] [--date <YYYY-MM-DD>] [--output <dir>]\n`;

const HELP = `Usage: code-diary <repo-path> [<repo-path>...] [options]

Read git log output from one or more repos, categorize commits for a given
date, and append a structured markdown entry to a monthly diary file.

Arguments:
  <repo-path>          Path to a git repository (at least one required)

Options:
  --date <YYYY-MM-DD>  Date to generate the entry for (default: today)
  --output <dir>       Directory for diary output (default: current directory)
  -h, --help           Show this help message and exit

Examples:
  code-diary ./my-project
  code-diary ~/repos/api ~/repos/web --date 2026-03-30
  code-diary . --output ~/diary
`;

export const isValidDate = (dateStr: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-") as [string, string, string];
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
};

export const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  const repoPaths: string[] = [];
  let date: string | undefined;
  let outputDir: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (arg === "--date") {
      date = args[i + 1];
      i += 2;
    } else if (arg === "--output") {
      outputDir = args[i + 1];
      i += 2;
    } else {
      repoPaths.push(arg);
      i += 1;
    }
  }

  if (repoPaths.length === 0) {
    process.stderr.write(USAGE);
    process.exit(2);
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
    outputDir: outputDir ?? process.cwd(),
  };
};

export const validateRepoPaths = (paths: string[]): void => {
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

export const promptReplace = (date: string): Promise<boolean> => {
  return new Promise((res) => {
    if (!process.stdin.isTTY) {
      res(false);
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      `An entry for ${date} already exists. Replace it? [y/N] `,
      (answer) => {
        rl.close();
        res(answer === "y" || answer === "Y");
      },
    );
  });
};

export const run = async (argv: string[]): Promise<void> => {
  const cliArgs = parseArgs(argv);
  const { repoPaths, date, outputDir } = cliArgs;

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

  const outputPath = join(resolve(outputDir), "diary", `${date.slice(0, 7)}.md`);

  let existingContent: string | null = null;
  if (fileExists(outputPath)) {
    existingContent = readFile(outputPath);
  }

  if (existingContent !== null && findExistingEntry(existingContent, date)) {
    const shouldReplace = await promptReplace(date);
    if (!shouldReplace) {
      process.exit(1);
    }
    const updated = replaceEntry(existingContent, date, markdown);
    writeFile(outputPath, updated);
  } else {
    const content = appendEntry(existingContent, date, markdown);
    writeFile(outputPath, content);
  }

  process.stdout.write(`Wrote diary entry for ${date} to ${outputPath}\n`);
};
