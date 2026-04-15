import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  isValidDate,
  validateRepoPaths,
  buildOutputPath,
  parseSince,
  computeStartDate,
  dateRange,
  resolveAuthorsForRepo,
} from "../cli.js";
import { existsSync } from "fs";
import { join, resolve } from "path";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return { ...actual, existsSync: vi.fn() };
});

const mockedExistsSync = existsSync as ReturnType<typeof vi.fn>;

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
    expect(() =>
      parseArgs(["node", "script", "/repo", "--date", "bad-date"]),
    ).toThrow("process.exit called");
    expect(process.exit).toHaveBeenCalledWith(2);
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("--date must be a valid date"),
    );
  });

  it("exits 2 for invalid calendar date", () => {
    expect(() =>
      parseArgs(["node", "script", "/repo", "--date", "2026-13-01"]),
    ).toThrow("process.exit called");
    expect(process.exit).toHaveBeenCalledWith(2);
  });

  it("exits 2 for Feb 29 in non-leap year", () => {
    expect(() =>
      parseArgs(["node", "script", "/repo", "--date", "2026-02-29"]),
    ).toThrow("process.exit called");
    expect(process.exit).toHaveBeenCalledWith(2);
  });

  it("accepts a valid --since value", () => {
    const result = parseArgs(["node", "script", "/repo", "--since", "2w"]);
    expect(result.since).toBe("2w");
  });

  it("defaults since to undefined", () => {
    const result = parseArgs(["node", "script", "/repo"]);
    expect(result.since).toBeUndefined();
  });

  it("exits 2 for malformed --since", () => {
    expect(() =>
      parseArgs(["node", "script", "/repo", "--since", "2x"]),
    ).toThrow("process.exit called");
    expect(process.exit).toHaveBeenCalledWith(2);
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("--since must be"),
    );
  });
});

describe("parseSince", () => {
  it("parses days", () => {
    expect(parseSince("7d")).toEqual({ n: 7, unit: "d" });
  });

  it("parses weeks", () => {
    expect(parseSince("2w")).toEqual({ n: 2, unit: "w" });
  });

  it("parses months", () => {
    expect(parseSince("1m")).toEqual({ n: 1, unit: "m" });
  });

  it("rejects zero", () => {
    expect(parseSince("0d")).toBeNull();
  });

  it("rejects missing unit", () => {
    expect(parseSince("7")).toBeNull();
  });

  it("rejects unknown unit", () => {
    expect(parseSince("7y")).toBeNull();
  });

  it("rejects negative", () => {
    expect(parseSince("-1d")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseSince("abc")).toBeNull();
  });
});

describe("computeStartDate", () => {
  it("subtracts days", () => {
    expect(computeStartDate("2026-04-15", { n: 7, unit: "d" })).toBe("2026-04-08");
  });

  it("subtracts weeks", () => {
    expect(computeStartDate("2026-04-15", { n: 2, unit: "w" })).toBe("2026-04-01");
  });

  it("subtracts months", () => {
    expect(computeStartDate("2026-04-15", { n: 1, unit: "m" })).toBe("2026-03-15");
  });

  it("crosses year boundary", () => {
    expect(computeStartDate("2026-01-05", { n: 7, unit: "d" })).toBe("2025-12-29");
  });
});

describe("dateRange", () => {
  it("returns a single day when start equals end", () => {
    expect(dateRange("2026-04-15", "2026-04-15")).toEqual(["2026-04-15"]);
  });

  it("returns inclusive range across days", () => {
    expect(dateRange("2026-04-13", "2026-04-15")).toEqual([
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
    ]);
  });

  it("crosses month boundary", () => {
    expect(dateRange("2026-03-30", "2026-04-02")).toEqual([
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
    ]);
  });

  it("returns empty array when start is after end", () => {
    expect(dateRange("2026-04-15", "2026-04-10")).toEqual([]);
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
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('path "/nonexistent" does not exist'),
    );
  });

  it("exits 2 for path without .git", () => {
    mockedExistsSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path === join("/tmp", ".git")) {
        return false;
      }
      return true;
    });

    expect(() => validateRepoPaths(["/tmp"])).toThrow("process.exit called");
    expect(process.exit).toHaveBeenCalledWith(2);
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('is not a git repository'),
    );
  });

  it("passes for valid git repo path", () => {
    mockedExistsSync.mockReturnValue(true);
    expect(() => validateRepoPaths(["/valid/repo"])).not.toThrow();
  });

  it("fails fast on first bad path", () => {
    mockedExistsSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes("bad")) {
        return false;
      }
      return true;
    });

    expect(() => validateRepoPaths(["/bad", "/good"])).toThrow("process.exit called");
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('"/bad"'),
    );
  });
});

describe("resolveAuthorsForRepo", () => {
  it("returns settings authors when provided", () => {
    const warn = vi.fn();
    const getEmail = vi.fn(() => "unused@x.com");

    const result = resolveAuthorsForRepo(
      "/repo",
      ["a@x.com", "b@y.com"],
      warn,
      getEmail,
    );

    expect(result).toEqual(["a@x.com", "b@y.com"]);
    expect(getEmail).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to per-repo user.email when settings has no authors", () => {
    const warn = vi.fn();
    const getEmail = vi.fn(() => "me@minga.io");

    const result = resolveAuthorsForRepo("/repo", undefined, warn, getEmail);

    expect(result).toEqual(["me@minga.io"]);
    expect(getEmail).toHaveBeenCalledWith("/repo");
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats empty settings array as missing and falls back", () => {
    const warn = vi.fn();
    const getEmail = vi.fn(() => "me@minga.io");

    const result = resolveAuthorsForRepo("/repo", [], warn, getEmail);

    expect(result).toEqual(["me@minga.io"]);
  });

  it("warns and returns undefined when no email is configured", () => {
    const warn = vi.fn();
    const getEmail = vi.fn(() => undefined);

    const result = resolveAuthorsForRepo("/repo", undefined, warn, getEmail);

    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("no git user.email configured for /repo"),
    );
  });
});
