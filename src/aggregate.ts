import { join } from "path";
import { readdirSync } from "fs";
import type {
  AuthorSummary,
  ParsedDiaryDay,
  WeekDescriptor,
  YearDescriptor,
} from "./types/aggregate.js";
import { fileExists, writeFile } from "./fileIO.js";

export const findDailyFiles = (dailyDir: string): string[] => {
  if (!fileExists(dailyDir)) {
    return [];
  }
  const entries = readdirSync(dailyDir);
  return entries
    .filter((f) => /^code-diary-\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .map((f) => join(dailyDir, f));
};

export const getMonthWeeks = (month: string): WeekDescriptor[] => {
  const [yearStr, monthStr] = month.split("-") as [string, string];
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const weeks: WeekDescriptor[] = [];

  let weekNum = 1;
  let dayStart = 1;
  while (dayStart <= daysInMonth) {
    const dayEnd = Math.min(dayStart + 6, daysInMonth);
    const fromDate = `${month}-${String(dayStart).padStart(2, "0")}`;
    const toDate = `${month}-${String(dayEnd).padStart(2, "0")}`;
    weeks.push({
      slug: `${month}-W${weekNum}`,
      month,
      weekNum,
      from: fromDate,
      to: toDate,
    });
    weekNum += 1;
    dayStart = dayEnd + 1;
  }

  return weeks;
};

export const getYears = (from: string, to: string): YearDescriptor[] => {
  const years: YearDescriptor[] = [];
  const startYear = parseInt(from.slice(0, 4), 10);
  const endYear = parseInt(to.slice(0, 4), 10);

  for (let y = startYear; y <= endYear; y++) {
    const yearStr = String(y);
    years.push({
      year: yearStr,
      from: `${yearStr}-01-01`,
      to: `${yearStr}-12-31`,
    });
  }

  return years;
};

export const getMonths = (from: string, to: string): string[] => {
  const months: string[] = [];
  const start = from.slice(0, 7);
  const end = to.slice(0, 7);

  let current = start;
  while (current <= end) {
    months.push(current);
    const [yStr, mStr] = current.split("-") as [string, string];
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    current = `${y}-${String(m).padStart(2, "0")}`;
  }

  return months;
};

const CATEGORY_ORDER = ["feat", "fix", "refactor", "docs", "chore", "test", "style", "perf", "build", "ci", "other"];

export const buildSummaryTable = (days: ParsedDiaryDay[]): string => {
  const repoStats = new Map<string, { total: number; categories: Record<string, number> }>();

  for (const day of days) {
    for (const repo of day.repos) {
      let stats = repoStats.get(repo.name);
      if (!stats) {
        stats = { total: 0, categories: {} };
        repoStats.set(repo.name, stats);
      }
      stats.total += repo.commitCount;
      for (const [cat, count] of Object.entries(repo.categories)) {
        stats.categories[cat] = (stats.categories[cat] ?? 0) + count;
      }
    }
  }

  if (repoStats.size === 0) {
    return "";
  }

  const header = `| Repo | Commits | ${CATEGORY_ORDER.join(" | ")} |`;
  const divider = `|${Array.from({ length: CATEGORY_ORDER.length + 2 }, () => "------").join("|")}|`;

  const rows: string[] = [];
  for (const [name, stats] of repoStats) {
    const cats = CATEGORY_ORDER.map((c) => String(stats.categories[c] ?? 0));
    rows.push(`| ${name} | ${stats.total} | ${cats.join(" | ")} |`);
  }

  return [header, divider, ...rows].join("\n");
};

export const buildAuthorTable = (days: ParsedDiaryDay[]): string => {
  const totals = new Map<string, AuthorSummary>();

  for (const day of days) {
    for (const author of day.authors) {
      let entry = totals.get(author.name);
      if (!entry) {
        entry = { name: author.name, commits: 0, insertions: 0, deletions: 0 };
        totals.set(author.name, entry);
      }
      entry.commits += author.commits;
      entry.insertions += author.insertions;
      entry.deletions += author.deletions;
    }
  }

  if (totals.size === 0) {
    return "";
  }

  const header = "| Author | Commits | Insertions | Deletions |";
  const divider = "|------|------|------|------|";
  const rows = [...totals.values()]
    .sort((a, b) => b.commits - a.commits)
    .map(
      (a) => `| ${a.name} | ${a.commits} | ${a.insertions} | ${a.deletions} |`,
    );

  return [header, divider, ...rows].join("\n");
};

export const collectTilItems = (days: ParsedDiaryDay[]): string[] => {
  const items: string[] = [];
  for (const day of days) {
    for (const til of day.tilItems) {
      items.push(til);
    }
  }
  return items;
};

export const formatWeeklyReport = (week: WeekDescriptor, days: ParsedDiaryDay[]): string => {
  const lines: string[] = [
    `# Weekly Report — ${week.slug} (${week.from} to ${week.to})`,
    "",
    "## Summary",
    "",
  ];

  const table = buildSummaryTable(days);
  if (table) {
    lines.push(table, "");
  }

  const authorTable = buildAuthorTable(days);
  if (authorTable) {
    lines.push("## Authors", "", authorTable, "");
  }

  const tilItems = collectTilItems(days);
  if (tilItems.length > 0) {
    lines.push("## TIL Items", "");
    for (const til of tilItems) {
      lines.push(`- ${til}`);
    }
    lines.push("");
  }

  lines.push("## Daily Entries", "");

  const reversed = [...days].sort((a, b) => b.date.localeCompare(a.date));
  for (const day of reversed) {
    lines.push(day.rawMarkdown.trimEnd(), "");
  }

  return lines.join("\n");
};

export const formatMonthlyReport = (month: string, days: ParsedDiaryDay[]): string => {
  const lines: string[] = [
    `# Monthly Report — ${month}`,
    "",
    "## Summary",
    "",
  ];

  const table = buildSummaryTable(days);
  if (table) {
    lines.push(table, "");
  }

  const authorTable = buildAuthorTable(days);
  if (authorTable) {
    lines.push("## Authors", "", authorTable, "");
  }

  const tilItems = collectTilItems(days);
  if (tilItems.length > 0) {
    lines.push("## TIL Items", "");
    for (const til of tilItems) {
      lines.push(`- ${til}`);
    }
    lines.push("");
  }

  lines.push("## Daily Entries", "");

  const reversed = [...days].sort((a, b) => b.date.localeCompare(a.date));
  for (const day of reversed) {
    lines.push(day.rawMarkdown.trimEnd(), "");
  }

  return lines.join("\n");
};

export const formatYearlyReport = (
  year: YearDescriptor,
  days: ParsedDiaryDay[],
): string => {
  const lines: string[] = [
    `# Yearly Report — ${year.year}`,
    "",
    "## Summary",
    "",
  ];

  const table = buildSummaryTable(days);
  if (table) {
    lines.push(table, "");
  }

  const authorTable = buildAuthorTable(days);
  if (authorTable) {
    lines.push("## Authors", "", authorTable, "");
  }

  const tilItems = collectTilItems(days);
  if (tilItems.length > 0) {
    lines.push("## TIL Items", "");
    for (const til of tilItems) {
      lines.push(`- ${til}`);
    }
    lines.push("");
  }

  lines.push("## Monthly Breakdown", "");

  const months = getMonths(year.from, year.to);
  for (const month of months) {
    const monthDays = days.filter((d) => d.date.startsWith(month));
    if (monthDays.length === 0) {
      continue;
    }
    const commitCount = monthDays.reduce(
      (sum, d) => sum + d.repos.reduce((s, r) => s + r.commitCount, 0),
      0,
    );
    lines.push(`- **${month}** — ${monthDays.length} day(s), ${commitCount} commit(s)`);
  }

  return lines.join("\n");
};

export const generateYearlyReports = (
  diaryDir: string,
  days: ParsedDiaryDay[],
): { yearlyCount: number } => {
  let yearlyCount = 0;
  if (days.length === 0) {
    return { yearlyCount };
  }

  const from = days[0]!.date;
  const to = days[days.length - 1]!.date;
  const years = getYears(from, to);

  for (const year of years) {
    const yearDays = days.filter((d) => d.date.startsWith(year.year));
    if (yearDays.length === 0) {
      continue;
    }
    const yearPath = join(diaryDir, "yearly", `code-diary-${year.year}.md`);
    const report = formatYearlyReport(year, yearDays);
    writeFile(yearPath, report);
    yearlyCount += 1;
  }

  return { yearlyCount };
};

export const generateReports = (
  diaryDir: string,
  days: ParsedDiaryDay[],
): { weeklyCount: number; monthlyCount: number } => {
  let weeklyCount = 0;
  let monthlyCount = 0;

  if (days.length === 0) {
    return { weeklyCount, monthlyCount };
  }

  const from = days[0]!.date;
  const to = days[days.length - 1]!.date;
  const months = getMonths(from, to);

  for (const month of months) {
    const monthDays = days.filter((d) => d.date.startsWith(month));
    if (monthDays.length === 0) {
      continue;
    }

    const weeks = getMonthWeeks(month);
    for (const week of weeks) {
      const weekDays = monthDays.filter((d) => d.date >= week.from && d.date <= week.to);
      if (weekDays.length === 0) {
        continue;
      }

      const weekPath = join(diaryDir, "weekly", `code-diary-${week.slug}.md`);
      const report = formatWeeklyReport(week, weekDays);
      writeFile(weekPath, report);
      weeklyCount += 1;
    }

    const monthPath = join(diaryDir, "monthly", `code-diary-${month}.md`);
    const report = formatMonthlyReport(month, monthDays);
    writeFile(monthPath, report);
    monthlyCount += 1;
  }

  return { weeklyCount, monthlyCount };
};
