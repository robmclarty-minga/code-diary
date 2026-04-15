import { describe, it, expect } from "vitest";
import {
  formatDiaryEntry,
  formatDailyFile,
} from "../markdown.js";
import type {
  DiaryEntry,
  CategorizedCommit,
  TilItem,
} from "../types/diary.js";

const makeCommit = (overrides: Partial<CategorizedCommit> = {}): CategorizedCommit => ({
  sha: "abc1234567890abcdef1234567890abcdef12345",
  subject: "feat: add something",
  body: "",
  author: "Test Author",
  timestamp: new Date("2026-03-30T10:00:00Z"),
  rawTimestamp: "2026-03-30 10:00:00 +0000",
  filesChanged: [],
  insertions: 12,
  deletions: 3,
  category: "feat",
  tilItems: [],
  daySegment: "morning",
  ...overrides,
});

describe("formatDiaryEntry", () => {
  it("produces heading, repo section, and commit lines for one repo with two commits", () => {
    const commits: CategorizedCommit[] = [
      makeCommit({
        sha: "aaa1111222233334444555566667777888899990",
        subject: "feat: add something",
        timestamp: new Date("2026-03-30T10:00:00Z"),
        insertions: 12,
        deletions: 3,
        category: "feat",
      }),
      makeCommit({
        sha: "bbb2222333344445555666677778888999900001",
        subject: "fix: resolve bug",
        timestamp: new Date("2026-03-30T14:00:00Z"),
        insertions: 5,
        deletions: 2,
        category: "fix",
      }),
    ];
    const entry: DiaryEntry = {
      date: "2026-03-30",
      repos: [{ repoPath: "/repos/my-project", repoName: "my-project", commits }],
      tilItems: [],
    };

    const result = formatDiaryEntry(entry);

    expect(result).toContain("## 2026-03-30");
    expect(result).toContain("### my-project");
    expect(result).toContain("- `aaa1111` feat: add something — feat (+12 / -3)");
    expect(result).toContain("- `bbb2222` fix: resolve bug — fix (+5 / -2)");
  });

  it("includes Today I Learned section when TIL items exist", () => {
    const tilItems: TilItem[] = [
      { text: "Git rebase can squash", repoName: "my-project", sha: "abc1234" },
    ];
    const entry: DiaryEntry = {
      date: "2026-03-30",
      repos: [{
        repoPath: "/repos/my-project",
        repoName: "my-project",
        commits: [makeCommit()],
      }],
      tilItems,
    };

    const result = formatDiaryEntry(entry);

    expect(result).toContain("### Today I Learned");
    expect(result).toContain("- Git rebase can squash (`abc1234`, my-project)");
  });

  it("omits Today I Learned section when no TIL items", () => {
    const entry: DiaryEntry = {
      date: "2026-03-30",
      repos: [{
        repoPath: "/repos/my-project",
        repoName: "my-project",
        commits: [makeCommit()],
      }],
      tilItems: [],
    };

    const result = formatDiaryEntry(entry);

    expect(result).not.toContain("Today I Learned");
  });

  it("sorts commits ascending by timestamp within a repo", () => {
    const commits: CategorizedCommit[] = [
      makeCommit({
        sha: "bbb2222333344445555666677778888999900001",
        subject: "fix: later commit",
        timestamp: new Date("2026-03-30T14:00:00Z"),
        category: "fix",
      }),
      makeCommit({
        sha: "aaa1111222233334444555566667777888899990",
        subject: "feat: earlier commit",
        timestamp: new Date("2026-03-30T08:00:00Z"),
        category: "feat",
      }),
    ];
    const entry: DiaryEntry = {
      date: "2026-03-30",
      repos: [{
        repoPath: "/repos/my-project",
        repoName: "my-project",
        commits,
      }],
      tilItems: [],
    };

    const result = formatDiaryEntry(entry);
    const featIdx = result.indexOf("feat: earlier commit");
    const fixIdx = result.indexOf("fix: later commit");

    expect(featIdx).toBeLessThan(fixIdx);
  });

  it("returns empty string when all repos have zero commits", () => {
    const entry: DiaryEntry = {
      date: "2026-03-30",
      repos: [
        { repoPath: "/repos/empty", repoName: "empty", commits: [] },
      ],
      tilItems: [],
    };

    expect(formatDiaryEntry(entry)).toBe("");
  });

  it("formats commit line correctly", () => {
    const entry: DiaryEntry = {
      date: "2026-03-30",
      repos: [{
        repoPath: "/repos/my-project",
        repoName: "my-project",
        commits: [makeCommit({
          sha: "abc1234567890abcdef1234567890abcdef12345",
          subject: "feat: add something",
          category: "feat",
          insertions: 12,
          deletions: 3,
        })],
      }],
      tilItems: [],
    };

    const result = formatDiaryEntry(entry);

    expect(result).toContain("- `abc1234` feat: add something — feat (+12 / -3)");
  });
});

describe("formatDailyFile", () => {
  it("wraps entry markdown with date-based header", () => {
    const entry = "## 2026-03-30\n\n### my-project\n\n- `abc1234` feat: add — feat (+1 / -0)\n\n---\n";
    const result = formatDailyFile("2026-03-30", entry);

    expect(result).toContain("# Code Diary — 2026-03-30");
    expect(result).toContain("## 2026-03-30");
    expect(result).toContain("abc1234");
  });

  it("uses full date in header, not month slug", () => {
    const result = formatDailyFile("2026-04-15", "## 2026-04-15\n\ncontent\n");

    expect(result.startsWith("# Code Diary — 2026-04-15")).toBe(true);
  });
});
