import inquirer from 'inquirer';
import { checkUnpushedCommitsOnCurrentBranch, createGitBranch, generateBranchName } from '../branch-utils';
import { GitHubClientWrapper } from '../github-client';
import { InputHandler } from '../input-handler';
import { LinearClientWrapper } from '../linear-client';

export async function createParentIssue() {
  const linearApiKey = process.env.LINEAR_API_KEY;
  if (!linearApiKey) {
    console.error('❌ LINEAR_API_KEY environment variable is required');
    console.error('');
    console.error('   Option 1: Create a .env file in the project root:');
    console.error('     echo "LINEAR_API_KEY=lin_api_..." > .env');
    console.error('');
    console.error('   Option 2: Export in your shell:');
    console.error('     export LINEAR_API_KEY="lin_api_..."');
    console.error('');
    console.error('   Get your API key from: https://linear.app/settings/api');
    process.exit(1);
  }

  const linearClient = new LinearClientWrapper(linearApiKey);
  
  // Step 1: Select repository
  console.log('📦 Fetching repositories...');
  const githubClient = new GitHubClientWrapper('');
  const inputHandler = new InputHandler(linearClient, githubClient);
  const repo = await inputHandler.selectRepository();
  githubClient.repo = repo;

  // Check for unpushed commits on current branch
  const unpushedCheck = checkUnpushedCommitsOnCurrentBranch();
  if (unpushedCheck.hasUnpushed) {
    console.log('\n⚠️  Warning: There are unpushed commits on the current branch.');
    console.log(`   Found ${unpushedCheck.count} unpushed commit(s):`);
    unpushedCheck.commits.forEach(commit => {
      console.log(`   - ${commit}`);
    });
    console.log('\n   If you create a branch from this state, these commits will be included in PR body.');
    console.log('   Please push commits first:');
    console.log('     git push');
    console.log('\n   Then re-run this command.');
    process.exit(1);
  } else {
    console.log('✓ No unpushed commits on current branch');
  }

  // Step 2: Get issue details
  const details = await inputHandler.promptIssueDetails(repo);

  // Step 3: Select GitHub project (optional)
  const githubProject = await inputHandler.selectProject(repo);

  // Step 4: Create GitHub issue
  console.log('\n🚀 Creating GitHub issue...');
  const issue = await githubClient.createIssue({
    repo,
    title: details.title,
    body: details.description,
    labels: details.labels,
    assignees: ['@me'],
    project: githubProject || undefined,
  });

  console.log(`✅ GitHub Issue #${issue.number} created: ${issue.url}`);

  // Set GitHub Project date fields if project is selected
  if (githubProject && (details.dueDate || details.startDate)) {
    console.log('\n📅 Setting GitHub Project date fields...');
    await githubClient.setProjectDateFields(
      repo,
      githubProject,
      issue.id,
      details.dueDate || undefined,
      details.startDate || undefined
    );
  }

  // Step 5: Wait for Linear sync, then update metadata
  const linearSyncDelayMs = 500;
  const linearSyncMaxWaitMs = 10000;
  const linearSyncMaxAttempts = Math.floor(linearSyncMaxWaitMs / linearSyncDelayMs) + 1;

  console.log('\n⏳ Waiting for Linear sync (polling for up to 10s)...');
  const linearIssueId = await linearClient.waitForIssueByGitHubUrl(issue.url, {
    maxAttempts: linearSyncMaxAttempts,
    delayMs: linearSyncDelayMs,
    onRetry: (attempt, maxAttempts, delayMs) => {
      if (attempt % 5 === 0) {
        console.log(`   ⏳ Linear issue not found yet, retrying in ${delayMs}ms... (${attempt}/${maxAttempts - 1})`);
      }
    },
  });
  if (linearIssueId) {
    console.log('✅ Found Linear issue, updating metadata...');
    
    // Auto-find Linear project if GitHub project was selected
    let linearProjectId: string | null = null;
    if (githubProject) {
      console.log(`   Looking for Linear project matching "${githubProject}"...`);
      linearProjectId = await linearClient.findProjectByName(githubProject);
      if (linearProjectId) {
        console.log(`   ✅ Found matching Linear project: ${githubProject}`);
      } else {
        console.log(`   ⚠️  No matching Linear project found. You can set it manually.`);
      }
    }
    
    // If no auto-match, ask user (only if GitHub project wasn't selected)
    if (!linearProjectId && !githubProject) {
      linearProjectId = await inputHandler.selectLinearProject();
    }
    
    // Set labels on Linear issue
    if (details.labels && details.labels.length > 0) {
      console.log(`   Setting labels: ${details.labels.join(', ')}`);
      const labelIds = await linearClient.setIssueLabels(linearIssueId, details.labels);
      if (labelIds.length > 0) {
        console.log(`   ✅ ${labelIds.length} label(s) set on Linear issue`);
      } else {
        console.log('   ⚠️  Failed to set labels. You can set them manually in Linear.');
      }
    }
    
    // Update issue metadata (due date and project, but not status)
    const success = await linearClient.updateIssueMetadata(
      linearIssueId,
      details.dueDate || undefined,
      linearProjectId || undefined
    );
    
    if (success) {
      console.log('✅ Linear issue metadata updated!');
      if (linearProjectId) {
        console.log(`   Project: ${githubProject || 'selected project'}`);
      }
      if (details.dueDate) {
        console.log(`   Due date: ${details.dueDate}`);
      }
      console.log('   Status: Will be updated automatically via PR integration');
    } else {
      console.log('⚠️  Failed to update Linear issue metadata. You can update it manually in Linear.');
    }
    
    // Step 6: Create branch
    if (linearIssueId) {
      const { createBranch } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createBranch',
          message: 'Create git branch for this issue?',
          default: true,
        },
      ]);
      
      if (createBranch) {
        // Get Linear issue identifier (e.g., LEA-123) instead of UUID
        const linearIssueIdentifier = await linearClient.getIssueIdentifier(linearIssueId);
        if (!linearIssueIdentifier) {
          console.log('⚠️  Could not get Linear issue identifier. Branch creation skipped.');
          console.log(`   Linear issue ID: ${linearIssueId}`);
          console.log(`   GitHub issue #${issue.number}`);
        } else {
          let branchOwner = await githubClient.getCurrentUsername();
          if (!branchOwner) {
            const { ownerInput } = await inquirer.prompt([
              {
                type: 'input',
                name: 'ownerInput',
                message: 'Branch username for naming (e.g., your GitHub login):',
                validate: (input: string) => input.trim().length > 0 || 'Username is required',
              },
            ]);
            branchOwner = ownerInput.trim();
          }

          const branchName = generateBranchName(branchOwner ?? 'user', linearIssueIdentifier, details.title);
          const success = await createGitBranch(branchName);
          if (success) {
            console.log(`✅ Branch created: ${branchName}`);
            console.log(`   Linear issue ID: ${linearIssueIdentifier}`);
            console.log(`   GitHub issue #${issue.number}`);
          }
        }
      }
    }
  } else {
    console.log('⚠️  Linear issue not found yet. Metadata will be set by GitHub Actions.');
  }

  console.log('\n💡 Next steps:');
  console.log(`   Create sub-issues: lg create-sub`);
  console.log(`   Then select issue #${issue.number}`);
}

