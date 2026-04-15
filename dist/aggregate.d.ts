import type { ParsedDiaryDay, WeekDescriptor } from "./types/aggregate.js";
export declare const findDailyFiles: (dailyDir: string) => string[];
export declare const getMonthWeeks: (month: string) => WeekDescriptor[];
export declare const getMonths: (from: string, to: string) => string[];
export declare const buildSummaryTable: (days: ParsedDiaryDay[]) => string;
export declare const collectTilItems: (days: ParsedDiaryDay[]) => string[];
export declare const formatWeeklyReport: (week: WeekDescriptor, days: ParsedDiaryDay[]) => string;
export declare const formatMonthlyReport: (month: string, days: ParsedDiaryDay[]) => string;
export declare const generateReports: (diaryDir: string, days: ParsedDiaryDay[]) => {
    weeklyCount: number;
    monthlyCount: number;
};
