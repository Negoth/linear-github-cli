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

  /**
   * Get project node ID by project name
   */
  async getProjectNodeId(repo: string, projectName: string): Promise<string | null> {
    try {
      const [owner] = repo.split('/');
      const query = `query {
        organization(login: "${owner}") {
          projectsV2(first: 50) {
            nodes {
              id
              title
            }
          }
        }
      }`;
      
      const output = execSync(
        `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      const projects = result.data?.organization?.projectsV2?.nodes || [];
      const project = projects.find((p: { title: string }) => p.title === projectName);
      return project?.id || null;
    } catch (error) {
      console.error('⚠️  Failed to get project node ID:', error);
      return null;
    }
  }

  /**
   * Get project field ID by field name
   */
  async getProjectFieldId(projectId: string, fieldName: string): Promise<string | null> {
    try {
      const query = `query {
        node(id: "${projectId}") {
          ... on ProjectV2 {
            fields(first: 50) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
              }
            }
          }
        }
      }`;
      
      const output = execSync(
        `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      const fields = result.data?.node?.fields?.nodes || [];
      const field = fields.find((f: { name: string }) => f.name === fieldName);
      return field?.id || null;
    } catch (error) {
      console.error(`⚠️  Failed to get field ID for "${fieldName}":`, error);
      return null;
    }
  }

  /**
   * Get project item ID by issue ID
   */
  async getProjectItemId(projectId: string, issueId: string): Promise<string | null> {
    try {
      const query = `query {
        node(id: "${projectId}") {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    id
                  }
                }
              }
            }
          }
        }
      }`;
      
      const output = execSync(
        `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      const items = result.data?.node?.items?.nodes || [];
      const item = items.find((i: { content: { id: string } }) => i.content?.id === issueId);
      return item?.id || null;
    } catch (error) {
      console.error('⚠️  Failed to get project item ID:', error);
      return null;
    }
  }

  /**
   * Set date field value for a project item
   */
  async setProjectItemDateField(
    projectId: string,
    itemId: string,
    fieldId: string,
    date: string
  ): Promise<boolean> {
    try {
      const mutation = `mutation {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: "${projectId}"
            itemId: "${itemId}"
            fieldId: "${fieldId}"
            value: {
              date: "${date}"
            }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }`;
      
      const output = execSync(
        `gh api graphql -f query="${mutation.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      return !!result.data?.updateProjectV2ItemFieldValue?.projectV2Item;
    } catch (error) {
      console.error('⚠️  Failed to set project date field:', error);
      return false;
    }
  }

  /**
   * Set GitHub Project date fields (Target and Start) for an issue
   */
  async setProjectDateFields(
    repo: string,
    projectName: string,
    issueId: string,
    targetDate?: string,
    startDate?: string
  ): Promise<boolean> {
    try {
      // Get project node ID
      const projectId = await this.getProjectNodeId(repo, projectName);
      if (!projectId) {
        console.error(`⚠️  Project "${projectName}" not found`);
        return false;
      }

      // Get project item ID
      const itemId = await this.getProjectItemId(projectId, issueId);
      if (!itemId) {
        console.error(`⚠️  Issue not found in project "${projectName}"`);
        return false;
      }

      let success = true;

      // Set Target date field if provided
      if (targetDate) {
        const targetFieldId = await this.getProjectFieldId(projectId, 'Target');
        if (targetFieldId) {
          const result = await this.setProjectItemDateField(projectId, itemId, targetFieldId, targetDate);
          if (result) {
            console.log(`   ✅ Set Target date: ${targetDate}`);
          } else {
            console.log(`   ⚠️  Failed to set Target date`);
            success = false;
          }
        } else {
          console.log(`   ⚠️  Target field not found in project`);
        }
      }

      // Set Start date field if provided
      if (startDate) {
        const startFieldId = await this.getProjectFieldId(projectId, 'Start');
        if (startFieldId) {
          const result = await this.setProjectItemDateField(projectId, itemId, startFieldId, startDate);
          if (result) {
            console.log(`   ✅ Set Start date: ${startDate}`);
          } else {
            console.log(`   ⚠️  Failed to set Start date`);
            success = false;
          }
        } else {
          console.log(`   ⚠️  Start field not found in project`);
        }
      }

      return success;
    } catch (error) {
      console.error('⚠️  Failed to set project date fields:', error);
      return false;
    }
  }

  /**
   * Get GitHub Project name from issue ID
   */
  async getIssueProject(repo: string, issueId: string): Promise<string | null> {
    try {
      const [owner, name] = repo.split('/');
      const query = `query {
        repository(owner: "${owner}", name: "${name}") {
          issue(id: "${issueId}") {
            projectItems(first: 10) {
              nodes {
                project {
                  ... on ProjectV2 {
                    title
                  }
                }
              }
            }
          }
        }
      }`;
      
      const output = execSync(
        `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      const projectItems = result.data?.repository?.issue?.projectItems?.nodes || [];
      if (projectItems.length > 0) {
        return projectItems[0].project?.title || null;
      }
      return null;
    } catch (error) {
      console.error('⚠️  Failed to get issue project:', error);
      return null;
    }
  }
}

