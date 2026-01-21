import { LinearClient } from '@linear/sdk';

// Store API key for direct GraphQL calls
let linearApiKey: string = '';

export class LinearClientWrapper {
  private client: LinearClient;

  constructor(apiKey: string) {
    linearApiKey = apiKey;
    this.client = new LinearClient({ apiKey });
  }

  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    const projects = await this.client.projects();
    return projects.nodes.map(p => ({ id: p.id, name: p.name }));
  }

  async findProjectByName(projectName: string): Promise<string | null> {
    try {
      const projects = await this.client.projects({
        filter: { name: { eq: projectName } }
      });
      return projects.nodes[0]?.id || null;
    } catch (error) {
      // Fallback: get all projects and search manually
      const allProjects = await this.getProjects();
      const project = allProjects.find(p => p.name === projectName);
      return project?.id || null;
    }
  }

  async getWorkflowStates(teamId?: string): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      // Get workflow states from teams
      let teamList;
      if (teamId) {
        // If a teamId is provided, fetch the single team and wrap in an array
        const singleTeam = await this.client.team(teamId);
        teamList = [singleTeam];
      } else {
        // Otherwise, fetch all teams and use the nodes property from TeamConnection
        const teamsConnection = await this.client.teams();
        teamList = teamsConnection.nodes;
      }

      if (!teamList || teamList.length === 0) {
        return [];
      }

      // Get workflow states from the first team
      const team = Array.isArray(teamList) ? teamList[0] : teamList;
      if (!team) {
        return [];
      }

      // Use GraphQL to get workflow states
      const query = `query GetWorkflowStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }`;

      const teamIdValue = typeof team === 'object' && 'id' in team ? team.id : teamId || '';
      
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': linearApiKey,
        },
        body: JSON.stringify({
          query,
          variables: { teamId: teamIdValue },
        }),
      });

      const result = await response.json();
      
      if (result.errors || !result.data?.team?.states) {
        return [];
      }

      return result.data.team.states.nodes.map((s: { id: string; name: string; type: string }) => ({
        id: s.id,
        name: s.name,
        type: s.type,
      }));
    } catch (error) {
      console.error('Error fetching workflow states:', error);
      return [];
    }
  }

  async findOrCreateLabel(teamId: string, labelName: string): Promise<string | null> {
    try {
      // First, try to find existing label
      const labels = await this.getLabels(teamId);
      const existingLabel = labels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
      if (existingLabel) {
        return existingLabel.id;
      }

      // If not found, create a new label
      const mutation = `mutation CreateLabel($teamId: String!, $name: String!) {
        issueLabelCreate(input: {
          teamId: $teamId
          name: $name
        }) {
          success
          issueLabel { id }
        }
      }`;

      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': linearApiKey,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { teamId, name: labelName },
        }),
      });

      const result = await response.json();
      
      if (result.errors || !result.data?.issueLabelCreate?.success) {
        console.error(`❌ Failed to create label "${labelName}":`, result.errors);
        return null;
      }

      return result.data.issueLabelCreate.issueLabel.id;
    } catch (error) {
      console.error(`❌ Error finding/creating label "${labelName}":`, error);
      return null;
    }
  }

  async getIssueTeamId(issueId: string): Promise<string | null> {
    try {
      const issue = await this.client.issue(issueId);
      const team = await issue.team;
      return team?.id || null;
    } catch (error) {
      console.error('❌ Error getting issue team:', error);
      return null;
    }
  }

  async getIssueProjectId(issueId: string): Promise<string | null> {
    try {
      const issue = await this.client.issue(issueId);
      const project = await issue.project;
      return project?.id || null;
    } catch (error) {
      // Silently fail - project might not be set
      return null;
    }
  }

  async getIssueProject(issueId: string): Promise<{ id: string; name: string } | null> {
    try {
      const issue = await this.client.issue(issueId);
      const project = await issue.project;
      if (project) {
        const name = await project.name;
        return { id: project.id, name };
      }
      return null;
    } catch (error) {
      // Silently fail - project might not be set
      return null;
    }
  }

  async getTeams(): Promise<Array<{ id: string; name: string; key: string }>> {
    const teams = await this.client.teams();
    return teams.nodes.map(t => ({ id: t.id, name: t.name, key: t.key }));
  }

  async getLabels(teamId: string): Promise<Array<{ id: string; name: string }>> {
    const team = await this.client.team(teamId);
    const labels = await team?.labels();
    return labels?.nodes.map(l => ({ id: l.id, name: l.name })) || [];
  }

  async findIssueByGitHubUrl(githubUrl: string): Promise<string | null> {
    const issues = await this.client.issues({
      filter: {
        attachments: { url: { contains: githubUrl } }
      }
    });
    return issues.nodes[0]?.id || null;
  }

  async waitForIssueByGitHubUrl(
    githubUrl: string,
    options: {
      maxAttempts?: number;
      delayMs?: number;
      onRetry?: (attempt: number, maxAttempts: number, delayMs: number) => void;
    } = {}
  ): Promise<string | null> {
    const delayMs = options.delayMs ?? 5000;
    const maxAttempts = options.maxAttempts;

    for (let attempt = 1; ; attempt++) {
      const issueId = await this.findIssueByGitHubUrl(githubUrl);
      if (issueId) {
        return issueId;
      }

      if (maxAttempts !== undefined && attempt >= maxAttempts) {
        return null;
      }

      options.onRetry?.(attempt, maxAttempts ?? Number.POSITIVE_INFINITY, delayMs);
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  async getIssueIdentifier(issueId: string): Promise<string | null> {
    try {
      const issue = await this.client.issue(issueId);
      if (!issue) {
        return null;
      }
      const identifier = await issue.identifier;
      return identifier || null;
    } catch (error) {
      console.error('❌ Error getting Linear issue identifier:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Finds Linear issue by identifier (e.g., 'LEA-123') and returns its ID
   * Uses GraphQL query to find issue by identifier
   * @param identifier - Linear issue identifier (e.g., 'LEA-123')
   * @returns Linear issue ID or null if not found
   */
  async findIssueByIdentifier(identifier: string): Promise<string | null> {
    try {
      // Extract team key and number from identifier (e.g., 'LEA-123' -> team: 'LEA', number: 123)
      const match = identifier.match(/([A-Z]+)-(\d+)/);
      if (!match) {
        return null;
      }
      
      const teamKey = match[1];
      const issueNumber = parseInt(match[2], 10);
      
      // Get team ID first
      const teamQuery = `query GetTeam($key: String!) {
        teams(filter: { key: { eq: $key } }) {
          nodes {
            id
          }
        }
      }`;
      
      const teamResponse = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': linearApiKey,
        },
        body: JSON.stringify({
          query: teamQuery,
          variables: { key: teamKey },
        }),
      });
      
      const teamResult = await teamResponse.json();
      
      if (teamResult.errors || !teamResult.data?.teams?.nodes?.length) {
        console.error(`❌ Team '${teamKey}' not found`);
        return null;
      }
      
      const teamId = teamResult.data.teams.nodes[0].id;
      
      // Now query issue by team ID and number
      const issueQuery = `query GetIssue($teamId: ID!, $number: Float!) {
        issues(
          filter: {
            team: { id: { eq: $teamId } }
            number: { eq: $number }
          }
        ) {
          nodes {
            id
          }
        }
      }`;
      
      const issueResponse = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': linearApiKey,
        },
        body: JSON.stringify({
          query: issueQuery,
          variables: { teamId, number: issueNumber },
        }),
      });
      
      const issueResult = await issueResponse.json();
      
      if (issueResult.errors) {
        console.error('❌ Linear GraphQL errors:', JSON.stringify(issueResult.errors, null, 2));
        return null;
      }
      
      if (!issueResult.data?.issues?.nodes?.length) {
        console.error(`❌ Issue ${identifier} not found`);
        return null;
      }
      
      return issueResult.data.issues.nodes[0].id || null;
    } catch (error) {
      console.error('❌ Error finding Linear issue by identifier:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Gets Linear issue title by identifier (e.g., 'LEA-123')
   * @param identifier - Linear issue identifier (e.g., 'LEA-123')
   * @returns Issue title or null if not found
   */
  async getIssueTitle(identifier: string): Promise<string | null> {
    try {
      const issueId = await this.findIssueByIdentifier(identifier);
      if (!issueId) {
        // Error message already logged in findIssueByIdentifier
        return null;
      }
      
      const issue = await this.client.issue(issueId);
      if (!issue) {
        console.error(`❌ Linear issue ${identifier} (ID: ${issueId}) not found after lookup`);
        return null;
      }
      
      const title = await issue.title;
      if (!title) {
        console.error(`❌ Linear issue ${identifier} has no title`);
        return null;
      }
      
      return title;
    } catch (error) {
      console.error('❌ Error getting Linear issue title:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Gets GitHub issue number from Linear issue attachments
   * Linear SDK/APIにはGitHub issue番号を直接取得する専用フィールドはないため、
   * attachmentsからGitHub issue URLを取得してパースする必要がある
   * @param identifier - Linear issue identifier (e.g., 'LEA-123')
   * @returns GitHub issue number or null if not found
   */
  async getGitHubIssueNumber(identifier: string): Promise<number | null> {
    try {
      const issueId = await this.findIssueByIdentifier(identifier);
      if (!issueId) {
        return null;
      }
      
      const issue = await this.client.issue(issueId);
      if (!issue) {
        return null;
      }
      
      // Get attachments from the issue
      const attachments = await issue.attachments();
      
      // Look for GitHub issue URL in attachments
      // Pattern: https://github.com/owner/repo/issues/123
      const githubIssueUrlPattern = /https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/;
      
      for (const attachment of attachments.nodes) {
        const url = await attachment.url;
        if (url) {
          const match = url.match(githubIssueUrlPattern);
          if (match && match[1]) {
            return parseInt(match[1], 10);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting GitHub issue number:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async updateIssueMetadata(
    issueId: string,
    dueDate?: string,
    projectId?: string,
    labelIds?: string[]
  ): Promise<boolean> {
    try {
      // Get the issue first to verify it exists
      const issue = await this.client.issue(issueId);
      if (!issue) {
        console.error('❌ Linear issue not found');
        return false;
      }

      // Build update input
      const updateInput: any = {};
      if (dueDate) {
        updateInput.dueDate = new Date(dueDate);
      }
      if (projectId) {
        updateInput.projectId = projectId;
      }
      if (labelIds && labelIds.length > 0) {
        updateInput.labelIds = labelIds;
      }

      // Use GraphQL API directly via fetch
      const mutation = `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue { id }
        }
      }`;

      const variables: any = {
        id: issueId,
        input: updateInput,
      };

      // Use Linear's GraphQL endpoint directly
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': linearApiKey,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error('❌ Linear API error:', result.errors);
        return false;
      }

      return result.data?.issueUpdate?.success || false;
    } catch (error) {
      console.error('❌ Error updating Linear issue:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async setIssueLabels(issueId: string, labelNames: string[]): Promise<string[]> {
    try {
      // Get team ID from issue
      const teamId = await this.getIssueTeamId(issueId);
      if (!teamId) {
        console.error('❌ Could not determine team for issue');
        return [];
      }

      // Find or create labels and collect their IDs
      const labelIds: string[] = [];
      for (const labelName of labelNames) {
        const labelId = await this.findOrCreateLabel(teamId, labelName);
        if (labelId) {
          labelIds.push(labelId);
        }
      }

      // Update issue with labels
      if (labelIds.length > 0) {
        const success = await this.updateIssueMetadata(issueId, undefined, undefined, labelIds);
        if (success) {
          return labelIds;
        }
      }

      return [];
    } catch (error) {
      console.error('❌ Error setting issue labels:', error instanceof Error ? error.message : error);
      return [];
    }
  }
}

