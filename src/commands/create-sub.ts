import inquirer from 'inquirer';
import { createGitBranch, generateBranchName } from '../branch-utils';
import { GitHubClientWrapper } from '../github-client';
import { InputHandler } from '../input-handler';
import { LinearClientWrapper } from '../linear-client';

export async function createSubIssue() {
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
  const githubClient = new GitHubClientWrapper('');
  const inputHandler = new InputHandler(linearClient, githubClient);

  // Step 1: Select repository
  console.log('📦 Fetching repositories...');
  const repo = await inputHandler.selectRepository();
  githubClient.repo = repo;

  // Step 2: Select parent issue
  console.log('\n📋 Fetching issues...');
  const parentIssueNumber = await inputHandler.selectParentIssue(repo);

  // Step 3: Get sub-issue details
  const details = await inputHandler.promptIssueDetails(repo);

  // Step 4: Create sub-issue
  console.log('\n🚀 Creating sub-issue...');
  const subIssue = await githubClient.createSubIssue({
    repo,
    parentIssueNumber,
    title: details.title,
    body: details.description,
    labels: details.labels,
    assignees: ['@me'],
  });

  console.log(`✅ Sub-Issue #${subIssue.number} created: ${subIssue.url}`);
  console.log(`   Parent: #${parentIssueNumber}`);

  // Set GitHub Project date fields using the parent issue's GitHub Project
  // (independent of Linear sync, so dates are written even if Linear is slow)
  if (details.dueDate || details.startDate) {
    console.log('\n📅 Setting GitHub Project date fields...');
    const parentGitHubProject = await githubClient.getIssueProject(repo, parentIssueNumber);
    if (parentGitHubProject) {
      console.log(`   Using parent issue's GitHub Project: ${parentGitHubProject}`);
      await githubClient.setProjectDateFields(
        repo,
        parentGitHubProject,
        subIssue.id,
        details.dueDate || undefined,
        details.startDate || undefined
      );
    } else {
      console.log(`   ⚠️  Parent issue #${parentIssueNumber} is not in any GitHub Project. Skipping date fields.`);
    }
  }

  // Step 5: Wait for Linear sync, then update metadata
  const linearSyncDelayMs = 500;
  const linearSyncMaxWaitMs = 10000;
  const linearSyncMaxAttempts = Math.floor(linearSyncMaxWaitMs / linearSyncDelayMs) + 1;

  console.log('\n⏳ Waiting for Linear sync (polling for up to 10s)...');
  const linearIssueId = await linearClient.waitForIssueByGitHubUrl(subIssue.url, {
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
    
    // Get parent issue to check if it has a project
    const parentIssueUrl = `https://github.com/${repo}/issues/${parentIssueNumber}`;
    console.log(`   Looking for parent issue's Linear project...`);
    const parentLinearIssueId = await linearClient.waitForIssueByGitHubUrl(parentIssueUrl, {
      maxAttempts: 6,
      delayMs: 500,
      onRetry: (attempt, maxAttempts, delayMs) => {
        if (attempt % 3 === 0) {
          console.log(`   ⏳ Parent Linear issue not found yet, retrying in ${delayMs}ms... (${attempt}/${maxAttempts - 1})`);
        }
      },
    });
    
    let linearProjectId: string | null = null;
    let parentProjectName: string | null = null;
    
    if (parentLinearIssueId) {
      console.log(`   ✅ Found parent Linear issue: ${parentLinearIssueId}`);
      // Try to get parent issue's project
      const parentProject = await linearClient.getIssueProject(parentLinearIssueId);
      if (parentProject) {
        linearProjectId = parentProject.id;
        parentProjectName = parentProject.name;
        console.log(`   ✅ Found parent issue's project: ${parentProjectName}`);
      } else {
        console.log(`   ⚠️  Parent issue has no project set`);
      }
    } else {
      console.log(`   ⚠️  Parent Linear issue not found yet (may need more time to sync)`);
    }
    
    // If no parent project, leave project unset (no prompt)
    
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
        if (parentProjectName) {
          console.log(`   Project: ${parentProjectName} (inherited from parent)`);
        } else {
          console.log(`   Project: linked`);
        }
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
          console.log(`   GitHub issue #${subIssue.number}`);
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
            console.log(`   GitHub issue #${subIssue.number}`);
          }
        }
      }
    }
  } else {
    console.log('⚠️  Linear issue not found yet. Metadata will be set by GitHub Actions.');
  }
}

