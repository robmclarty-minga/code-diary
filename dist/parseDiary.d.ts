import type { ParsedDiaryDay } from "./types/aggregate.js";
export declare const parseDailyFile: (content: string) => ParsedDiaryDay;
export declare const extractDateFromFilename: (filename: string) => string;
