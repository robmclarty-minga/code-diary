import type { DiaryEntry, TilItem } from "./types/diary.js";
export declare const formatDiaryEntry: (entry: DiaryEntry) => string;
export declare const formatDailyFile: (date: string, entryMarkdown: string) => string;
export declare const extractRepoSections: (content: string) => Map<string, string>;
export declare const extractExistingTilItems: (content: string) => TilItem[];
export declare const mergeDailyContent: (existingContent: string, newEntry: DiaryEntry) => string;
