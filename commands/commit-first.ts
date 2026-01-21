import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { extractBranchPrefix, extractLinearIssueId } from '../branch-utils';
import { LinearClientWrapper } from '../linear-client';
import { loadEnvFile } from '../env-utils';

// Load .env file from current working directory, parent directories, or home directory
loadEnvFile();

/**
 * Creates the first commit with proper message format
 * - Extracts branch prefix (commit type) and Linear issue ID from current branch name
 * - Fetches Linear issue title and GitHub issue number
 * - Generates commit message: "{prefix}: {linearId} {title}" with body "solve: #{githubIssueNumber}"
 */
export async function commitFirst() {
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

  try {
    // Step 1: Get current branch name
    let branchName: string;
    try {
      branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch (error) {
      console.error('❌ Error: Not in a git repository or unable to get branch name');
      process.exit(1);
    }

    // Step 2: Extract branch prefix (if any) and Linear issue ID from branch name
    let prefix = extractBranchPrefix(branchName);
    const linearId = extractLinearIssueId(branchName);
    if (!linearId) {
      console.error(`❌ Error: Could not extract Linear issue ID from branch name: ${branchName}`);
      console.error('   Branch name should follow pattern: username/LEA-123-title');
      process.exit(1);
    }

    if (!prefix) {
      const { selectedPrefix } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedPrefix',
          message: 'Select commit type:',
          choices: ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'research'],
        },
      ]);
      prefix = selectedPrefix;
    }

    console.log(`📋 Found Linear issue ID: ${linearId}`);
    console.log(`📋 Using commit type: ${prefix}`);

    // Step 3: Initialize Linear client and fetch issue data
    const linearClient = new LinearClientWrapper(linearApiKey);
    
    console.log('🔍 Fetching Linear issue title...');
    const title = await linearClient.getIssueTitle(linearId);
    if (!title) {
      console.error(`❌ Error: Linear issue ${linearId} not found`);
      process.exit(1);
    }

    console.log('🔍 Fetching GitHub issue number...');
    const githubIssueNumber = await linearClient.getGitHubIssueNumber(linearId);
    if (!githubIssueNumber) {
      console.error(`❌ Error: GitHub issue number not found for Linear issue ${linearId}`);
      console.error('   Make sure the Linear issue is linked to a GitHub issue');
      process.exit(1);
    }

    // Step 4: Generate commit message
    const commitTitle = `${prefix}: ${linearId} ${title}`;
    const commitBody = `solve: #${githubIssueNumber}`;

    console.log('\n📝 Commit message:');
    console.log(`   ${commitTitle}`);
    console.log(`   ${commitBody}\n`);

    // Step 5: Execute commit
    try {
      execSync(
        `git commit --allow-empty -m "${commitTitle.replace(/"/g, '\\"')}" -m "${commitBody.replace(/"/g, '\\"')}"`,
        { stdio: 'inherit' }
      );
      console.log('✅ Commit created successfully!');
    } catch (error) {
      console.error('❌ Error: Failed to create commit');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

