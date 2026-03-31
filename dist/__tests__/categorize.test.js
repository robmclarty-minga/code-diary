import { describe, it, expect } from "vitest";
import { categorizeCommit, extractTilItems, assignDaySegment, buildDiaryEntry, buildRepoEntry, } from "../categorize.js";
const makeCommit = (overrides = {}) => ({
    sha: "abc1234567890abcdef1234567890abcdef12345",
    subject: "feat: add something",
    body: "",
    author: "Test Author",
    timestamp: new Date("2026-03-30T10:00:00Z"),
    rawTimestamp: "2026-03-30 10:00:00 +0000",
    filesChanged: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
});
describe("categorizeCommit", () => {
    it("assigns feat for 'feat: add X'", () => {
        const commit = makeCommit({ subject: "feat: add X" });
        expect(categorizeCommit(commit).category).toBe("feat");
    });
    it("assigns feat for 'feat(scope): add X'", () => {
        const commit = makeCommit({ subject: "feat(scope): add X" });
        expect(categorizeCommit(commit).category).toBe("feat");
    });
    it("assigns other for unrecognized prefix", () => {
        const commit = makeCommit({ subject: "no prefix here" });
        expect(categorizeCommit(commit).category).toBe("other");
    });
    it("is case-insensitive: Fix: → fix", () => {
        const commit = makeCommit({ subject: "Fix: something" });
        expect(categorizeCommit(commit).category).toBe("fix");
    });
    it("assigns refactor for 'refactor: rename'", () => {
        const commit = makeCommit({ subject: "refactor: rename things" });
        expect(categorizeCommit(commit).category).toBe("refactor");
    });
    it("assigns docs for 'docs: update readme'", () => {
        const commit = makeCommit({ subject: "docs: update readme" });
        expect(categorizeCommit(commit).category).toBe("docs");
    });
    it("assigns chore for 'CHORE: bump deps'", () => {
        const commit = makeCommit({ subject: "CHORE: bump deps" });
        expect(categorizeCommit(commit).category).toBe("chore");
    });
    it("strips leading whitespace before matching", () => {
        const commit = makeCommit({ subject: "  feat: add X" });
        expect(categorizeCommit(commit).category).toBe("feat");
    });
});
describe("extractTilItems", () => {
    it("extracts TIL from subject", () => {
        expect(extractTilItems("TIL: learned X", "")).toEqual(["learned X"]);
    });
    it("extracts TIL from body", () => {
        expect(extractTilItems("feat: add X", "TIL: learned Y")).toEqual([
            "learned Y",
        ]);
    });
    it("extracts TIL from both subject and body", () => {
        expect(extractTilItems("TIL: X", "Some text\nTIL: Y")).toEqual([
            "X",
            "Y",
        ]);
    });
    it("returns empty array when no TIL present", () => {
        expect(extractTilItems("feat: add X", "some body text")).toEqual([]);
    });
    it("trims whitespace from extracted text", () => {
        expect(extractTilItems("TIL:   spaced out  ", "")).toEqual([
            "spaced out",
        ]);
    });
});
describe("assignDaySegment", () => {
    it.each([
        { hour: 5, expected: "morning" },
        { hour: 11, expected: "morning" },
        { hour: 12, expected: "afternoon" },
        { hour: 16, expected: "afternoon" },
        { hour: 17, expected: "evening" },
        { hour: 23, expected: "evening" },
        { hour: 0, expected: "night" },
        { hour: 4, expected: "night" },
    ])("hour $hour → $expected", ({ hour, expected }) => {
        const date = new Date(`2026-03-30T${String(hour).padStart(2, "0")}:00:00Z`);
        expect(assignDaySegment(date, "+0000")).toBe(expected);
    });
    it("uses local hour with non-UTC offset", () => {
        // UTC 04:00 with +0530 offset → local 09:30 → morning
        const date = new Date("2026-03-30T04:00:00Z");
        expect(assignDaySegment(date, "+0530")).toBe("morning");
    });
    it("handles negative offset correctly", () => {
        // UTC 10:00 with -0800 offset → local 02:00 → night
        const date = new Date("2026-03-30T10:00:00Z");
        expect(assignDaySegment(date, "-0800")).toBe("night");
    });
});
describe("buildRepoEntry", () => {
    it("categorizes and sorts commits by timestamp", () => {
        const late = makeCommit({
            subject: "fix: late commit",
            timestamp: new Date("2026-03-30T20:00:00Z"),
            rawTimestamp: "2026-03-30 20:00:00 +0000",
        });
        const early = makeCommit({
            subject: "feat: early commit",
            timestamp: new Date("2026-03-30T08:00:00Z"),
            rawTimestamp: "2026-03-30 08:00:00 +0000",
        });
        const entry = buildRepoEntry("/path/to/my-repo", [late, early]);
        expect(entry.repoName).toBe("my-repo");
        expect(entry.commits[0].subject).toBe("feat: early commit");
        expect(entry.commits[1].subject).toBe("fix: late commit");
    });
});
describe("buildDiaryEntry", () => {
    it("deduplicates TIL items by exact text match", () => {
        const commit1 = makeCommit({
            sha: "aaa1234567890abcdef1234567890abcdef12345",
            subject: "feat: add X",
            body: "TIL: same thing",
            rawTimestamp: "2026-03-30 10:00:00 +0000",
            timestamp: new Date("2026-03-30T10:00:00Z"),
        });
        const commit2 = makeCommit({
            sha: "bbb1234567890abcdef1234567890abcdef12345",
            subject: "fix: fix Y",
            body: "TIL: same thing",
            rawTimestamp: "2026-03-30 11:00:00 +0000",
            timestamp: new Date("2026-03-30T11:00:00Z"),
        });
        const repo1 = buildRepoEntry("/path/to/repo1", [commit1]);
        const repo2 = buildRepoEntry("/path/to/repo2", [commit2]);
        const entry = buildDiaryEntry("2026-03-30", [repo1, repo2]);
        expect(entry.tilItems).toHaveLength(1);
        expect(entry.tilItems[0].text).toBe("same thing");
        expect(entry.tilItems[0].repoName).toBe("repo1");
        expect(entry.tilItems[0].sha).toBe("aaa1234");
    });
    it("collects TIL items from multiple repos preserving order", () => {
        const commit1 = makeCommit({
            sha: "aaa1234567890abcdef1234567890abcdef12345",
            subject: "TIL: first thing",
            rawTimestamp: "2026-03-30 10:00:00 +0000",
            timestamp: new Date("2026-03-30T10:00:00Z"),
        });
        const commit2 = makeCommit({
            sha: "bbb1234567890abcdef1234567890abcdef12345",
            subject: "TIL: second thing",
            rawTimestamp: "2026-03-30 11:00:00 +0000",
            timestamp: new Date("2026-03-30T11:00:00Z"),
        });
        const repo1 = buildRepoEntry("/path/to/repo1", [commit1]);
        const repo2 = buildRepoEntry("/path/to/repo2", [commit2]);
        const entry = buildDiaryEntry("2026-03-30", [repo1, repo2]);
        expect(entry.tilItems).toHaveLength(2);
        expect(entry.tilItems[0].text).toBe("first thing");
        expect(entry.tilItems[1].text).toBe("second thing");
    });
    it("returns empty tilItems when no TIL present", () => {
        const commit = makeCommit({ subject: "feat: no til" });
        const repo = buildRepoEntry("/path/to/repo", [commit]);
        const entry = buildDiaryEntry("2026-03-30", [repo]);
        expect(entry.tilItems).toEqual([]);
    });
});
