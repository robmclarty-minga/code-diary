import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export const readFile = (filePath: string): string => {
  return readFileSync(filePath, "utf8");
};

export const writeFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
};

export const fileExists = (filePath: string): boolean => {
  return existsSync(filePath);
};
