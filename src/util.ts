import type { Commit } from "./types/diary.js";

export const SHA_SHORT_LENGTH = 7;

export const sortByTimestampAsc = <T extends Pick<Commit, "timestamp">>(
  items: readonly T[],
): T[] =>
  [...items].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

export const shortSha = (sha: string): string => sha.slice(0, SHA_SHORT_LENGTH);
