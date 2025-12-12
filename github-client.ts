import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

export class GitHubClientWrapper {
  private octokit?: Octokit;
  public repo: string;

  constructor(repo: string, token?: string) {
    this.repo = repo;
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
  }

  async getRepositories(): Promise<Array<{ owner: string; name: string; fullName: string }>> {
    // Use gh CLI to get accessible repos
    const output = execSync('gh repo list --limit 100 --json nameWithOwner', {
      encoding: 'utf-8',
    });
    const repos = JSON.parse(output);
    return repos.map((r: { nameWithOwner: string }) => {
      const [owner, name] = r.nameWithOwner.split('/');
      return { owner, name, fullName: r.nameWithOwner };
    });
  }

  async getProjects(repo: string): Promise<Array<{ id: string; name: string }>> {
    // Extract owner from repo (format: owner/repo)
    const [owner] = repo.split('/');
    
    // Use gh CLI to get projects - note: gh project list uses --owner, not --repo
    // Output format: {"projects": [...], "totalCount": N}
    const output = execSync(
      `gh project list --owner ${owner} --limit 50 --format json`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    const result = JSON.parse(output);
    
    // Handle both array format and object format
    const projects = Array.isArray(result) ? result : (result.projects || []);
    
    return projects.map((p: { title: string; number: number }) => ({
      id: p.number.toString(),
      name: p.title,
    }));
  }

  async createIssue(params: {
    repo: string;
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
    project?: string;
  }): Promise<{ number: number; url: string; id: string }> {
    // gh issue create doesn't support --json flag, so we parse the URL from output
    // Output format: "https://github.com/owner/repo/issues/123"
    const command = `gh issue create --repo ${params.repo} ` +
      `--title "${params.title.replace(/"/g, '\\"')}" ` +
      `--body "${params.body.replace(/"/g, '\\"')}" ` +
      (params.labels && params.labels.length > 0 ? `--label "${params.labels.join(',')}" ` : '') +
      (params.assignees && params.assignees.length > 0 ? `--assignee "${params.assignees.join(',')}" ` : '') +
      (params.project ? `--project "${params.project}" ` : '');
    
    const output = execSync(command, { encoding: 'utf-8' });
    
    // Parse URL from output: "https://github.com/owner/repo/issues/123"
    const urlMatch = output.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/);
    if (!urlMatch) {
      throw new Error(`Failed to parse issue URL from output: ${output}`);
    }
    
    const issueNumber = parseInt(urlMatch[1], 10);
    const issueUrl = urlMatch[0];
    
    // Get issue ID using GraphQL API
    const issueId = await this.getIssueIdByNumber(params.repo, issueNumber);
    
    return {
      number: issueNumber,
      url: issueUrl,
      id: issueId,
    };
  }

  async createSubIssue(params: {
    repo: string;
    parentIssueNumber: number;
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<{ number: number; url: string; id: string }> {
    // First create the issue
    const issue = await this.createIssue({
      repo: params.repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
      assignees: params.assignees,
    });

    // Then set parent-child relationship via GraphQL
    const parentIssue = await this.getIssueById(params.repo, params.parentIssueNumber);
    
    execSync(
      `gh api graphql -H "GraphQL-Features: sub_issues" -f query="
        mutation {
          addSubIssue(input: {
            issueId: \\\"${parentIssue.id}\\\",
            subIssueId: \\\"${issue.id}\\\"
          }) {
            issue { title }
            subIssue { title }
          }
        }
      "`,
      { encoding: 'utf-8' }
    );

    return issue;
  }

  private async getIssueIdByNumber(repo: string, issueNumber: number): Promise<string> {
    // Use GraphQL API to get issue ID
    const [owner, name] = repo.split('/');
    const query = `query { repository(owner: "${owner}", name: "${name}") { issue(number: ${issueNumber}) { id } } }`;
    
    const output = execSync(
      `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8' }
    );
    
    const result = JSON.parse(output);
    return result.data.repository.issue.id;
  }

  private async getIssueById(repo: string, issueNumber: number): Promise<{ id: string }> {
    const id = await this.getIssueIdByNumber(repo, issueNumber);
    return { id };
  }

  async getLabels(repo: string): Promise<string[]> {
    try {
      // Use gh CLI to get labels from repository
      const output = execSync(
        `gh label list --repo ${repo} --limit 100 --json name`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      const labels = JSON.parse(output);
      return labels.map((l: { name: string }) => l.name).sort();
    } catch (error: any) {
      // Fallback to standard labels if API call fails
      console.error('⚠️  Failed to fetch labels from GitHub, using default labels');
      return [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'research',
      ];
    }
  }
}

