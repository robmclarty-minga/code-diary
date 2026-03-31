import type { Commit } from "./types/diary.js";
export declare const readGitLog: (repoPath: string, date: string) => string;
export declare const parseGitLog: (raw: string) => Commit[];
