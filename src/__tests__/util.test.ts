import { describe, it, expect } from "vitest";
import {
  SHA_SHORT_LENGTH,
  shortSha,
  sortByDateDesc,
  sortByTimestampAsc,
} from "../util.js";

describe("SHA_SHORT_LENGTH", () => {
  it("is 7", () => {
    expect(SHA_SHORT_LENGTH).toBe(7);
  });
});

describe("shortSha", () => {
  it("returns first 7 characters", () => {
    expect(shortSha("abcdef1234567890")).toBe("abcdef1");
  });

  it("returns whole string if shorter than 7", () => {
    expect(shortSha("abc")).toBe("abc");
  });
});

describe("sortByTimestampAsc", () => {
  it("sorts ascending by timestamp", () => {
    const a = { timestamp: new Date("2026-01-02T10:00:00Z") };
    const b = { timestamp: new Date("2026-01-01T10:00:00Z") };
    const c = { timestamp: new Date("2026-01-03T10:00:00Z") };
    const sorted = sortByTimestampAsc([a, b, c]);
    expect(sorted.map((x) => x.timestamp.toISOString())).toEqual([
      "2026-01-01T10:00:00.000Z",
      "2026-01-02T10:00:00.000Z",
      "2026-01-03T10:00:00.000Z",
    ]);
  });

  it("does not mutate the input array", () => {
    const a = { timestamp: new Date("2026-01-02T10:00:00Z") };
    const b = { timestamp: new Date("2026-01-01T10:00:00Z") };
    const input = [a, b];
    sortByTimestampAsc(input);
    expect(input).toEqual([a, b]);
  });
});

describe("sortByDateDesc", () => {
  it("sorts descending by date string", () => {
    const items = [
      { date: "2026-01-01" },
      { date: "2026-01-03" },
      { date: "2026-01-02" },
    ];
    expect(sortByDateDesc(items).map((x) => x.date)).toEqual([
      "2026-01-03",
      "2026-01-02",
      "2026-01-01",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [{ date: "2026-01-01" }, { date: "2026-01-02" }];
    sortByDateDesc(input);
    expect(input.map((x) => x.date)).toEqual(["2026-01-01", "2026-01-02"]);
  });
});
