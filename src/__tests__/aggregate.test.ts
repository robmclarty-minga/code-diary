import { describe, it, expect, vi, afterEach } from "vitest";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import {
  findDailyFiles,
  getMonthWeeks,
  getMonths,
  getYears,
  buildSummaryTable,
  buildAuthorTable,
  collectTilItems,
  formatWeeklyReport,
  formatMonthlyReport,
  formatYearlyReport,
  generateReports,
  generateYearlyReports,
} from "../aggregate.js";
import { existsSync, readFileSync } from "fs";
import type {
  ParsedDiaryDay,
  WeekDescriptor,
  YearDescriptor,
} from "../types/aggregate.js";

const makeDayEntry = (overrides: Partial<ParsedDiaryDay> = {}): ParsedDiaryDay => ({
  date: "2026-03-10",
  rawMarkdown: "## 2026-03-10\n\n### my-repo\n\n- `abc1234` feat: add thing — feat (+5 / -1)\n\n---\n",
  repos: [{ name: "my-repo", commitCount: 1, categories: { feat: 1 } }],
  tilItems: [],
  authors: [],
  ...overrides,
});

let tmpDirs: string[] = [];
const getTmpDir = (): string => {
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
    expect(weeks[0]!.slug).toBe("2026-03-W1");
    expect(weeks[0]!.from).toBe("2026-03-01");
    expect(weeks[0]!.to).toBe("2026-03-07");
    expect(weeks[4]!.slug).toBe("2026-03-W5");
    expect(weeks[4]!.from).toBe("2026-03-29");
    expect(weeks[4]!.to).toBe("2026-03-31");
  });

  it("handles February in non-leap year (28 days = 4 weeks)", () => {
    const weeks = getMonthWeeks("2026-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[3]!.to).toBe("2026-02-28");
  });

  it("handles February in leap year", () => {
    const weeks = getMonthWeeks("2024-02");
    expect(weeks).toHaveLength(5);
    expect(weeks[4]!.from).toBe("2024-02-29");
    expect(weeks[4]!.to).toBe("2024-02-29");
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
      ]}),
      makeDayEntry({ repos: [
        { name: "api", commitCount: 2, categories: { feat: 1, refactor: 1 } },
      ]}),
    ];

    const table = buildSummaryTable(days);
    expect(table).toContain("| api | 5 |");
    expect(table).toContain("| web | 1 |");
  });

  it("returns empty string for no data", () => {
    expect(buildSummaryTable([])).toBe("");
  });
});

