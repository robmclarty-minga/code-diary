import type { DiaryEntry, TilItem } from "./types/diary.js";
import { shortSha, sortByTimestampAsc } from "./util.js";

export const formatDiaryEntry = (entry: DiaryEntry): string => {
  const hasCommits = entry.repos.some((r) => r.commits.length > 0);
  if (!hasCommits) {
    return "";
  }

  const lines: string[] = [`## ${entry.date}`, ""];

  if (entry.tilItems.length > 0) {
    lines.push("### Today I Learned");
    for (const til of entry.tilItems) {
      lines.push(`- ${til.text} (\`${til.sha}\`, ${til.repoName})`);
    }
    lines.push("");
  }

  for (const repo of entry.repos) {
    if (repo.commits.length === 0) {
      continue;
    }
    lines.push(`### ${repo.repoName}`, "");
    const sorted = sortByTimestampAsc(repo.commits);
    for (const commit of sorted) {
      lines.push(
        `- \`${shortSha(commit.sha)}\` ${commit.subject} — ${commit.category} (+${commit.insertions} / -${commit.deletions})`,
      );
    }
    lines.push("");
  }

  lines.push("---", "");

  return lines.join("\n");
};

export const formatDailyFile = (date: string, entryMarkdown: string): string => {
  return `# Code Diary — ${date}\n\n${entryMarkdown}`;
};

const REPO_HEADING_RE = /^### (.+)$/;
const TIL_ITEM_RE = /^- (.+) \(`([a-f0-9]{7})`, (.+)\)$/;

const trimTrailingBlanks = (lines: string[]): string => {
  let end = lines.length;
  while (end > 0 && lines[end - 1]!.trim() === "") {
    end--;
  }
  return lines.slice(0, end).join("\n");
};

export const extractRepoSections = (content: string): Map<string, string> => {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentRepo: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(REPO_HEADING_RE);

    if (match && match[1] !== "Today I Learned") {
      if (currentRepo) {
        sections.set(currentRepo, trimTrailingBlanks(currentLines));
      }
      currentRepo = match[1]!;
      currentLines = [line];
      continue;
    }

    if (currentRepo && (line === "---" || (match && match[1] === "Today I Learned"))) {
      sections.set(currentRepo, trimTrailingBlanks(currentLines));
      currentRepo = null;
      currentLines = [];
      continue;
    }

    if (currentRepo) {
      currentLines.push(line);
    }
  }

  if (currentRepo) {
    sections.set(currentRepo, trimTrailingBlanks(currentLines));
  }

  return sections;
};

export const extractExistingTilItems = (content: string): TilItem[] => {
  const items: TilItem[] = [];
  const lines = content.split("\n");
  let inTil = false;

  for (const line of lines) {
    if (line === "### Today I Learned") {
      inTil = true;
      continue;
    }
    if (inTil && (line.startsWith("### ") || line.startsWith("## "))) {
      break;
    }
    if (inTil) {
      const match = line.match(TIL_ITEM_RE);
      if (match) {
        items.push({ text: match[1]!, sha: match[2]!, repoName: match[3]! });
      }
    }
  }

  return items;
};

export const mergeDailyContent = (
  existingContent: string,
  newEntry: DiaryEntry,
): string => {
  const newRepoNames = new Set(newEntry.repos.map((r) => r.repoName));

  const existingRepoSections = extractRepoSections(existingContent);
  const preservedSections: string[] = [];
  for (const [name, section] of existingRepoSections) {
    if (!newRepoNames.has(name)) {
      preservedSections.push(section);
    }
  }

  const existingTilItems = extractExistingTilItems(existingContent);
  const preservedTilItems = existingTilItems.filter(
    (item) => !newRepoNames.has(item.repoName),
  );

  const seen = new Set(newEntry.tilItems.map((t) => t.text));
  const mergedTilItems = [...newEntry.tilItems];
  for (const item of preservedTilItems) {
    if (!seen.has(item.text)) {
      seen.add(item.text);
      mergedTilItems.push(item);
    }
  }

  const mergedEntry: DiaryEntry = {
    ...newEntry,
    tilItems: mergedTilItems,
  };

  let entryMarkdown = formatDiaryEntry(mergedEntry);

  if (preservedSections.length > 0) {
    const lastSep = entryMarkdown.lastIndexOf("---\n");
    if (lastSep > 0) {
      const before = entryMarkdown.slice(0, lastSep);
      const after = entryMarkdown.slice(lastSep);
      entryMarkdown = before + preservedSections.join("\n\n") + "\n\n" + after;
    }
  }

  return formatDailyFile(newEntry.date, entryMarkdown);
};
