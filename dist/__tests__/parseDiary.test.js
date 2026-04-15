import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseDailyFile, extractDateFromFilename } from "../parseDiary.js";
const fixtureContent = readFileSync(join(__dirname, "../../test/fixtures/dailyDiary.md"), "utf8");
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
        expect(result.repos[0].name).toBe("my-project");
        expect(result.repos[0].commitCount).toBe(2);
        expect(result.repos[1].name).toBe("other-repo");
        expect(result.repos[1].commitCount).toBe(1);
    });
    it("extracts category counts per repo", () => {
        const result = parseDailyFile(fixtureContent);
        expect(result.repos[0].categories).toEqual({ feat: 1, fix: 1 });
        expect(result.repos[1].categories).toEqual({ docs: 1 });
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
        expect(result.repos[0].commitCount).toBe(1);
    });
    it("handles empty file gracefully", () => {
        const result = parseDailyFile("");
        expect(result.date).toBe("");
        expect(result.repos).toEqual([]);
        expect(result.tilItems).toEqual([]);
    });
});
describe("extractDateFromFilename", () => {
    it("extracts date from standard filename", () => {
        expect(extractDateFromFilename("code-diary-2026-03-30.md")).toBe("2026-03-30");
    });
    it("extracts date from full path", () => {
        expect(extractDateFromFilename("/diary/daily/code-diary-2026-04-15.md")).toBe("2026-04-15");
    });
    it("returns empty string for non-matching filename", () => {
        expect(extractDateFromFilename("random.md")).toBe("");
    });
});
