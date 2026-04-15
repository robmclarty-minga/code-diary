import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { findDailyFiles, getMonthWeeks, getMonths, buildSummaryTable, collectTilItems, formatWeeklyReport, formatMonthlyReport, generateReports, } from "../aggregate.js";
const makeDayEntry = (overrides = {}) => ({
    date: "2026-03-10",
    rawMarkdown: "## 2026-03-10\n\n### my-repo\n\n- `abc1234` feat: add thing — feat (+5 / -1)\n\n---\n",
    repos: [{ name: "my-repo", commitCount: 1, categories: { feat: 1 } }],
    tilItems: [],
    ...overrides,
});
let tmpDirs = [];
const getTmpDir = () => {
    const dir = join(tmpdir(), `code-diary-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    tmpDirs.push(dir);
    return dir;
};
afterEach(() => {
    for (const dir of tmpDirs) {
        rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});
describe("findDailyFiles", () => {
    it("returns empty array for non-existent directory", () => {
        expect(findDailyFiles("/nonexistent/path")).toEqual([]);
    });
    it("finds and sorts code-diary files", () => {
        const dir = getTmpDir();
        writeFileSync(join(dir, "code-diary-2026-03-30.md"), "content");
        writeFileSync(join(dir, "code-diary-2026-03-28.md"), "content");
        writeFileSync(join(dir, "other-file.md"), "content");
        writeFileSync(join(dir, "code-diary-2026-03-29.md"), "content");
        const files = findDailyFiles(dir);
        expect(files).toHaveLength(3);
        expect(files[0]).toContain("2026-03-28");
        expect(files[1]).toContain("2026-03-29");
        expect(files[2]).toContain("2026-03-30");
    });
});
describe("getMonthWeeks", () => {
    it("splits March 2026 into 5 weeks", () => {
        const weeks = getMonthWeeks("2026-03");
        expect(weeks).toHaveLength(5);
        expect(weeks[0].slug).toBe("2026-03-W1");
        expect(weeks[0].from).toBe("2026-03-01");
        expect(weeks[0].to).toBe("2026-03-07");
        expect(weeks[4].slug).toBe("2026-03-W5");
        expect(weeks[4].from).toBe("2026-03-29");
        expect(weeks[4].to).toBe("2026-03-31");
    });
    it("handles February in non-leap year (28 days = 4 weeks)", () => {
        const weeks = getMonthWeeks("2026-02");
        expect(weeks).toHaveLength(4);
        expect(weeks[3].to).toBe("2026-02-28");
    });
    it("handles February in leap year", () => {
        const weeks = getMonthWeeks("2024-02");
        expect(weeks).toHaveLength(5);
        expect(weeks[4].from).toBe("2024-02-29");
        expect(weeks[4].to).toBe("2024-02-29");
    });
});
describe("getMonths", () => {
    it("returns months spanning a range", () => {
        expect(getMonths("2026-02-15", "2026-04-10")).toEqual([
            "2026-02", "2026-03", "2026-04",
        ]);
    });
    it("handles year boundary", () => {
        expect(getMonths("2025-11-01", "2026-01-15")).toEqual([
            "2025-11", "2025-12", "2026-01",
        ]);
    });
    it("returns single month for same-month range", () => {
        expect(getMonths("2026-03-01", "2026-03-31")).toEqual(["2026-03"]);
    });
});
describe("buildSummaryTable", () => {
    it("builds table with repo stats", () => {
        const days = [
            makeDayEntry({ repos: [
                    { name: "api", commitCount: 3, categories: { feat: 2, fix: 1 } },
                    { name: "web", commitCount: 1, categories: { docs: 1 } },
                ] }),
            makeDayEntry({ repos: [
                    { name: "api", commitCount: 2, categories: { feat: 1, refactor: 1 } },
                ] }),
        ];
        const table = buildSummaryTable(days);
        expect(table).toContain("| api | 5 |");
        expect(table).toContain("| web | 1 |");
    });
    it("returns empty string for no data", () => {
        expect(buildSummaryTable([])).toBe("");
    });
});
describe("collectTilItems", () => {
    it("collects TIL items from all days", () => {
        const days = [
            makeDayEntry({ tilItems: ["learned A"] }),
            makeDayEntry({ tilItems: ["learned B", "learned C"] }),
        ];
        expect(collectTilItems(days)).toEqual(["learned A", "learned B", "learned C"]);
    });
});
describe("formatWeeklyReport", () => {
    it("produces report with header, summary, and daily entries", () => {
        const week = {
            slug: "2026-03-W2",
            month: "2026-03",
            weekNum: 2,
            from: "2026-03-08",
            to: "2026-03-14",
        };
        const days = [
            makeDayEntry({ date: "2026-03-10", tilItems: ["something cool"] }),
            makeDayEntry({ date: "2026-03-12" }),
        ];
        const report = formatWeeklyReport(week, days);
        expect(report).toContain("# Weekly Report — 2026-03-W2 (2026-03-08 to 2026-03-14)");
        expect(report).toContain("## Summary");
        expect(report).toContain("## TIL Items");
        expect(report).toContain("- something cool");
        expect(report).toContain("## Daily Entries");
        // Reverse chronological
        const idx10 = report.indexOf("2026-03-10");
        const idx12 = report.indexOf("2026-03-12");
        expect(idx12).toBeLessThan(idx10);
    });
});
describe("formatMonthlyReport", () => {
    it("produces report with month header", () => {
        const days = [makeDayEntry({ date: "2026-03-10" })];
        const report = formatMonthlyReport("2026-03", days);
        expect(report).toContain("# Monthly Report — 2026-03");
        expect(report).toContain("## Summary");
        expect(report).toContain("## Daily Entries");
    });
});
describe("generateReports", () => {
    it("generates weekly and monthly reports for days with entries", () => {
        const dir = getTmpDir();
        mkdirSync(join(dir, "daily"), { recursive: true });
        const days = [
            makeDayEntry({ date: "2026-03-10" }),
            makeDayEntry({ date: "2026-03-12" }),
        ];
        const { weeklyCount, monthlyCount } = generateReports(dir, days);
        expect(weeklyCount).toBe(1);
        expect(monthlyCount).toBe(1);
    });
    it("skips already-aggregated periods", () => {
        const dir = getTmpDir();
        mkdirSync(join(dir, "daily"), { recursive: true });
        mkdirSync(join(dir, "weekly"), { recursive: true });
        mkdirSync(join(dir, "monthly"), { recursive: true });
        writeFileSync(join(dir, "weekly", "code-diary-2026-03-W2.md"), "existing");
        writeFileSync(join(dir, "monthly", "code-diary-2026-03.md"), "existing");
        const days = [
            makeDayEntry({ date: "2026-03-10" }),
        ];
        const { weeklyCount, monthlyCount } = generateReports(dir, days);
        expect(weeklyCount).toBe(0);
        expect(monthlyCount).toBe(0);
    });
    it("returns zero counts for empty days", () => {
        const dir = getTmpDir();
        const { weeklyCount, monthlyCount } = generateReports(dir, []);
        expect(weeklyCount).toBe(0);
        expect(monthlyCount).toBe(0);
    });
});
