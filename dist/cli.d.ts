import type { CliArgs } from "./types/diary.js";
export declare const isValidDate: (dateStr: string) => boolean;
export declare const parseArgs: (argv: string[]) => CliArgs;
export declare const validateRepoPaths: (paths: string[]) => void;
export declare const promptReplace: (date: string) => Promise<boolean>;
export declare const buildOutputPath: (outputDir: string, date: string) => string;
export declare const run: (argv: string[]) => Promise<void>;
