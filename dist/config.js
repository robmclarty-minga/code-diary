import { homedir } from "os";
import { join } from "path";
import { fileExists, readFile } from "./fileIO.js";
const CONFIG_PATH = join(homedir(), ".code-diary", "settings.json");
export const loadSettings = () => {
    if (!fileExists(CONFIG_PATH)) {
        return {};
    }
    const raw = readFile(CONFIG_PATH);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`Invalid JSON in config file: ${CONFIG_PATH}`);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Config file must be a JSON object: ${CONFIG_PATH}`);
    }
    const obj = parsed;
    if ("output-dir" in obj && typeof obj["output-dir"] !== "string") {
        throw new Error(`"output-dir" must be a string in ${CONFIG_PATH}`);
    }
    if ("repos" in obj) {
        if (!Array.isArray(obj["repos"])) {
            throw new Error(`"repos" must be an array in ${CONFIG_PATH}`);
        }
        for (const item of obj["repos"]) {
            if (typeof item !== "string") {
                throw new Error(`"repos" must be an array of strings in ${CONFIG_PATH}`);
            }
        }
    }
    return parsed;
};
export const resolveArgs = (cliArgs, settings) => {
    const repoPaths = cliArgs.repoPaths.length > 0
        ? cliArgs.repoPaths
        : settings.repos ?? [];
    const outputDir = cliArgs.outputDir ?? settings["output-dir"] ?? process.cwd();
    return {
        repoPaths,
        date: cliArgs.date,
        outputDir,
    };
};
