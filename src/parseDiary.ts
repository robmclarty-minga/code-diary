import type {
  ParsedDiaryDay,
  RepoSection,
  AuthorSummary,
} from "./types/aggregate.js";

const DATE_HEADING_REGEX = /^## (\d{4}-\d{2}-\d{2})$/;
const REPO_HEADING_REGEX = /^### (.+)$/;
const COMMIT_LINE_REGEX = /^- `[a-f0-9]{7}` .+ — (\w+) \(\+\d+ \/ -\d+\)$/;
const TIL_LINE_REGEX = /^- (.+) \(`[a-f0-9]{7}`, .+\)$/;
const AUTHOR_LINE_REGEX =
  /^- (.+) — (\d+) commits? \(\+(\d+) \/ -(\d+)\)$/;

const RESERVED_HEADINGS = new Set(["Today I Learned", "Commits by Author"]);

export const parseDailyFile = (content: string): ParsedDiaryDay => {
  const lines = content.split("\n");

  let date = "";
  const tilItems: string[] = [];
  const repos: RepoSection[] = [];
  const authors: AuthorSummary[] = [];
  let rawMarkdown = "";

  let inTil = false;
  let inAuthors = false;
  let currentRepo: RepoSection | null = null;

  for (const line of lines) {
    const dateMatch = line.match(DATE_HEADING_REGEX);
    if (dateMatch) {
      date = dateMatch[1]!;
      continue;
    }

    if (line.startsWith("# Code Diary")) {
      continue;
    }

    if (line === "### Today I Learned") {
      inTil = true;
      inAuthors = false;
      currentRepo = null;
      continue;
    }

    if (line === "### Commits by Author") {
      inAuthors = true;
      inTil = false;
      currentRepo = null;
      continue;
    }

    const repoMatch = line.match(REPO_HEADING_REGEX);
    if (repoMatch && !RESERVED_HEADINGS.has(repoMatch[1]!)) {
      inTil = false;
      inAuthors = false;
      currentRepo = { name: repoMatch[1]!, commitCount: 0, categories: {} };
      repos.push(currentRepo);
      continue;
    }

    if (inTil) {
      const tilMatch = line.match(TIL_LINE_REGEX);
      if (tilMatch) {
        tilItems.push(tilMatch[1]!);
      }
      continue;
    }

    if (inAuthors) {
      const authorMatch = line.match(AUTHOR_LINE_REGEX);
      if (authorMatch) {
        authors.push({
          name: authorMatch[1]!,
          commits: parseInt(authorMatch[2]!, 10),
          insertions: parseInt(authorMatch[3]!, 10),
          deletions: parseInt(authorMatch[4]!, 10),
        });
      }
      continue;
    }

    if (currentRepo !== null) {
      const commitMatch = line.match(COMMIT_LINE_REGEX);
      if (commitMatch) {
        currentRepo.commitCount += 1;
        const category = commitMatch[1]!;
        currentRepo.categories[category] = (currentRepo.categories[category] ?? 0) + 1;
      }
    }
  }

  const entryStart = content.indexOf("## ");
  if (entryStart !== -1) {
    rawMarkdown = content.slice(entryStart);
  }

  return { date, rawMarkdown, repos, tilItems, authors };
};

export const extractDateFromFilename = (filename: string): string => {
  const match = filename.match(/code-diary-(\d{4}-\d{2}-\d{2})\.md$/);
  return match ? match[1]! : "";
};
