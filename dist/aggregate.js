import { join } from "path";
import { readdirSync } from "fs";
import { fileExists, writeFile } from "./fileIO.js";
export const findDailyFiles = (dailyDir) => {
    if (!fileExists(dailyDir)) {
        return [];
    }
    const entries = readdirSync(dailyDir);
    return entries
        .filter((f) => /^code-diary-\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort()
        .map((f) => join(dailyDir, f));
};
export const getMonthWeeks = (month) => {
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const weeks = [];
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
export const getMonths = (from, to) => {
    const months = [];
    const start = from.slice(0, 7);
    const end = to.slice(0, 7);
    let current = start;
    while (current <= end) {
        months.push(current);
        const [yStr, mStr] = current.split("-");
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
export const buildSummaryTable = (days) => {
    const repoStats = new Map();
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
    const rows = [];
    for (const [name, stats] of repoStats) {
        const cats = CATEGORY_ORDER.map((c) => String(stats.categories[c] ?? 0));
        rows.push(`| ${name} | ${stats.total} | ${cats.join(" | ")} |`);
    }
    return [header, divider, ...rows].join("\n");
};
export const collectTilItems = (days) => {
    const items = [];
    for (const day of days) {
        for (const til of day.tilItems) {
            items.push(til);
        }
    }
    return items;
};
export const formatWeeklyReport = (week, days) => {
    const lines = [
        `# Weekly Report — ${week.slug} (${week.from} to ${week.to})`,
        "",
        "## Summary",
        "",
    ];
    const table = buildSummaryTable(days);
    if (table) {
        lines.push(table, "");
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
export const formatMonthlyReport = (month, days) => {
    const lines = [
        `# Monthly Report — ${month}`,
        "",
        "## Summary",
        "",
    ];
    const table = buildSummaryTable(days);
    if (table) {
        lines.push(table, "");
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
export const generateReports = (diaryDir, days) => {
    let weeklyCount = 0;
    let monthlyCount = 0;
    if (days.length === 0) {
        return { weeklyCount, monthlyCount };
    }
    const from = days[0].date;
    const to = days[days.length - 1].date;
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
            if (!fileExists(weekPath)) {
                const report = formatWeeklyReport(week, weekDays);
                writeFile(weekPath, report);
                weeklyCount += 1;
            }
        }
        const monthPath = join(diaryDir, "monthly", `code-diary-${month}.md`);
        if (!fileExists(monthPath)) {
            const report = formatMonthlyReport(month, monthDays);
            writeFile(monthPath, report);
            monthlyCount += 1;
        }
    }
    return { weeklyCount, monthlyCount };
};
