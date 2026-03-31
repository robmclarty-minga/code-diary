export const formatDiaryEntry = (entry) => {
    const hasCommits = entry.repos.some((r) => r.commits.length > 0);
    if (!hasCommits) {
        return "";
    }
    const lines = [`## ${entry.date}`, ""];
    if (entry.tilItems.length > 0) {
        lines.push("### Today I Learned");
        for (const til of entry.tilItems) {
            lines.push(`- ${til.text} (\`${til.sha}\`, ${til.repoName})`);
        }
        lines.push("");
    }
    for (const repo of entry.repos) {
        if (repo.commits.length === 0) {
            continue;
        }
        lines.push(`### ${repo.repoName}`, "");
        const sorted = [...repo.commits].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        for (const commit of sorted) {
            const shortSha = commit.sha.slice(0, 7);
            lines.push(`- \`${shortSha}\` ${commit.subject} — ${commit.category} (+${commit.insertions} / -${commit.deletions})`);
        }
        lines.push("");
    }
    lines.push("---", "");
    return lines.join("\n");
};
export const findExistingEntry = (content, date) => {
    const heading = `## ${date}`;
    return content.split("\n").some((line) => line.trimEnd() === heading);
};
export const replaceEntry = (content, date, newEntry) => {
    const lines = content.split("\n");
    const heading = `## ${date}`;
    const startIdx = lines.findIndex((line) => line.trimEnd() === heading);
    if (startIdx === -1) {
        return content;
    }
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ")) {
            endIdx = i;
            break;
        }
    }
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);
    return [...before, newEntry.replace(/\n$/, ""), ...after].join("\n");
};
export const appendEntry = (content, date, newEntry) => {
    if (content === null) {
        const month = date.slice(0, 7);
        return `# Code Diary — ${month}\n\n${newEntry}`;
    }
    const separator = content.endsWith("\n") ? "" : "\n";
    return `${content}${separator}${newEntry}`;
};
