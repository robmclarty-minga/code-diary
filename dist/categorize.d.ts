import type { Commit, CategorizedCommit, DaySegment, RepoEntry, DiaryEntry } from "./types/diary.js";
export declare const categorizeCommit: (commit: Commit) => CategorizedCommit;
export declare const extractTilItems: (subject: string, body: string) => string[];
export declare const assignDaySegment: (timestamp: Date, tzOffset: string) => DaySegment;
export declare const buildRepoEntry: (repoPath: string, commits: Commit[]) => RepoEntry;
export declare const buildDiaryEntry: (date: string, repos: RepoEntry[]) => DiaryEntry;
