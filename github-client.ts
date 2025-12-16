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
   * Supports both Organization and User accounts
   */
  async getProjectNodeId(repo: string, projectName: string): Promise<string | null> {
    try {
      const [owner] = repo.split('/');
      let projects: Array<{ id: string; title: string }> = [];
      
      // First try Organization
      try {
        const orgQuery = `query {
          organization(login: "${owner}") {
            projectsV2(first: 50) {
              nodes {
                id
                title
              }
            }
          }
        }`;
        
        const orgOutput = execSync(
          `gh api graphql -f query="${orgQuery.replace(/"/g, '\\"')}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        
        const orgResult = JSON.parse(orgOutput);
        if (orgResult.data?.organization) {
          projects = orgResult.data.organization.projectsV2?.nodes || [];
        }
      } catch (orgError) {
        // Organization not found or error occurred, will try User below
      }
      
      // If no projects found from Organization, try User
      if (projects.length === 0) {
        try {
          const userQuery = `query {
            user(login: "${owner}") {
              projectsV2(first: 50) {
                nodes {
                  id
                  title
                }
              }
            }
          }`;
          
          const userOutput = execSync(
            `gh api graphql -f query="${userQuery.replace(/"/g, '\\"')}"`,
            { encoding: 'utf-8', stdio: 'pipe' }
          );
          
          const userResult = JSON.parse(userOutput);
          if (userResult.data?.user) {
            projects = userResult.data.user.projectsV2?.nodes || [];
          }
        } catch (userError) {
          // User not found or error occurred
        }
      }
      
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
    const debug = process.env.DEBUG === 'true';
    
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
      
      if (debug) {
        console.log(`   [DEBUG] Looking up field "${fieldName}" in project ${projectId}`);
      }
      
      const output = execSync(
        `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      
      if (debug) {
        console.log(`   [DEBUG] Fields query response:`, JSON.stringify(result, null, 2));
      }
      
      if (result.errors) {
        console.error(`   ⚠️  GraphQL errors when fetching fields:`, result.errors);
        return null;
      }
      
      const fields = result.data?.node?.fields?.nodes || [];
      const field = fields.find((f: { name: string }) => f.name === fieldName);
      
      if (field) {
        if (debug) {
          console.log(`   [DEBUG] Found field "${fieldName}" with ID: ${field.id}`);
        }
        return field.id;
      } else {
        if (debug) {
          const availableFields = fields.map((f: { name: string }) => f.name);
          console.log(`   [DEBUG] Field "${fieldName}" not found. Available fields:`, availableFields);
        }
        return null;
      }
    } catch (error: any) {
      const errorMessage = error.message || error.stderr || String(error);
      console.error(`   ⚠️  Failed to get field ID for "${fieldName}": ${errorMessage}`);
      if (debug) {
        console.error(`   [DEBUG] Full error:`, error);
      }
      return null;
    }
  }

  /**
   * Get project item ID by issue ID with retry and pagination support
   */
  async getProjectItemId(projectId: string, issueId: string, maxRetries = 3): Promise<string | null> {
    const debug = process.env.DEBUG === 'true';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let cursor: string | null = null;
        let hasNextPage = true;
        let allItems: Array<{ id: string; content: { id: string } }> = [];
        
        // Paginate through all items
        while (hasNextPage) {
          const query = cursor
            ? `query {
                node(id: "${projectId}") {
                  ... on ProjectV2 {
                    items(first: 100, after: "${cursor}") {
                      pageInfo {
                        hasNextPage
                        endCursor
                      }
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
              }`
            : `query {
                node(id: "${projectId}") {
                  ... on ProjectV2 {
                    items(first: 100) {
                      pageInfo {
                        hasNextPage
                        endCursor
                      }
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
          
          if (debug) {
            console.log(`   [DEBUG] Attempt ${attempt}/${maxRetries}: Querying project items${cursor ? ` (cursor: ${cursor})` : ''}`);
          }
          
          const output = execSync(
            `gh api graphql -f query="${query.replace(/"/g, '\\"')}"`,
            { encoding: 'utf-8', stdio: 'pipe' }
          );
          
          const result = JSON.parse(output);
          
          if (debug) {
            console.log(`   [DEBUG] GraphQL response:`, JSON.stringify(result, null, 2));
          }
          
          if (result.errors) {
            console.error(`   ⚠️  GraphQL errors on attempt ${attempt}:`, result.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
          }
          
          const itemsData = result.data?.node?.items;
          if (!itemsData) {
            console.error(`   ⚠️  Invalid response structure on attempt ${attempt}`);
            if (debug) {
              console.error(`   [DEBUG] Full response:`, JSON.stringify(result, null, 2));
            }
            throw new Error('Invalid response structure');
          }
          
          const items = itemsData.nodes || [];
          allItems = allItems.concat(items);
          
          hasNextPage = itemsData.pageInfo?.hasNextPage || false;
          cursor = itemsData.pageInfo?.endCursor || null;
          
          if (debug) {
            console.log(`   [DEBUG] Found ${items.length} items in this page (total: ${allItems.length}), hasNextPage: ${hasNextPage}`);
          }
        }
        
        // Search for the item with matching issue ID
        const item = allItems.find((i: { content: { id: string } }) => i.content?.id === issueId);
        
        if (item) {
          if (attempt > 1) {
            console.log(`   ✅ Found project item after ${attempt} attempt(s)`);
          }
          if (debug) {
            console.log(`   [DEBUG] Found item ID: ${item.id} for issue ID: ${issueId}`);
          }
          return item.id;
        }
        
        // If not found and not last attempt, wait and retry
        if (attempt < maxRetries) {
          const waitTime = attempt * 1000; // 1s, 2s, 3s
          console.log(`   ⏳ Project item not found (searched ${allItems.length} items), retrying in ${waitTime}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error(`   ⚠️  Project item not found after ${maxRetries} attempts (searched ${allItems.length} total items)`);
          if (debug) {
            console.error(`   [DEBUG] Issue ID being searched: ${issueId}`);
            console.error(`   [DEBUG] Available issue IDs in project:`, allItems.map((i: { content: { id: string } }) => i.content?.id).slice(0, 10));
          }
        }
      } catch (error: any) {
        const errorMessage = error.message || error.stderr || String(error);
        console.error(`   ⚠️  Failed to get project item ID on attempt ${attempt}/${maxRetries}:`, errorMessage);
        
        if (debug) {
          console.error(`   [DEBUG] Full error:`, error);
        }
        
        // If not last attempt, wait and retry
        if (attempt < maxRetries) {
          const waitTime = attempt * 1000;
          console.log(`   ⏳ Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    return null;
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
    const debug = process.env.DEBUG === 'true';
    
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
      
      if (debug) {
        console.log(`   [DEBUG] Executing mutation:`);
        console.log(`   [DEBUG]   Project ID: ${projectId}`);
        console.log(`   [DEBUG]   Item ID: ${itemId}`);
        console.log(`   [DEBUG]   Field ID: ${fieldId}`);
        console.log(`   [DEBUG]   Date: ${date}`);
      }
      
      const output = execSync(
        `gh api graphql -f query="${mutation.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      const result = JSON.parse(output);
      
      if (debug) {
        console.log(`   [DEBUG] Mutation response:`, JSON.stringify(result, null, 2));
      }
      
      if (result.errors) {
        console.error(`   ⚠️  GraphQL errors:`, result.errors);
        return false;
      }
      
      const success = !!result.data?.updateProjectV2ItemFieldValue?.projectV2Item;
      if (!success && debug) {
        console.error(`   [DEBUG] Mutation returned no projectV2Item in response`);
      }
      
      return success;
    } catch (error: any) {
      const errorMessage = error.message || error.stderr || String(error);
      console.error(`   ⚠️  Failed to set project date field: ${errorMessage}`);
      if (debug) {
        console.error(`   [DEBUG] Full error:`, error);
        console.error(`   [DEBUG] Stack trace:`, error.stack);
      }
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
    const debug = process.env.DEBUG === 'true';
    
    try {
      if (debug) {
        console.log(`   [DEBUG] Setting project date fields:`);
        console.log(`   [DEBUG]   Repo: ${repo}`);
        console.log(`   [DEBUG]   Project: ${projectName}`);
        console.log(`   [DEBUG]   Issue ID: ${issueId}`);
        console.log(`   [DEBUG]   Target date: ${targetDate || 'not set'}`);
        console.log(`   [DEBUG]   Start date: ${startDate || 'not set'}`);
      }
      
      // Get project node ID
      console.log(`   Looking up project "${projectName}"...`);
      const projectId = await this.getProjectNodeId(repo, projectName);
      if (!projectId) {
        console.error(`   ⚠️  Project "${projectName}" not found`);
        if (debug) {
          console.error(`   [DEBUG] Tried to find project in repo: ${repo}`);
        }
        return false;
      }
      
      if (debug) {
        console.log(`   [DEBUG] Found project ID: ${projectId}`);
      }

      // Get project item ID (with retry mechanism)
      console.log(`   Looking up issue in project...`);
      const itemId = await this.getProjectItemId(projectId, issueId);
      if (!itemId) {
        console.error(`   ⚠️  Issue not found in project "${projectName}"`);
        console.error(`   ⚠️  This may be due to a timing issue. The issue may appear in the project shortly.`);
        if (debug) {
          console.error(`   [DEBUG] Project ID: ${projectId}`);
          console.error(`   [DEBUG] Issue ID: ${issueId}`);
        }
        return false;
      }
      
      if (debug) {
        console.log(`   [DEBUG] Found project item ID: ${itemId}`);
      }

      let success = true;
      const results: { target?: boolean; start?: boolean } = {};

      // Set Target date field if provided
      if (targetDate) {
        console.log(`   Setting Target date field...`);
        const targetFieldId = await this.getProjectFieldId(projectId, 'Target');
        if (targetFieldId) {
          if (debug) {
            console.log(`   [DEBUG] Target field ID: ${targetFieldId}`);
          }
          const result = await this.setProjectItemDateField(projectId, itemId, targetFieldId, targetDate);
          results.target = result;
          if (result) {
            console.log(`   ✅ Set Target date: ${targetDate}`);
          } else {
            console.log(`   ⚠️  Failed to set Target date: ${targetDate}`);
            if (debug) {
              console.error(`   [DEBUG] Mutation may have failed. Check GraphQL response above.`);
            }
            success = false;
          }
        } else {
          console.log(`   ⚠️  Target field not found in project "${projectName}"`);
          if (debug) {
            console.error(`   [DEBUG] Make sure the project has a "Target" date field configured.`);
          }
          success = false;
        }
      }

      // Set Start date field if provided
      if (startDate) {
        console.log(`   Setting Start date field...`);
        const startFieldId = await this.getProjectFieldId(projectId, 'Start');
        if (startFieldId) {
          if (debug) {
            console.log(`   [DEBUG] Start field ID: ${startFieldId}`);
          }
          const result = await this.setProjectItemDateField(projectId, itemId, startFieldId, startDate);
          results.start = result;
          if (result) {
            console.log(`   ✅ Set Start date: ${startDate}`);
          } else {
            console.log(`   ⚠️  Failed to set Start date: ${startDate}`);
            if (debug) {
              console.error(`   [DEBUG] Mutation may have failed. Check GraphQL response above.`);
            }
            success = false;
          }
        } else {
          console.log(`   ⚠️  Start field not found in project "${projectName}"`);
          if (debug) {
            console.error(`   [DEBUG] Make sure the project has a "Start" date field configured.`);
          }
          success = false;
        }
      }

      // Summary
      if (debug) {
        console.log(`   [DEBUG] Date field setting results:`, results);
      }
      
      if (!success) {
        console.log(`   ⚠️  Some date fields failed to set. Check the messages above for details.`);
      }

      return success;
    } catch (error: any) {
      const errorMessage = error.message || error.stderr || String(error);
      console.error(`   ⚠️  Failed to set project date fields: ${errorMessage}`);
      if (debug) {
        console.error(`   [DEBUG] Full error:`, error);
        console.error(`   [DEBUG] Stack trace:`, error.stack);
      }
      return false;
    }
  }

  /**
   * Get GitHub Project name from issue number
   */
  async getIssueProject(repo: string, issueNumber: number): Promise<string | null> {
    try {
      const [owner, name] = repo.split('/');
      const query = `query {
        repository(owner: "${owner}", name: "${name}") {
          issue(number: ${issueNumber}) {
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

