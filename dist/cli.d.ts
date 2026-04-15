import type { CliArgs } from "./types/diary.js";
export type SinceOffset = {
    n: number;
    unit: "d" | "w" | "m";
};
export declare const parseSince: (s: string) => SinceOffset | null;
export declare const computeStartDate: (endDate: string, offset: SinceOffset) => string;
export declare const dateRange: (start: string, end: string) => string[];
export declare const isValidDate: (dateStr: string) => boolean;
export declare const parseArgs: (argv: string[]) => CliArgs;
export declare const validateRepoPaths: (paths: string[]) => void;
export declare const buildOutputPath: (outputDir: string, date: string) => string;
export declare const resolveAuthorsForRepo: (repoPath: string, settingsAuthors: string[] | undefined, warn: (msg: string) => void, getEmail?: (repoPath: string) => string | undefined) => string[] | undefined;
export declare const run: (argv: string[]) => Promise<void>;
