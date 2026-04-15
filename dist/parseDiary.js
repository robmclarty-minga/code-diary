const DATE_HEADING_REGEX = /^## (\d{4}-\d{2}-\d{2})$/;
const REPO_HEADING_REGEX = /^### (.+)$/;
const COMMIT_LINE_REGEX = /^- `[a-f0-9]{7}` .+ — (\w+) \(\+\d+ \/ -\d+\)$/;
const TIL_LINE_REGEX = /^- (.+) \(`[a-f0-9]{7}`, .+\)$/;
export const parseDailyFile = (content) => {
    const lines = content.split("\n");
    let date = "";
    const tilItems = [];
    const repos = [];
    let rawMarkdown = "";
    let inTil = false;
    let currentRepo = null;
    for (const line of lines) {
        const dateMatch = line.match(DATE_HEADING_REGEX);
        if (dateMatch) {
            date = dateMatch[1];
            continue;
        }
        if (line.startsWith("# Code Diary")) {
            continue;
        }
        if (line === "### Today I Learned") {
            inTil = true;
            currentRepo = null;
            continue;
        }
        const repoMatch = line.match(REPO_HEADING_REGEX);
        if (repoMatch && repoMatch[1] !== "Today I Learned") {
            inTil = false;
            currentRepo = { name: repoMatch[1], commitCount: 0, categories: {} };
            repos.push(currentRepo);
            continue;
        }
        if (inTil) {
            const tilMatch = line.match(TIL_LINE_REGEX);
            if (tilMatch) {
                tilItems.push(tilMatch[1]);
            }
            continue;
        }
        if (currentRepo !== null) {
            const commitMatch = line.match(COMMIT_LINE_REGEX);
            if (commitMatch) {
                currentRepo.commitCount += 1;
                const category = commitMatch[1];
                currentRepo.categories[category] = (currentRepo.categories[category] ?? 0) + 1;
            }
        }
    }
    const entryStart = content.indexOf("## ");
    if (entryStart !== -1) {
        rawMarkdown = content.slice(entryStart);
    }
    return { date, rawMarkdown, repos, tilItems };
};
export const extractDateFromFilename = (filename) => {
    const match = filename.match(/code-diary-(\d{4}-\d{2}-\d{2})\.md$/);
    return match ? match[1] : "";
};
