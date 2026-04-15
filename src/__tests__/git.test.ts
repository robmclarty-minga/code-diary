import { describe, it, expect } from "vitest";
import { parseGitLog } from "../git.js";

const SEP = "\0\0COMMIT\0\0";
const BEND = "\0\0BODY_END\0\0";

const fixture = [
  `${SEP}`,
  "abc1234567890abcdef1234567890abcdef12345",
  "feat: add user authentication",
  `TIL: JWT tokens need to be rotated periodically`,
  `${BEND}`,
  "Jane Dev",
  "2026-03-30 10:00:00 +0000",
  " src/auth.ts | 10 +++++++---",
  " src/utils.ts | 2 ++",
  " 2 files changed, 9 insertions(+), 3 deletions(-)",
  "",
  `${SEP}`,
  "def4567890abcdef1234567890abcdef12345678",
  "fix(parser): handle edge case in date parsing",
  "",
  "Fixed a bug where dates with single-digit months were not parsed correctly.",
  `${BEND}`,
  "John Coder",
  "2026-03-30 14:30:00 +0530",
  " src/parser.ts | 5 +++--",
  " 1 file changed, 3 insertions(+), 2 deletions(-)",
  "",
  `${SEP}`,
  "789abcdef1234567890abcdef1234567890abcde",
  "update README with new examples",
  `${BEND}`,
  "Jane Dev",
  "2026-03-30 22:00:00 +0000",
  " README.md | 20 +++++++++++++++++---",
  " 1 file changed, 17 insertions(+), 3 deletions(-)",
].join("\n");

describe("parseGitLog", () => {
  it("parses the three-commit fixture correctly", () => {
    const commits = parseGitLog(fixture);
    expect(commits).toHaveLength(3);

    expect(commits[0]!.sha).toBe(
      "abc1234567890abcdef1234567890abcdef12345",
    );
    expect(commits[0]!.subject).toBe("feat: add user authentication");
    expect(commits[0]!.body).toBe(
      "TIL: JWT tokens need to be rotated periodically",
    );
    expect(commits[0]!.author).toBe("Jane Dev");
    expect(commits[0]!.timestamp).toEqual(new Date("2026-03-30 10:00:00 +0000"));

    expect(commits[1]!.sha).toBe(
      "def4567890abcdef1234567890abcdef12345678",
    );
    expect(commits[1]!.subject).toBe(
      "fix(parser): handle edge case in date parsing",
    );
    expect(commits[1]!.author).toBe("John Coder");

    expect(commits[2]!.sha).toBe(
      "789abcdef1234567890abcdef1234567890abcde",
    );
    expect(commits[2]!.subject).toBe("update README with new examples");
    expect(commits[2]!.author).toBe("Jane Dev");
  });

  it("returns empty array for empty string", () => {
    expect(parseGitLog("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseGitLog("   \n  ")).toEqual([]);
  });

  it("throws on malformed block missing BODY_END marker", () => {
    const bad = `${SEP}\nabc1234567890abcdef1234567890abcdef12345\nfeat: something`;
    expect(() => parseGitLog(bad)).toThrow("BODY_END");
  });

  it("throws on malformed block with invalid SHA", () => {
    const bad = `${SEP}\nnot-a-sha\nfeat: something\n${BEND}\nAuthor\n2026-03-30 10:00:00 +0000`;
    expect(() => parseGitLog(bad)).toThrow("invalid SHA");
  });

  it("preserves non-UTC offset timestamp correctly", () => {
    const commits = parseGitLog(fixture);
    const commit = commits[1]!;
    expect(commit.rawTimestamp).toBe("2026-03-30 14:30:00 +0530");
    // +0530 means UTC time is 14:30 - 5:30 = 09:00 UTC
    expect(commit.timestamp.getUTCHours()).toBe(9);
    expect(commit.timestamp.getUTCMinutes()).toBe(0);
  });

  it("parses multi-line body correctly", () => {
    const commits = parseGitLog(fixture);
    const commit = commits[1]!;
    expect(commit.body).toBe(
      "Fixed a bug where dates with single-digit months were not parsed correctly.",
    );
  });

  it("parses empty body correctly", () => {
    const commits = parseGitLog(fixture);
    const commit = commits[2]!;
    expect(commit.body).toBe("");
  });

  it("parses body in subject-only commit (body is TIL line)", () => {
    const commits = parseGitLog(fixture);
    const commit = commits[0]!;
    expect(commit.body).toBe(
      "TIL: JWT tokens need to be rotated periodically",
    );
  });

  it("parses filesChanged correctly", () => {
    const commits = parseGitLog(fixture);

    expect(commits[0]!.filesChanged).toHaveLength(2);
    expect(commits[0]!.filesChanged[0]!.path).toBe("src/auth.ts");
    expect(commits[0]!.filesChanged[0]!.insertions).toBe(7);
    expect(commits[0]!.filesChanged[0]!.deletions).toBe(3);
    expect(commits[0]!.filesChanged[1]!.path).toBe("src/utils.ts");
    expect(commits[0]!.filesChanged[1]!.insertions).toBe(2);
    expect(commits[0]!.filesChanged[1]!.deletions).toBe(0);

    expect(commits[1]!.filesChanged).toHaveLength(1);
    expect(commits[1]!.filesChanged[0]!.path).toBe("src/parser.ts");
  });

  it("parses total insertions and deletions from summary line", () => {
    const commits = parseGitLog(fixture);
    expect(commits[0]!.insertions).toBe(9);
    expect(commits[0]!.deletions).toBe(3);
    expect(commits[1]!.insertions).toBe(3);
    expect(commits[1]!.deletions).toBe(2);
    expect(commits[2]!.insertions).toBe(17);
    expect(commits[2]!.deletions).toBe(3);
  });

  it("handles commit bodies containing old sentinel text without breaking", () => {
    const tricky = [
      `${SEP}`,
      "aaa1111222233334444555566667777888899990",
      "fix(git): swap ---COMMIT--- separator to lead each block",
      "Moves ---COMMIT--- from the end and adds ---BODY_END--- markers.",
      `${BEND}`,
      "Dev Person",
      "2026-03-30 10:00:00 +0000",
      " src/git.ts | 2 +-",
      " 1 file changed, 1 insertion(+), 1 deletion(-)",
    ].join("\n");

    const commits = parseGitLog(tricky);
    expect(commits).toHaveLength(1);
    expect(commits[0]!.body).toContain("---COMMIT---");
    expect(commits[0]!.body).toContain("---BODY_END---");
  });
});
