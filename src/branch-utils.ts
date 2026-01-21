import { execSync } from 'child_process';
/**
 * Valid branch prefix types (must match commit_typed.sh)
 */
const VALID_BRANCH_PREFIXES = ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'research'];

/**
 * Sanitizes a title string to be used as part of a git branch name
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes special characters (keeps alphanumeric and hyphens)
 * - Removes leading/trailing hyphens
 * - Collapses multiple consecutive hyphens
 * - Limits length to 50 characters
 * 
 * @param title - The title to sanitize
 * @returns Sanitized branch name portion
 */
export function sanitizeBranchName(title: string): string {
  if (!title || title.trim().length === 0) {
    return '';
  }
  
  // Convert to lowercase and replace spaces with hyphens
  let sanitized = title.toLowerCase().replace(/\s+/g, '-');
  
  // Remove special characters except hyphens and alphanumeric
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '');
  
  // Collapse multiple consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');
  
  // Remove leading and trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');
  
  // Limit length to 50 characters
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50);
    // Remove trailing hyphen if truncated
    sanitized = sanitized.replace(/-+$/, '');
  }
  
  return sanitized;
}

/**
 * Sanitizes a branch owner (username) to be used in a git branch name.
 * - Converts to lowercase
 * - Removes special characters (keeps alphanumeric and hyphens)
 * - Collapses multiple consecutive hyphens
 * - Removes leading/trailing hyphens
 * 
 * @param owner - The branch owner to sanitize
 * @returns Sanitized branch owner portion
 */
function sanitizeBranchOwner(owner: string): string {
  if (!owner || owner.trim().length === 0) {
    return '';
  }
  
  let sanitized = owner.toLowerCase().replace(/[^a-z0-9-]/g, '');
  sanitized = sanitized.replace(/-+/g, '-');
  sanitized = sanitized.replace(/^-+|-+$/g, '');
  
  return sanitized;
}

/**
 * Generates a branch name from owner, Linear ID, and title
 * Format: owner/LinearID-sanitized-title
 * 
 * @param owner - Branch owner (e.g., GitHub username)
 * @param linearId - Linear issue ID (e.g., 'LEA-123')
 * @param title - Issue title to sanitize
 * @returns Full branch name
 */
export function generateBranchName(owner: string, linearId: string, title: string): string {
  const sanitizedOwner = sanitizeBranchOwner(owner);
  const sanitizedTitle = sanitizeBranchName(title);
  const ownerSegment = sanitizedOwner || 'user';
  
  if (!sanitizedTitle) {
    // If title is empty after sanitization, just use owner and ID
    return `${ownerSegment}/${linearId}`;
  }
  
  return `${ownerSegment}/${linearId}-${sanitizedTitle}`;
}

/**
 * Extracts Linear issue ID from a branch name
 * - Matches pattern: owner/LEA-123-title or owner/LEA-123
 * - Uses regex to find Linear issue ID format: [A-Z]+-\d+
 * 
 * @param branchName - Branch name (e.g., 'negoth/LEA-123-implement-login')
 * @returns Linear issue ID (e.g., 'LEA-123') or null if not found
 */
export function extractLinearIssueId(branchName: string): string | null {
  if (!branchName || branchName.trim().length === 0) {
    return null;
  }
  
  // Match Linear issue ID pattern: [A-Z]+-\d+ (e.g., LEA-123)
  const match = branchName.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Extracts branch prefix (commit type) from a branch name
 * - Extracts the part before the first '/' (e.g., 'research' from 'research/LEA-75-probit-model')
 * - Validates against VALID_BRANCH_PREFIXES
 * 
 * @param branchName - Branch name (e.g., 'research/LEA-75-probit-model')
 * @returns Branch prefix (e.g., 'research') or null if not found/invalid
 */
export function extractBranchPrefix(branchName: string): string | null {
  if (!branchName || branchName.trim().length === 0) {
    return null;
  }
  
  // Extract prefix before first '/'
  const parts = branchName.split('/');
  if (parts.length === 0 || !parts[0]) {
    return null;
  }
  
  const prefix = parts[0].toLowerCase();
  
  // Validate against valid prefixes
  if (VALID_BRANCH_PREFIXES.includes(prefix)) {
    return prefix;
  }
  
  return null;
}

/**
 * Checks for unpushed commits on the current branch
 * - Gets current branch name
 * - Checks if remote branch exists
 * - Counts unpushed commits
 * - Returns information about unpushed commits
 * 
 * @returns Object with hasUnpushed flag, count, and commit list
 */
export function checkUnpushedCommitsOnCurrentBranch(): { hasUnpushed: boolean; count: number; commits: string[] } {
  try {
    // Check if we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    } catch (error) {
      // Not in a git repository, return no unpushed commits
      return { hasUnpushed: false, count: 0, commits: [] };
    }

    // Get current branch
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    if (!currentBranch) {
      return { hasUnpushed: false, count: 0, commits: [] };
    }

    // Check if remote branch exists
    try {
      execSync(`git rev-parse --verify origin/${currentBranch}`, { stdio: 'pipe' });
    } catch (error) {
      // Remote branch doesn't exist, no unpushed commits
      return { hasUnpushed: false, count: 0, commits: [] };
    }

    // Count unpushed commits
    const countOutput = execSync(
      `git rev-list --count origin/${currentBranch}..${currentBranch}`,
      { encoding: 'utf-8' }
    ).trim();
    const count = parseInt(countOutput, 10) || 0;

    if (count === 0) {
      return { hasUnpushed: false, count: 0, commits: [] };
    }

    // Get commit list
    const commitsOutput = execSync(
      `git log origin/${currentBranch}..${currentBranch} --oneline`,
      { encoding: 'utf-8' }
    ).trim();
    const commits = commitsOutput ? commitsOutput.split('\n') : [];

    return { hasUnpushed: true, count, commits };
  } catch (error) {
    // On error, assume no unpushed commits to avoid blocking workflow
    return { hasUnpushed: false, count: 0, commits: [] };
  }
}

/**
 * Creates a git branch and switches to it
 * - Checks if in git repository
 * - Checks if branch already exists
 * - Creates branch using 'git switch -c'
 * 
 * @param branchName - Name of the branch to create
 * @returns true if successful, false otherwise
 */
export async function createGitBranch(branchName: string): Promise<boolean> {
  try {
    // Check if we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  Not in a git repository. Branch creation skipped.');
      return false;
    }
    
    // Check if branch already exists
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'pipe' });
      console.log(`⚠️  Branch '${branchName}' already exists. Branch creation skipped.`);
      return false;
    } catch (error) {
      // Branch doesn't exist, which is what we want
    }
    
    // Create and switch to branch
    execSync(`git switch -c ${branchName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Failed to create branch '${branchName}':`, error instanceof Error ? error.message : error);
    return false;
  }
}

