export type FileStat = {
  path: string;
  insertions: number;
  deletions: number;
};

export type Commit = {
  sha: string;
  subject: string;
  body: string;
  author: string;
  timestamp: Date;
  rawTimestamp: string;
  filesChanged: FileStat[];
  insertions: number;
  deletions: number;
};

export type CommitCategory =
  | "feat"
  | "fix"
  | "refactor"
  | "docs"
  | "chore"
  | "test"
  | "style"
  | "perf"
  | "build"
  | "ci"
  | "other";

export type DaySegment = "morning" | "afternoon" | "evening" | "night";

export type CategorizedCommit = Commit & {
  category: CommitCategory;
  tilItems: string[];
  daySegment: DaySegment;
};

export type TilItem = {
  text: string;
  repoName: string;
  sha: string;
};

export type RepoEntry = {
  repoPath: string;
  repoName: string;
  commits: CategorizedCommit[];
};

export type DiaryEntry = {
  date: string;
  repos: RepoEntry[];
  tilItems: TilItem[];
};

export type CliArgs = {
  repoPaths: string[];
  date: string;
  outputDir: string | undefined;
};

export type Settings = {
  "output-dir"?: string;
  repos?: string[];
};

export type ResolvedArgs = {
  repoPaths: string[];
  date: string;
  outputDir: string;
};
