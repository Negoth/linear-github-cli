/**
 * Helpers for matching GitHub issue URLs exactly.
 *
 * Linear attachment URLs can vary slightly from the URL we build
 * (trailing slash, `#issuecomment-...`, query string, `www.`, `http`, casing),
 * so both sides are normalized before comparing.
 */

const GITHUB_ISSUE_URL_PATTERN =
  /^https?:\/\/(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)\/issues\/(\d+)(?:[/?#].*)?$/i;

/**
 * Returns `https://github.com/<owner>/<repo>/issues/<number>` (owner/repo lowercased),
 * or null if the URL is not a GitHub issue URL.
 */
export function normalizeGitHubIssueUrl(url: string): string | null {
  const match = url.trim().match(GITHUB_ISSUE_URL_PATTERN);
  if (!match) {
    return null;
  }
  const [, owner, repo, number] = match;
  return `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}/issues/${Number(number)}`;
}

/**
 * Text to send to Linear's `containsIgnoreCase` filter to narrow candidates.
 * The result may include other issues (e.g. `/issues/1` also matches `/issues/13`),
 * so callers must filter with `pickIssueIdByGitHubUrl`.
 */
export function gitHubIssueUrlSearchTerm(url: string): string {
  const normalized = normalizeGitHubIssueUrl(url);
  return normalized ? normalized.replace(/^https:\/\//, '') : url;
}

/**
 * Picks the Linear issue whose attachment URL points to exactly the same GitHub issue.
 */
export function pickIssueIdByGitHubUrl(
  attachments: Array<{ url: string | null | undefined; issueId: string | null | undefined }>,
  githubUrl: string
): string | null {
  const target = normalizeGitHubIssueUrl(githubUrl);
  if (!target) {
    return null;
  }
  const match = attachments.find(
    a => a.issueId && a.url && normalizeGitHubIssueUrl(a.url) === target
  );
  return match?.issueId ?? null;
}
