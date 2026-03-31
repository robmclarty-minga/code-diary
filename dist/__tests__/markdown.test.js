import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { formatDiaryEntry, findExistingEntry, replaceEntry, appendEntry, } from "../markdown.js";
const fixtureContent = readFileSync(join(__dirname, "../../test/fixtures/diaryMonth.md"), "utf8");
const makeCommit = (overrides = {}) => ({
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
        const commits = [
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
        const entry = {
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
        const tilItems = [
            { text: "Git rebase can squash", repoName: "my-project", sha: "abc1234" },
        ];
        const entry = {
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
        const entry = {
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
        const commits = [
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
        const entry = {
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
        const entry = {
            date: "2026-03-30",
            repos: [
                { repoPath: "/repos/empty", repoName: "empty", commits: [] },
            ],
            tilItems: [],
        };
        expect(formatDiaryEntry(entry)).toBe("");
    });
    it("formats commit line correctly", () => {
        const entry = {
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
describe("findExistingEntry", () => {
    it("returns true when date heading is present in fixture", () => {
        expect(findExistingEntry(fixtureContent, "2026-03-28")).toBe(true);
    });
    it("returns false when date heading is absent", () => {
        expect(findExistingEntry(fixtureContent, "2026-03-01")).toBe(false);
    });
});
describe("replaceEntry", () => {
    it("replaces an existing entry and preserves other entries", () => {
        const newEntry = "## 2026-03-28\n\n### replaced-repo\n\n- `fff6666` chore: replaced — chore (+1 / -1)\n\n---\n";
        const result = replaceEntry(fixtureContent, "2026-03-28", newEntry);
        expect(result).toContain("### replaced-repo");
        expect(result).toContain("chore: replaced");
        expect(result).not.toContain("aaa1111");
        expect(result).not.toContain("bbb2222");
        // Second entry preserved
        expect(result).toContain("## 2026-03-29");
        expect(result).toContain("ccc3333");
    });
});
describe("appendEntry", () => {
    it("creates file header for new files when content is null", () => {
        const newEntry = "## 2026-03-30\n\n### my-project\n\n- `abc1234` feat: add — feat (+1 / -0)\n\n---\n";
        const result = appendEntry(null, "2026-03-30", newEntry);
        expect(result).toContain("# Code Diary — 2026-03");
        expect(result).toContain("## 2026-03-30");
        expect(result).toContain("abc1234");
    });
    it("appends entry to existing content", () => {
        const newEntry = "## 2026-03-30\n\n### my-project\n\n- `abc1234` feat: new — feat (+1 / -0)\n\n---\n";
        const result = appendEntry(fixtureContent, "2026-03-30", newEntry);
        expect(result).toContain("# Code Diary — 2026-03");
        expect(result).toContain("## 2026-03-28");
        expect(result).toContain("## 2026-03-30");
    });
});
