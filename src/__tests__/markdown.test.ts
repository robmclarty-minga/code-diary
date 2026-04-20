import { describe, it, expect } from "vitest";
import {
  formatDiaryEntry,
  formatDailyFile,
  extractRepoSections,
  extractExistingTilItems,
  mergeDailyContent,
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
  author: { name: "Test Author", email: "test@example.com" },
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

const EXISTING_DAILY = [
  "# Code Diary — 2026-04-15",
  "",
  "## 2026-04-15",
  "",
  "### Today I Learned",
  "- Arrays are zero-indexed (`abc1234`, api)",
  "- Maps are cool (`def5678`, web)",
  "",
  "### api",
  "",
  "- `abc1234` feat: add thing — feat (+5 / -1)",
  "",
  "### web",
  "",
  "- `def5678` docs: update readme — docs (+10 / -2)",
  "",
  "---",
  "",
].join("\n");

describe("extractRepoSections", () => {
  it("extracts each repo section by name", () => {
    const sections = extractRepoSections(EXISTING_DAILY);

    expect(sections.size).toBe(2);
    expect(sections.has("api")).toBe(true);
    expect(sections.has("web")).toBe(true);
    expect(sections.get("api")).toContain("### api");
    expect(sections.get("api")).toContain("`abc1234`");
    expect(sections.get("web")).toContain("### web");
    expect(sections.get("web")).toContain("`def5678`");
  });

  it("excludes Today I Learned heading", () => {
    const sections = extractRepoSections(EXISTING_DAILY);
    expect(sections.has("Today I Learned")).toBe(false);
  });

  it("returns empty map for content with no repo sections", () => {
    const sections = extractRepoSections("# Code Diary — 2026-04-15\n\n## 2026-04-15\n\n---\n");
    expect(sections.size).toBe(0);
  });
});

describe("extractExistingTilItems", () => {
  it("extracts TIL items with text, sha, and repoName", () => {
    const items = extractExistingTilItems(EXISTING_DAILY);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ text: "Arrays are zero-indexed", sha: "abc1234", repoName: "api" });
    expect(items[1]).toEqual({ text: "Maps are cool", sha: "def5678", repoName: "web" });
  });

  it("returns empty array when no TIL section", () => {
    const content = "# Code Diary — 2026-04-15\n\n## 2026-04-15\n\n### api\n\n- `abc1234` feat: add — feat (+1 / -0)\n\n---\n";
    expect(extractExistingTilItems(content)).toEqual([]);
  });
});

describe("mergeDailyContent", () => {
  it("preserves repo sections not covered by the new run", () => {
    const newEntry: DiaryEntry = {
      date: "2026-04-15",
      repos: [{
        repoPath: "/repos/api",
        repoName: "api",
        commits: [makeCommit({
          sha: "aaa1111222233334444555566667777888899990",
          subject: "feat: updated thing",
          insertions: 8,
          deletions: 2,
          category: "feat",
        })],
      }],
      tilItems: [],
    };

    const result = mergeDailyContent(EXISTING_DAILY, newEntry);

    expect(result).toContain("### api");
    expect(result).toContain("feat: updated thing");
    expect(result).toContain("### web");
    expect(result).toContain("`def5678`");
  });

  it("merges TIL items from preserved repos", () => {
    const newEntry: DiaryEntry = {
      date: "2026-04-15",
      repos: [{
        repoPath: "/repos/api",
        repoName: "api",
        commits: [makeCommit({ tilItems: ["New TIL from api"] })],
      }],
      tilItems: [{ text: "New TIL from api", sha: "abc1234", repoName: "api" }],
    };

    const result = mergeDailyContent(EXISTING_DAILY, newEntry);

    expect(result).toContain("### Today I Learned");
    expect(result).toContain("New TIL from api");
    expect(result).toContain("Maps are cool");
    expect(result).not.toContain("Arrays are zero-indexed");
  });

  it("deduplicates TIL items by text", () => {
    const newEntry: DiaryEntry = {
      date: "2026-04-15",
      repos: [{
        repoPath: "/repos/api",
        repoName: "api",
        commits: [makeCommit()],
      }, {
        repoPath: "/repos/web",
        repoName: "web",
        commits: [makeCommit()],
      }],
      tilItems: [{ text: "Maps are cool", sha: "new1234", repoName: "web" }],
    };

    const result = mergeDailyContent(EXISTING_DAILY, newEntry);
    const tilMatches = result.match(/Maps are cool/g);
    expect(tilMatches).toHaveLength(1);
  });

  it("produces valid daily file when no repos to preserve", () => {
    const newEntry: DiaryEntry = {
      date: "2026-04-15",
      repos: [{
        repoPath: "/repos/api",
        repoName: "api",
        commits: [makeCommit()],
      }, {
        repoPath: "/repos/web",
        repoName: "web",
        commits: [makeCommit({
          sha: "bbb2222333344445555666677778888999900001",
          subject: "docs: update",
          category: "docs",
        })],
      }],
      tilItems: [],
    };

    const result = mergeDailyContent(EXISTING_DAILY, newEntry);

    expect(result).toContain("# Code Diary — 2026-04-15");
    expect(result).toContain("### api");
    expect(result).toContain("### web");
    expect(result).toContain("---");
  });
});
