import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
export const readFile = (filePath) => {
    return readFileSync(filePath, "utf8");
};
export const writeFile = (filePath, content) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");
};
export const fileExists = (filePath) => {
    return existsSync(filePath);
};
