import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs, isValidDate, validateRepoPaths, buildOutputPath } from "../cli.js";
import { existsSync } from "fs";
import { join, resolve } from "path";
vi.mock("fs", async () => {
    const actual = await vi.importActual("fs");
    return { ...actual, existsSync: vi.fn() };
});
const mockedExistsSync = existsSync;
describe("isValidDate", () => {
    it("accepts a valid date", () => {
        expect(isValidDate("2026-03-30")).toBe(true);
    });
    it("rejects non-leap year Feb 29", () => {
        expect(isValidDate("2026-02-29")).toBe(false);
    });
    it("accepts leap year Feb 29", () => {
        expect(isValidDate("2024-02-29")).toBe(true);
    });
    it("rejects non-date string", () => {
        expect(isValidDate("not-a-date")).toBe(false);
    });
    it("rejects invalid month", () => {
        expect(isValidDate("2026-13-01")).toBe(false);
    });
    it("rejects month 0", () => {
        expect(isValidDate("2026-00-15")).toBe(false);
    });
    it("rejects day 0", () => {
        expect(isValidDate("2026-03-00")).toBe(false);
    });
    it("rejects day 32", () => {
        expect(isValidDate("2026-03-32")).toBe(false);
    });
});
describe("parseArgs", () => {
    beforeEach(() => {
        vi.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("process.exit called");
        });
        vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("parses a single repo path with defaults", () => {
        const result = parseArgs(["node", "script", "/path/to/repo"]);
        expect(result.repoPaths).toEqual(["/path/to/repo"]);
        expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.outputDir).toBeUndefined();
    });
    it("parses multiple repos with all flags", () => {
        const result = parseArgs([
            "node",
            "script",
            "/repo1",
            "/repo2",
            "--date",
            "2026-03-30",
            "--output",
            "/tmp/out",
        ]);
        expect(result.repoPaths).toEqual(["/repo1", "/repo2"]);
        expect(result.date).toBe("2026-03-30");
        expect(result.outputDir).toBe("/tmp/out");
    });
    it("accepts flags before positional args", () => {
        const result = parseArgs([
            "node",
            "script",
            "--date",
            "2026-03-30",
            "--output",
            "/tmp/out",
            "/repo1",
        ]);
        expect(result.repoPaths).toEqual(["/repo1"]);
        expect(result.date).toBe("2026-03-30");
        expect(result.outputDir).toBe("/tmp/out");
    });
    it("prints help and exits 0 for --help", () => {
        vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        expect(() => parseArgs(["node", "script", "--help"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(0);
        expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("--date"));
    });
    it("prints help and exits 0 for -h", () => {
        vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        expect(() => parseArgs(["node", "script", "-h"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(0);
        expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    });
    it("allows empty repos (config may supply them)", () => {
        const result = parseArgs(["node", "script", "--date", "2026-03-30"]);
        expect(result.repoPaths).toEqual([]);
        expect(result.date).toBe("2026-03-30");
    });
    it("exits 2 for invalid date format", () => {
        expect(() => parseArgs(["node", "script", "/repo", "--date", "bad-date"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(2);
        expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining("--date must be a valid date"));
    });
    it("exits 2 for invalid calendar date", () => {
        expect(() => parseArgs(["node", "script", "/repo", "--date", "2026-13-01"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(2);
    });
    it("exits 2 for Feb 29 in non-leap year", () => {
        expect(() => parseArgs(["node", "script", "/repo", "--date", "2026-02-29"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(2);
    });
});
describe("buildOutputPath", () => {
    it("produces daily file path with code-diary prefix", () => {
        const result = buildOutputPath("/out", "2026-03-30");
        expect(result).toBe(join(resolve("/out"), "diary", "daily", "code-diary-2026-03-30.md"));
    });
});
describe("validateRepoPaths", () => {
    beforeEach(() => {
        vi.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("process.exit called");
        });
        vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        mockedExistsSync.mockReset();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("exits 2 for non-existent path", () => {
        mockedExistsSync.mockReturnValue(false);
        expect(() => validateRepoPaths(["/nonexistent"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(2);
        expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('path "/nonexistent" does not exist'));
    });
    it("exits 2 for path without .git", () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path === join("/tmp", ".git")) {
                return false;
            }
            return true;
        });
        expect(() => validateRepoPaths(["/tmp"])).toThrow("process.exit called");
        expect(process.exit).toHaveBeenCalledWith(2);
        expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('is not a git repository'));
    });
    it("passes for valid git repo path", () => {
        mockedExistsSync.mockReturnValue(true);
        expect(() => validateRepoPaths(["/valid/repo"])).not.toThrow();
    });
    it("fails fast on first bad path", () => {
        mockedExistsSync.mockImplementation((p) => {
            const path = String(p);
            if (path.includes("bad")) {
                return false;
            }
            return true;
        });
        expect(() => validateRepoPaths(["/bad", "/good"])).toThrow("process.exit called");
        expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('"/bad"'));
    });
});
