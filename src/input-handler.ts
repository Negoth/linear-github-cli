import { execSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import { join } from 'path';
import readline from 'readline';
import { GitHubClientWrapper } from './github-client';
import { LinearClientWrapper } from './linear-client';
import { tmpdir } from 'os';

const isValidDateYmd = (input: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;

  const [year, month, day] = input.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const WAIT_FLAG_EDITORS: Record<string, string> = {
  code: '--wait',
  'code-insiders': '--wait',
  cursor: '--wait',
  'cursor-insiders': '--wait',
  subl: '-w',
  sublime_text: '-w',
  atom: '--wait',
};

const hasWaitFlag = (command: string): boolean =>
  /\s--wait\b/.test(command) || /\s-w\b/.test(command);

const resolveEditorCommand = (): string => {
  const envEditor = process.env.LG_EDITOR || process.env.VISUAL || process.env.EDITOR;
  const base = (envEditor && envEditor.trim().length > 0 ? envEditor : 'vim').trim();
  const binary = base.split(/\s+/)[0];
  const waitFlag = WAIT_FLAG_EDITORS[binary];

  if (waitFlag && !hasWaitFlag(base)) {
    return `${base} ${waitFlag}`;
  }

  return base;
};

const openEditorForText = (editorCommand: string, initialText = ''): string => {
  const tempDir = mkdtempSync(join(tmpdir(), 'lg-editor-'));
  const tempFilePath = join(tempDir, 'issue-body.md');
  try {
    writeFileSync(tempFilePath, initialText, 'utf-8');
    const quotedPath = `"${tempFilePath.replace(/"/g, '\\"')}"`;
    const command = `${editorCommand} ${quotedPath}`;
    const result = spawnSync(command, { stdio: 'inherit', shell: true });
    if (result.error) {
      throw result.error;
    }
    return readFileSync(tempFilePath, 'utf-8');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

const promptDescriptionAction = async (): Promise<'edit' | 'skip'> => {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    return 'skip';
  }

  stdout.write('Body [press e to launch editor, Enter to skip]: ');
  const rl = readline.createInterface({ input: stdin, output: stdout });
  readline.emitKeypressEvents(stdin, rl);

  if (typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
  }
  stdin.resume();

  return new Promise(resolve => {
    const cleanup = () => {
      stdin.removeListener('keypress', onKeypress);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
      rl.close();
    };

    const onKeypress = (_: string, key: readline.Key) => {
      const keyName = key?.name ?? '';
      const keySeq = key?.sequence ?? '';

      if (key?.ctrl && keyName === 'c') {
        stdout.write('\n');
        cleanup();
        process.exit(130);
      }

      if (keyName === 'return' || keySeq === '\r') {
        stdout.write('\n');
        cleanup();
        resolve('skip');
        return;
      }

      if (keyName.toLowerCase() === 'e' || keySeq.toLowerCase() === 'e') {
        stdout.write('\n');
        cleanup();
        resolve('edit');
      }
    };

    stdin.on('keypress', onKeypress);
  });
};

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

    const baseAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Issue title (required):',
        validate: (input: string) => input.length > 0 || 'Title is required',
      },
    ]);

    let description = '';
    const descriptionAction = await promptDescriptionAction();
    if (descriptionAction === 'edit') {
      const editorCommand = resolveEditorCommand();
      try {
        description = openEditorForText(editorCommand).trimEnd();
      } catch (error) {
        console.error('\n⚠️  Failed to open editor for issue description.');
        console.error(`   Editor command: ${editorCommand}`);
        console.error('   Tip: set $EDITOR or $VISUAL to a terminal editor (e.g. "vim")');
        console.error('   or a GUI editor with wait flag (e.g. "code --wait").\n');
        const { description: fallbackDescription } = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Issue description (single line or paste text):',
          },
        ]);
        description = fallbackDescription || '';
      }
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'startDate',
        message: 'Start date (YYYY-MM-DD, optional):',
        validate: (input: string) => {
          if (!input) return true; // Optional
          return isValidDateYmd(input) || 'Invalid date format';
        },
      },
      {
        type: 'input',
        name: 'dueDate',
        message: 'Due date (YYYY-MM-DD, required):',
        validate: (input: string) => {
          if (!input) return 'Due date is required';
          return isValidDateYmd(input) || 'Invalid date format';
        },
      },
      {
        type: 'checkbox',
        name: 'labels',
        message: 'Select GitHub labels (optional):',
        choices: labelChoices,
      },
    ]);

    return {
      title: baseAnswers.title,
      description,
      dueDate: answers.dueDate || '',
      startDate: answers.startDate || '',
      labels: answers.labels || [],
    };
  }
}

