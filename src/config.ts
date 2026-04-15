import { homedir } from "os";
import { join } from "path";
import type { Settings, CliArgs, ResolvedArgs } from "./types/diary.js";
import { fileExists, readFile } from "./fileIO.js";

const CONFIG_PATH = join(homedir(), ".code-diary", "settings.json");

export const expandTilde = (p: string): string => {
  if (p === "~") {
    return homedir();
  }
  if (p.startsWith("~/")) {
    return join(homedir(), p.slice(2));
  }
  return p;
};

export const loadSettings = (): Settings => {
  if (!fileExists(CONFIG_PATH)) {
    return {};
  }

  const raw = readFile(CONFIG_PATH);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${CONFIG_PATH}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file must be a JSON object: ${CONFIG_PATH}`);
  }

  const obj = parsed as Record<string, unknown>;

  if ("output-dir" in obj && typeof obj["output-dir"] !== "string") {
    throw new Error(`"output-dir" must be a string in ${CONFIG_PATH}`);
  }

  if ("repos" in obj) {
    if (!Array.isArray(obj["repos"])) {
      throw new Error(`"repos" must be an array in ${CONFIG_PATH}`);
    }
    for (const item of obj["repos"] as unknown[]) {
      if (typeof item !== "string") {
        throw new Error(`"repos" must be an array of strings in ${CONFIG_PATH}`);
      }
    }
  }

  return parsed as Settings;
};

export const resolveArgs = (cliArgs: CliArgs, settings: Settings): ResolvedArgs => {
  const rawRepoPaths = cliArgs.repoPaths.length > 0
    ? cliArgs.repoPaths
    : settings.repos ?? [];
  const repoPaths = rawRepoPaths.map(expandTilde);

  const rawOutputDir = cliArgs.outputDir ?? settings["output-dir"] ?? process.cwd();
  const outputDir = expandTilde(rawOutputDir);

  return {
    repoPaths,
    date: cliArgs.date,
    outputDir,
  };
};
