import type { Commit } from "./types/diary.js";

export const readGitLog = (repoPath: string, date: string): string => {
  void repoPath;
  void date;
  throw new Error("not implemented");
};

export const parseGitLog = (raw: string): Commit[] => {
  void raw;
  throw new Error("not implemented");
};
