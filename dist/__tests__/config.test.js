import { describe, it, expect, vi, afterEach } from "vitest";
import { loadSettings, resolveArgs } from "../config.js";
vi.mock("../fileIO.js", () => ({
    fileExists: vi.fn(),
    readFile: vi.fn(),
}));
const { fileExists, readFile } = await import("../fileIO.js");
const mockedFileExists = fileExists;
const mockedReadFile = readFile;
afterEach(() => {
    vi.restoreAllMocks();
});
describe("loadSettings", () => {
    it("returns empty object when config file does not exist", () => {
        mockedFileExists.mockReturnValue(false);
        expect(loadSettings()).toEqual({});
    });
    it("parses valid JSON config", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue(JSON.stringify({
            "output-dir": "/tmp/diary",
            repos: ["/repo1", "/repo2"],
        }));
        const settings = loadSettings();
        expect(settings["output-dir"]).toBe("/tmp/diary");
        expect(settings.repos).toEqual(["/repo1", "/repo2"]);
    });
    it("throws on malformed JSON", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue("not json{");
        expect(() => loadSettings()).toThrow("Invalid JSON");
    });
    it("throws when config is not an object", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue('"just a string"');
        expect(() => loadSettings()).toThrow("must be a JSON object");
    });
    it("throws when output-dir is not a string", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue(JSON.stringify({ "output-dir": 42 }));
        expect(() => loadSettings()).toThrow('"output-dir" must be a string');
    });
    it("throws when repos is not an array", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue(JSON.stringify({ repos: "not-array" }));
        expect(() => loadSettings()).toThrow('"repos" must be an array');
    });
    it("throws when repos contains non-strings", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue(JSON.stringify({ repos: ["/repo", 42] }));
        expect(() => loadSettings()).toThrow('"repos" must be an array of strings');
    });
    it("returns empty settings for empty object", () => {
        mockedFileExists.mockReturnValue(true);
        mockedReadFile.mockReturnValue("{}");
        expect(loadSettings()).toEqual({});
    });
});
describe("resolveArgs", () => {
    it("uses CLI repos when provided", () => {
        const cli = { repoPaths: ["/cli-repo"], date: "2026-03-30", outputDir: undefined, since: undefined };
        const settings = { repos: ["/config-repo"] };
        const resolved = resolveArgs(cli, settings);
        expect(resolved.repoPaths).toEqual(["/cli-repo"]);
    });
    it("falls back to config repos when CLI repos empty", () => {
        const cli = { repoPaths: [], date: "2026-03-30", outputDir: undefined, since: undefined };
        const settings = { repos: ["/config-repo1", "/config-repo2"] };
        const resolved = resolveArgs(cli, settings);
        expect(resolved.repoPaths).toEqual(["/config-repo1", "/config-repo2"]);
    });
    it("returns empty repos when neither CLI nor config provides them", () => {
        const cli = { repoPaths: [], date: "2026-03-30", outputDir: undefined, since: undefined };
        const resolved = resolveArgs(cli, {});
        expect(resolved.repoPaths).toEqual([]);
    });
    it("uses CLI outputDir when provided", () => {
        const cli = { repoPaths: ["/repo"], date: "2026-03-30", outputDir: "/cli-out", since: undefined };
        const settings = { "output-dir": "/config-out" };
        const resolved = resolveArgs(cli, settings);
        expect(resolved.outputDir).toBe("/cli-out");
    });
    it("falls back to config output-dir when CLI outputDir is undefined", () => {
        const cli = { repoPaths: ["/repo"], date: "2026-03-30", outputDir: undefined, since: undefined };
        const settings = { "output-dir": "/config-out" };
        const resolved = resolveArgs(cli, settings);
        expect(resolved.outputDir).toBe("/config-out");
    });
    it("falls back to cwd when both CLI and config outputDir are missing", () => {
        const cli = { repoPaths: ["/repo"], date: "2026-03-30", outputDir: undefined, since: undefined };
        const resolved = resolveArgs(cli, {});
        expect(resolved.outputDir).toBe(process.cwd());
    });
    it("preserves date from CLI args", () => {
        const cli = { repoPaths: ["/repo"], date: "2026-04-15", outputDir: undefined, since: undefined };
        const resolved = resolveArgs(cli, {});
        expect(resolved.date).toBe("2026-04-15");
    });
});
