import type { Settings, CliArgs, ResolvedArgs } from "./types/diary.js";
export declare const expandTilde: (p: string) => string;
export declare const loadSettings: () => Settings;
export declare const resolveArgs: (cliArgs: CliArgs, settings: Settings) => ResolvedArgs;
