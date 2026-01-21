import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { GitHubClientWrapper } from './github-client';
import { LinearClientWrapper } from './linear-client';

export class InputHandler {
  constructor(
    private linearClient: LinearClientWrapper,
    private githubClient: GitHubClientWrapper
  ) {}

  async selectRepository(): Promise<string> {
    const repos = await this.githubClient.getRepositories();
    const { repo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'repo',
        message: 'Select repository:',
        choices: repos.map(r => ({
          name: `${r.fullName}`,
          value: r.fullName,
        })),
        pageSize: 20,
      },
    ]);
    return repo;
  }

  async selectProject(repo: string): Promise<string | null> {
    try {
      const projects = await this.githubClient.getProjects(repo);
      if (projects.length === 0) {
        // No projects available
        return null;
      }

      const { project } = await inquirer.prompt([
        {
          type: 'list',
          name: 'project',
          message: 'Select GitHub Project (or skip):',
          choices: [
            { name: 'Skip', value: null },
            ...projects.map(p => ({ name: p.name, value: p.name })),
          ],
        },
      ]);
      return project;
    } catch (error: any) {
      const errorMessage = error.message || error.stderr || String(error);
      
      // Check if it's an authentication error
      if (errorMessage.includes('authentication token') || errorMessage.includes('required scopes')) {
        console.error('\n❌ GitHub authentication token missing required scopes for projects.');
        console.error('   Required scope: read:project');
        console.error('\n   To fix:');
        console.error('   Run: gh auth refresh -s read:project\n');
      } else {
        console.error('\n❌ Failed to fetch GitHub projects.');
        console.error(`   Error: ${errorMessage}\n`);
      }
      
      // Ask user if they want to proceed without selecting a project
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to continue without selecting a project?',
          default: true,
        },
      ]);
      
      if (!proceed) {
        console.log('Cancelled. Please fix the issue and try again.');
        process.exit(1);
      }
      
      return null;
    }
  }

  async selectLinearProject(): Promise<string | null> {
    const projects = await this.linearClient.getProjects();
    if (projects.length === 0) {
      return null;
    }

    const { project } = await inquirer.prompt([
      {
        type: 'list',
        name: 'project',
        message: 'Select Linear Project (or skip):',
        choices: [
          { name: 'Skip', value: null },
          ...projects.map(p => ({ name: p.name, value: p.id })),
        ],
      },
    ]);
    return project;
  }

  async selectParentIssue(repo: string): Promise<number> {
    // Fetch recent issues
    const output = execSync(
      `gh issue list --repo ${repo} --limit 50 --json number,title,state`,
      { encoding: 'utf-8' }
    );
    const issues = JSON.parse(output);

    const { issueNumber } = await inquirer.prompt([
      {
        type: 'list',
        name: 'issueNumber',
        message: 'Select parent issue:',
        choices: issues.map((i: { number: number; title: string; state: string }) => ({
          name: `#${i.number}: ${i.title} [${i.state}]`,
          value: i.number,
        })),
      },
    ]);
    return issueNumber;
  }

  async promptIssueDetails(repo?: string): Promise<{
    title: string;
    description: string;
    dueDate: string;
    startDate: string;
    labels: string[];
  }> {
    // Fetch labels from GitHub repository if repo is provided
    let labelChoices: string[] = [];
    if (repo) {
      try {
        console.log('📋 Fetching labels from GitHub...');
        labelChoices = await this.githubClient.getLabels(repo);
      } catch (error) {
        // Fallback to default labels if fetch fails
        labelChoices = [
          'feat',
          'fix',
          'chore',
          'docs',
          'refactor',
          'test',
          'research',
        ];
      }
    } else {
      // Fallback to default labels if no repo provided
      labelChoices = [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'research',
      ];
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Issue title (required):',
        validate: (input: string) => input.length > 0 || 'Title is required',
      },
      {
        type: 'input',
        name: 'descriptionAction',
        message: 'Body [(e) to launch vim, enter to skip]:',
        validate: (input: string) => {
          const value = input.trim().toLowerCase();
          return value === '' || value === 'e' || 'Enter "e" to edit or press enter to skip';
        },
      },
      {
        type: 'input',
        name: 'startDate',
        message: 'Start date (YYYY-MM-DD, optional):',
        validate: (input: string) => {
          if (!input) return true; // Optional
          const date = new Date(input);
          return !isNaN(date.getTime()) || 'Invalid date format';
        },
      },
      {
        type: 'input',
        name: 'dueDate',
        message: 'Due date (YYYY-MM-DD, required):',
        validate: (input: string) => {
          if (!input) return 'Due date is required';
          const date = new Date(input);
          return !isNaN(date.getTime()) || 'Invalid date format';
        },
      },
      {
        type: 'checkbox',
        name: 'labels',
        message: 'Select GitHub labels (optional):',
        choices: labelChoices,
      },
    ]);

    let description = '';
    if (answers.descriptionAction.trim().toLowerCase() === 'e') {
      const { description: editedDescription } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'description',
          message: 'Issue description:',
        },
      ]);
      description = editedDescription || '';
    }

    return {
      title: answers.title,
      description,
      dueDate: answers.dueDate || '',
      startDate: answers.startDate || '',
      labels: answers.labels || [],
    };
  }
}

