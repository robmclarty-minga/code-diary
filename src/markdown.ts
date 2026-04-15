import type { DiaryEntry } from "./types/diary.js";

export const formatDiaryEntry = (entry: DiaryEntry): string => {
  const hasCommits = entry.repos.some((r) => r.commits.length > 0);
  if (!hasCommits) {
    return "";
  }

  const lines: string[] = [`## ${entry.date}`, ""];

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
    const sorted = [...repo.commits].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    for (const commit of sorted) {
      const shortSha = commit.sha.slice(0, 7);
      lines.push(
        `- \`${shortSha}\` ${commit.subject} — ${commit.category} (+${commit.insertions} / -${commit.deletions})`,
      );
    }
    lines.push("");
  }

  lines.push("---", "");

  return lines.join("\n");
};

export const formatDailyFile = (date: string, entryMarkdown: string): string => {
  return `# Code Diary — ${date}\n\n${entryMarkdown}`;
};
