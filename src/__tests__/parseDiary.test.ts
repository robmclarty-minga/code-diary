import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseDailyFile, extractDateFromFilename } from "../parseDiary.js";

const fixtureContent = readFileSync(
  join(__dirname, "../../test/fixtures/dailyDiary.md"),
  "utf8",
);

describe("parseDailyFile", () => {
  it("extracts date from ## heading", () => {
    const result = parseDailyFile(fixtureContent);
    expect(result.date).toBe("2026-03-30");
  });

  it("extracts TIL items", () => {
    const result = parseDailyFile(fixtureContent);
    expect(result.tilItems).toEqual([
      "JWT tokens need to be rotated periodically",
    ]);
  });

  it("extracts repo sections with commit counts", () => {
    const result = parseDailyFile(fixtureContent);
    expect(result.repos).toHaveLength(2);
    expect(result.repos[0]!.name).toBe("my-project");
    expect(result.repos[0]!.commitCount).toBe(2);
    expect(result.repos[1]!.name).toBe("other-repo");
    expect(result.repos[1]!.commitCount).toBe(1);
  });

  it("extracts category counts per repo", () => {
    const result = parseDailyFile(fixtureContent);
    expect(result.repos[0]!.categories).toEqual({ feat: 1, fix: 1 });
    expect(result.repos[1]!.categories).toEqual({ docs: 1 });
  });

  it("captures raw markdown from ## heading onward", () => {
    const result = parseDailyFile(fixtureContent);
    expect(result.rawMarkdown).toContain("## 2026-03-30");
    expect(result.rawMarkdown).toContain("### my-project");
    expect(result.rawMarkdown).not.toContain("# Code Diary");
  });

  it("handles file with no TIL section", () => {
    const content = `# Code Diary — 2026-04-01

## 2026-04-01

### my-repo

- \`aaa1111\` feat: add feature — feat (+10 / -0)

---
`;
    const result = parseDailyFile(content);
    expect(result.date).toBe("2026-04-01");
    expect(result.tilItems).toEqual([]);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0]!.commitCount).toBe(1);
  });

  it("handles empty file gracefully", () => {
    const result = parseDailyFile("");
    expect(result.date).toBe("");
    expect(result.repos).toEqual([]);
    expect(result.tilItems).toEqual([]);
    expect(result.authors).toEqual([]);
  });

  it("extracts authors from Commits by Author section", () => {
    const content = `# Code Diary — 2026-04-15

## 2026-04-15

### Commits by Author

- Jane Dev — 2 commits (+16 / -5)
- John Coder — 1 commit (+4 / -1)

### api

- \`abc1234\` feat: add thing — feat (+16 / -5)

---
`;
    const result = parseDailyFile(content);

    expect(result.authors).toEqual([
      { name: "Jane Dev", commits: 2, insertions: 16, deletions: 5 },
      { name: "John Coder", commits: 1, insertions: 4, deletions: 1 },
    ]);
  });

  it("returns empty authors array when section is missing", () => {
    const content = `# Code Diary — 2026-04-15

## 2026-04-15

### api

- \`abc1234\` feat: add thing — feat (+1 / -0)

---
`;
    const result = parseDailyFile(content);
    expect(result.authors).toEqual([]);
  });
});

describe("extractDateFromFilename", () => {
  it("extracts date from standard filename", () => {
    expect(extractDateFromFilename("code-diary-2026-03-30.md")).toBe("2026-03-30");
  });

  it("extracts date from full path", () => {
    expect(extractDateFromFilename("/daily/code-diary-2026-04-15.md")).toBe("2026-04-15");
  });

  it("returns empty string for non-matching filename", () => {
    expect(extractDateFromFilename("random.md")).toBe("");
  });
});
