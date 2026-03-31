import type { DiaryEntry } from "./types/diary.js";
export declare const formatDiaryEntry: (entry: DiaryEntry) => string;
export declare const findExistingEntry: (content: string, date: string) => boolean;
export declare const replaceEntry: (content: string, date: string, newEntry: string) => string;
export declare const appendEntry: (content: string | null, date: string, newEntry: string) => string;
