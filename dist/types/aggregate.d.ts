export type AggregateArgs = {
    diaryDir: string;
    from: string;
    to: string;
};
export type RepoSection = {
    name: string;
    commitCount: number;
    categories: Record<string, number>;
};
export type ParsedDiaryDay = {
    date: string;
    rawMarkdown: string;
    repos: RepoSection[];
    tilItems: string[];
};
export type WeekDescriptor = {
    slug: string;
    month: string;
    weekNum: number;
    from: string;
    to: string;
};
