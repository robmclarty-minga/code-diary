import type { DiaryEntry } from "./types/diary.js";

export const formatDiaryEntry = (entry: DiaryEntry): string => {
  void entry;
  throw new Error("not implemented");
};

export const findExistingEntry = (content: string, date: string): boolean => {
  void content;
  void date;
  throw new Error("not implemented");
};

export const replaceEntry = (
  content: string,
  date: string,
  newEntry: string,
): string => {
  void content;
  void date;
  void newEntry;
  throw new Error("not implemented");
};

export const appendEntry = (
  content: string | null,
  date: string,
  newEntry: string,
): string => {
  void content;
  void date;
  void newEntry;
  throw new Error("not implemented");
};
