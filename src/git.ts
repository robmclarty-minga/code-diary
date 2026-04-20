import { spawnSync } from "child_process";
import type { Commit, FileStat } from "./types/diary.js";

const COMMIT_SEPARATOR = "\0\0COMMIT\0\0";
const BODY_END_MARKER = "\0\0BODY_END\0\0";
const GIT_FORMAT_SEPARATOR = "%x00%x00COMMIT%x00%x00";
const GIT_FORMAT_BODY_END = "%x00%x00BODY_END%x00%x00";
const GIT_FORMAT = `%H%n%s%n%b${GIT_FORMAT_BODY_END}%n%an%n%ae%n%ai`;

export const readGitLog = (
  repoPath: string,
  date: string,
  authors?: string[],
): string => {
  const authorArgs = (authors ?? []).map((a) => `--author=${a}`);
  const result = spawnSync(
    "git",
    [
      "log",
      "--no-merges",
      `--after=${date} 00:00:00`,
      `--before=${date} 23:59:59`,
      ...authorArgs,
      "--stat",
      `--pretty=format:${GIT_FORMAT_SEPARATOR}%n${GIT_FORMAT}`,
    ],
    { cwd: repoPath, encoding: "utf8" },
  );

  if (result.error) {
    throw new Error("git is not available on PATH");
  }

  if (result.status !== 0) {
    throw new Error(
      `git log failed for ${repoPath}: ${result.stderr}`,
    );
  }

  return result.stdout;
};

export const getAuthorEmail = (repoPath: string): string | undefined => {
  const result = spawnSync("git", ["config", "user.email"], {
    cwd: repoPath,
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return undefined;
  }

  const email = result.stdout.trim();
  return email.length > 0 ? email : undefined;
};

const parseFileStat = (line: string): FileStat | undefined => {
  const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*(\+*)(-*)\s*$/);
  if (!match) {
    return undefined;
  }
  const path = match[1]!.trim();
  const ins = match[3]!.length;
  const del = match[4]!.length;
  return { path, insertions: ins, deletions: del };
};

const parseSummaryLine = (
  line: string,
): { insertions: number; deletions: number } | undefined => {
  const match = line.match(
    /(\d+)\s+files?\s+changed(?:,\s*(\d+)\s+insertions?\(\+\))?(?:,\s*(\d+)\s+deletions?\(-\))?/,
  );
  if (!match) {
    return undefined;
  }
  return {
    insertions: match[2] ? parseInt(match[2], 10) : 0,
    deletions: match[3] ? parseInt(match[3], 10) : 0,
  };
};

export const parseGitLog = (raw: string): Commit[] => {
  if (raw.trim() === "") {
    return [];
  }

  const blocks = raw
    .split(COMMIT_SEPARATOR)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const bodyEndIdx = block.indexOf(BODY_END_MARKER);
    if (bodyEndIdx === -1) {
      throw new Error(`Malformed commit block: missing ${BODY_END_MARKER} marker`);
    }

    const beforeBody = block.slice(0, bodyEndIdx);
    const afterBody = block.slice(bodyEndIdx + BODY_END_MARKER.length);

    const firstNewline = beforeBody.indexOf("\n");
    if (firstNewline === -1) {
      throw new Error(`Malformed commit block: missing subject line`);
    }

    const sha = beforeBody.slice(0, firstNewline).trim();
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new Error(`Malformed commit block: invalid SHA "${sha}"`);
    }

    const afterSha = beforeBody.slice(firstNewline + 1);
    const secondNewline = afterSha.indexOf("\n");

    let subject: string;
    let body: string;

    if (secondNewline === -1) {
      subject = afterSha.trim();
      body = "";
    } else {
      subject = afterSha.slice(0, secondNewline).trim();
      body = afterSha.slice(secondNewline + 1).trim();
    }

    if (!subject) {
      throw new Error(`Malformed commit block: missing subject for SHA ${sha}`);
    }

    const afterBodyLines = afterBody
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);

    if (afterBodyLines.length < 3) {
      throw new Error(
        `Malformed commit block: missing author, email, or timestamp for SHA ${sha}`,
      );
    }

    const author = {
      name: afterBodyLines[0]!.trim(),
      email: afterBodyLines[1]!.trim(),
    };
    const rawTimestamp = afterBodyLines[2]!.trim();
    const timestamp = new Date(rawTimestamp);

    if (isNaN(timestamp.getTime())) {
      throw new Error(
        `Malformed commit block: invalid timestamp "${rawTimestamp}" for SHA ${sha}`,
      );
    }

    const statLines = afterBodyLines.slice(3);
    const filesChanged: FileStat[] = [];
    let insertions = 0;
    let deletions = 0;

    for (const line of statLines) {
      const fileStat = parseFileStat(line);
      if (fileStat) {
        filesChanged.push(fileStat);
        continue;
      }
      const summary = parseSummaryLine(line);
      if (summary) {
        insertions = summary.insertions;
        deletions = summary.deletions;
      }
    }

    return {
      sha,
      subject,
      body,
      author,
      timestamp,
      rawTimestamp,
      filesChanged,
      insertions,
      deletions,
    };
  });
};
