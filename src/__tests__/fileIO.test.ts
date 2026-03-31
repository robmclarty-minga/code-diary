import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, rmSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { readFile, writeFile, fileExists } from "../fileIO.js";

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `fileIO-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

let tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

const getTmpDir = (): string => {
  const dir = makeTmpDir();
  tmpDirs.push(dir);
  return dir;
};

describe("writeFile", () => {
  it("creates intermediate directories if they do not exist", () => {
    const dir = getTmpDir();
    const filePath = join(dir, "a", "b", "c", "test.txt");

    writeFile(filePath, "hello");

    expect(existsSync(filePath)).toBe(true);
    expect(readFile(filePath)).toBe("hello");
  });

  it("overwrites an existing file", () => {
    const dir = getTmpDir();
    const filePath = join(dir, "overwrite.txt");

    writeFile(filePath, "first");
    writeFile(filePath, "second");

    expect(readFile(filePath)).toBe("second");
  });
});

describe("readFile", () => {
  it("reads an existing file and returns its content", () => {
    const dir = getTmpDir();
    const filePath = join(dir, "read.txt");
    writeFile(filePath, "content here");

    expect(readFile(filePath)).toBe("content here");
  });

  it("throws when the file does not exist", () => {
    expect(() => readFile("/nonexistent/path/file.txt")).toThrow();
  });
});

describe("fileExists", () => {
  it("returns true for an existing file", () => {
    const dir = getTmpDir();
    const filePath = join(dir, "exists.txt");
    writeFile(filePath, "yes");

    expect(fileExists(filePath)).toBe(true);
  });

  it("returns false for a non-existent path", () => {
    expect(fileExists("/nonexistent/path/nope.txt")).toBe(false);
  });
});
