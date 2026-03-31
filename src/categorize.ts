import type {
  Commit,
  CategorizedCommit,
  DaySegment,
  RepoEntry,
  DiaryEntry,
} from "./types/diary.js";

export const categorizeCommit = (commit: Commit): CategorizedCommit => {
  void commit;
  throw new Error("not implemented");
};

export const extractTilItems = (subject: string, body: string): string[] => {
  void subject;
  void body;
  throw new Error("not implemented");
};

export const assignDaySegment = (
  timestamp: Date,
  tzOffset: string,
): DaySegment => {
  void timestamp;
  void tzOffset;
  throw new Error("not implemented");
};

export const buildRepoEntry = (
  repoPath: string,
  commits: Commit[],
): RepoEntry => {
  void repoPath;
  void commits;
  throw new Error("not implemented");
};

export const buildDiaryEntry = (
  date: string,
  repos: RepoEntry[],
): DiaryEntry => {
  void date;
  void repos;
  throw new Error("not implemented");
};
