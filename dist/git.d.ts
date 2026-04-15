import type { Commit } from "./types/diary.js";
export declare const readGitLog: (repoPath: string, date: string, authors?: string[]) => string;
export declare const getAuthorEmail: (repoPath: string) => string | undefined;
export declare const parseGitLog: (raw: string) => Commit[];
