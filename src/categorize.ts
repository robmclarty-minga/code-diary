import { basename } from "path";
import type {
  Commit,
  CategorizedCommit,
  CommitCategory,
  DaySegment,
  RepoEntry,
  DiaryEntry,
  TilItem,
} from "./types/diary.js";
import { shortSha, sortByTimestampAsc } from "./util.js";

const CATEGORY_REGEX =
  /^(feat|fix|refactor|docs|chore|test|style|perf|build|ci)(\(.+\))?:/i;

export const categorizeCommit = (commit: Commit): CategorizedCommit => {
  const subject = commit.subject.trimStart();
  const match = subject.match(CATEGORY_REGEX);
  const category: CommitCategory = match
    ? (match[1]!.toLowerCase() as CommitCategory)
    : "other";

  const tilItems = extractTilItems(commit.subject, commit.body);
  const tzOffset = commit.rawTimestamp.slice(-5);
  const daySegment = assignDaySegment(commit.timestamp, tzOffset);

  return {
    ...commit,
    category,
    tilItems,
    daySegment,
  };
};

export const extractTilItems = (subject: string, body: string): string[] => {
  const items: string[] = [];
  const lines = [subject, ...body.split("\n")];
  for (const line of lines) {
    const idx = line.indexOf("TIL:");
    if (idx !== -1) {
      const text = line.slice(idx + 4).trim();
      if (text.length > 0) {
        items.push(text);
      }
    }
  }
  return items;
};

export const assignDaySegment = (
  timestamp: Date,
  tzOffset: string,
): DaySegment => {
  const sign = tzOffset[0] === "-" ? -1 : 1;
  const offsetHours = parseInt(tzOffset.slice(1, 3), 10);
  const offsetMinutes = parseInt(tzOffset.slice(3, 5), 10);
  const totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes);

  const utcMinutes =
    timestamp.getUTCHours() * 60 + timestamp.getUTCMinutes();
  let localMinutes = utcMinutes + totalOffsetMinutes;
  if (localMinutes < 0) {
    localMinutes += 1440;
  } else if (localMinutes >= 1440) {
    localMinutes -= 1440;
  }
  const localHour = Math.floor(localMinutes / 60);

  if (localHour >= 5 && localHour <= 11) {
    return "morning";
  }
  if (localHour >= 12 && localHour <= 16) {
    return "afternoon";
  }
  if (localHour >= 17 && localHour <= 23) {
    return "evening";
  }
  return "night";
};

export const buildRepoEntry = (
  repoPath: string,
  commits: Commit[],
): RepoEntry => {
  const categorized = sortByTimestampAsc(commits.map(categorizeCommit));

  return {
    repoPath,
    repoName: basename(repoPath),
    commits: categorized,
  };
};

export const buildDiaryEntry = (
  date: string,
  repos: RepoEntry[],
): DiaryEntry => {
  const seen = new Set<string>();
  const tilItems: TilItem[] = [];

  for (const repo of repos) {
    const sorted = sortByTimestampAsc(repo.commits);
    for (const commit of sorted) {
      for (const text of commit.tilItems) {
        if (!seen.has(text)) {
          seen.add(text);
          tilItems.push({
            text,
            repoName: repo.repoName,
            sha: shortSha(commit.sha),
          });
        }
      }
    }
  }

  return { date, repos, tilItems };
};