describe("buildAuthorTable", () => {
  it("sums commits and line counts per author across days", () => {
    const days = [
      makeDayEntry({
        authors: [
          { name: "Jane Dev", commits: 2, insertions: 10, deletions: 3 },
          { name: "John Coder", commits: 1, insertions: 4, deletions: 1 },
        ],
      }),
      makeDayEntry({
        authors: [
          { name: "Jane Dev", commits: 1, insertions: 5, deletions: 2 },
        ],
      }),
    ];

    const table = buildAuthorTable(days);

    expect(table).toContain("| Author | Commits | Insertions | Deletions |");
    expect(table).toContain("| Jane Dev | 3 | 15 | 5 |");
    expect(table).toContain("| John Coder | 1 | 4 | 1 |");
  });

  it("orders rows by commit count descending", () => {
    const days = [
      makeDayEntry({
        authors: [
          { name: "Alice", commits: 1, insertions: 1, deletions: 0 },
          { name: "Bob", commits: 5, insertions: 10, deletions: 2 },
        ],
      }),
    ];

    const table = buildAuthorTable(days);
    const bobIdx = table.indexOf("| Bob |");
    const aliceIdx = table.indexOf("| Alice |");
    expect(bobIdx).toBeGreaterThan(-1);
    expect(aliceIdx).toBeGreaterThan(-1);
    expect(bobIdx).toBeLessThan(aliceIdx);
  });

  it("returns empty string when no author data", () => {
    expect(buildAuthorTable([])).toBe("");
    expect(buildAuthorTable([makeDayEntry({ authors: [] })])).toBe("");
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
    const week: WeekDescriptor = {
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

  it("includes Authors section when author data is present", () => {
    const days = [
      makeDayEntry({
        date: "2026-03-10",
        authors: [{ name: "Jane Dev", commits: 2, insertions: 8, deletions: 1 }],
      }),
    ];
    const report = formatMonthlyReport("2026-03", days);
    expect(report).toContain("## Authors");
    expect(report).toContain("| Jane Dev | 2 | 8 | 1 |");
  });

  it("omits Authors section when no author data", () => {
    const days = [makeDayEntry({ date: "2026-03-10", authors: [] })];
    const report = formatMonthlyReport("2026-03", days);
    expect(report).not.toContain("## Authors");
  });
});

describe("getYears", () => {
  it("returns one year for a same-year range", () => {
    const years = getYears("2026-01-05", "2026-11-20");
    expect(years).toHaveLength(1);
    expect(years[0]!.year).toBe("2026");
    expect(years[0]!.from).toBe("2026-01-01");
    expect(years[0]!.to).toBe("2026-12-31");
  });

  it("spans multiple years inclusive", () => {
    const years = getYears("2024-06-01", "2026-02-15");
    expect(years.map((y) => y.year)).toEqual(["2024", "2025", "2026"]);
  });
});

describe("formatYearlyReport", () => {
  const year: YearDescriptor = {
    year: "2026",
    from: "2026-01-01",
    to: "2026-12-31",
  };

  it("includes header, summary, and monthly breakdown", () => {
    const days = [
      makeDayEntry({ date: "2026-03-10" }),
      makeDayEntry({ date: "2026-05-04" }),
    ];
    const report = formatYearlyReport(year, days);

    expect(report).toContain("# Yearly Report — 2026");
    expect(report).toContain("## Summary");
    expect(report).toContain("## Monthly Breakdown");
    expect(report).toContain("**2026-03**");
    expect(report).toContain("**2026-05**");
  });

  it("skips months with no activity in the breakdown", () => {
    const days = [makeDayEntry({ date: "2026-06-10" })];
    const report = formatYearlyReport(year, days);
    expect(report).toContain("**2026-06**");
    expect(report).not.toContain("**2026-01**");
    expect(report).not.toContain("**2026-12**");
  });

  it("includes Authors section when author data is present", () => {
    const days = [
      makeDayEntry({
        date: "2026-03-10",
        authors: [{ name: "Jane Dev", commits: 5, insertions: 30, deletions: 7 }],
      }),
    ];
    const report = formatYearlyReport(year, days);
    expect(report).toContain("## Authors");
    expect(report).toContain("| Jane Dev | 5 | 30 | 7 |");
  });
});

describe("generateYearlyReports", () => {
  it("writes a yearly report file per year with data", () => {
    const dir = getTmpDir();
    const days = [
      makeDayEntry({ date: "2025-11-10" }),
      makeDayEntry({ date: "2026-02-15" }),
    ];

    const { yearlyCount } = generateYearlyReports(dir, days);

    expect(yearlyCount).toBe(2);
    expect(existsSync(join(dir, "yearly", "code-diary-2025.md"))).toBe(true);
    expect(existsSync(join(dir, "yearly", "code-diary-2026.md"))).toBe(true);
    const content2025 = readFileSync(join(dir, "yearly", "code-diary-2025.md"), "utf8");
    expect(content2025).toContain("# Yearly Report — 2025");
  });

  it("returns zero when no days provided", () => {
    const dir = getTmpDir();
    const { yearlyCount } = generateYearlyReports(dir, []);
    expect(yearlyCount).toBe(0);
  });

  it("skips years with no data even within range", () => {
    const dir = getTmpDir();
    const days = [
      makeDayEntry({ date: "2024-05-01" }),
      makeDayEntry({ date: "2026-07-01" }),
    ];
    const { yearlyCount } = generateYearlyReports(dir, days);
    expect(yearlyCount).toBe(2);
    expect(existsSync(join(dir, "yearly", "code-diary-2025.md"))).toBe(false);
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

  it("overwrites existing reports with latest data", () => {
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

    expect(weeklyCount).toBe(1);
    expect(monthlyCount).toBe(1);
  });

  it("returns zero counts for empty days", () => {
    const dir = getTmpDir();
    const { weeklyCount, monthlyCount } = generateReports(dir, []);
    expect(weeklyCount).toBe(0);
    expect(monthlyCount).toBe(0);
  });
});
