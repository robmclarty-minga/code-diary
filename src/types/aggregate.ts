export type AggregateArgs = {
  diaryDir: string;
  from: string;
  to: string;
  yearly: boolean;
};

export type RepoSection = {
  name: string;
  commitCount: number;
  categories: Record<string, number>;
};

export type AuthorSummary = {
  name: string;
  commits: number;
  insertions: number;
  deletions: number;
};

export type ParsedDiaryDay = {
  date: string;
  rawMarkdown: string;
  repos: RepoSection[];
  tilItems: string[];
  authors: AuthorSummary[];
};

export type WeekDescriptor = {
  slug: string;
  month: string;
  weekNum: number;
  from: string;
  to: string;
};

export type YearDescriptor = {
  year: string;
  from: string;
  to: string;
};
