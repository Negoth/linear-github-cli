# Linear-GitHub Integration Workflow with Draft PRs

## Overview

A workflow that leverages Linear's automatic status updates by creating draft PRs early, then marking them ready when work begins. This approach provides better visibility and progress tracking throughout the development cycle.

### Linear Automatic Status Update Mechanism

Linear's GitHub integration automatically updates issue status based on PR/commit events:

- **On draft PR open** → `Todo` (initial state)
- **On PR open (ready)** → `In Progress` (triggered by `gh pr ready`)
- **On PR review request** → Configurable (default: no change)
- **On PR ready for merge** → Configurable (default: no change)
- **On PR merge** → `Done` (automatic)

**Key Point:** The workflow uses draft PRs to track tasks before work begins, then transitions to ready PRs when work starts.

### Linking PRs to Issues

Include the issue number in the PR body using one of these formats:

- `Closes #123` - Closes GitHub issue on PR merge (recommended for completion)
- `Fixes #123` - For bug fixes (closes GitHub issue on PR merge)
- `Resolves #123` - For issue resolution (closes GitHub issue on PR merge)
- `solve: #123` - Alternative format (closes GitHub issue on PR merge)
- `Ref: #123` - Related issue (does NOT close, keeps as work history)

Linear automatically detects related issues by parsing the PR body.

**Important:** Include the Linear issue ID in the PR title (copy with `Cmd + .` in Linear issue view).

## Recommended Approach: Aliases

**Why aliases over shell functions:**

1. **Simplicity** - Uses standard `gh` CLI features
2. **Low maintenance** - No custom scripts to maintain
3. **Easy setup** - Simple configuration
4. **Sufficient** - Covers most use cases

**When to use shell functions instead:**

- Need branch name auto-extraction
- Complex logic requirements
- Multiple PR creation patterns

For most cases, aliases are sufficient and easier to manage.

## Implementation: Aliases

### Basic Aliases

```bash
# Create draft PR with issue number
gh alias set prd 'pr create --draft --title "$1" --body "solve: #$2"'

# Create draft PR with fill (auto-filled) - USE prdf FUNCTION INSTEAD
# See "Preventing Unpushed Commits in PR Body" section for setup
# gh alias set prdf 'pr create --draft --fill'  # Don't use gh alias, use prdf function instead

# Create ready PR (non-draft)
gh alias set prr 'pr create --title "$1" --body "solve: #$2"'

# Merge PR with squash and delete branch
gh alias set prms 'pr merge --squash --delete-branch'
```

**Usage Examples:**

```bash
# Create draft PR (auto-filled from commit/branch)
# Use prdf function (not gh prdf) - see setup instructions below
prdf

# Create draft PR with explicit title and issue number
gh prd "LEA-123 Implement login feature" 123

# Mark draft PR as ready (triggers Linear: In Progress)
gh pr ready

# Create ready PR directly
gh prr "LEA-123 Implement login feature" 123

# Merge PR (squash and delete branch)
gh prms
```

**Setup prdf function:**
```bash
# Run setup script to add prdf function to your shell config
bash setup-prdf.sh
source ~/.zshrc  # or source ~/.bashrc
```

### Alternative: Using `gh pr create --fill`

The simplest approach is to use `gh pr create --fill` which automatically fills PR fields from commit messages and branch names:

```bash
# Create draft PR (auto-filled from commit/branch)
gh pr create --draft --fill

# Create ready PR (auto-filled from commit/branch)
gh pr create --fill
```

For interactive input, use `gh pr create` without `--fill`:
- Enter PR title (include Linear issue ID)
- Edit PR body (include `solve: #123` or `Closes #123`)
- Choose base branch

## Recommended Workflow

### Complete Workflow Example

```bash
# === Setup ===
# 1. Create issue using lg tool
lg parent/sub

# Automatically switch to created branch
# Create branch (include issue number) unless automatically generatedue number
# git switch -c feat/LEA-123-implement-login

# === 1. Create Draft PR ===
# Option A: Use lgcmf command (automatically generates commit message from branch name)
lgcmf
git push -u origin feat/LEA-123-implement-login # or gpsup
gh pr create --draft --fill
# → Linear: Todo

# Option B: Manual commit (alternative to lgcmf)
# For empty commit: git commit --allow-empty -m "feat: LEA-123 Implement login feature" -m "solve: #123"
# For commit with changes: git add . && gcfeat "LEA-123 Implement login feature" "solve: #123"
# git push -u origin feat/LEA-123-implement-login
# gh pr create --draft --fill

# Option C: Use prdf function (recommended to avoid unpushed commits in PR body)
# prdf  # Setup via: bash setup-prdf.sh

# === 2. Start Work ===
# Begin coding...
git add .
gcfeat "Add login form component" "Use orange as base colour"
git push # or gp

# === 3. Mark as Ready ===
gh pr ready
# → Linear: In Progress

# === 4. Continue Work ===
git add .
gcfeat "Add validation logic"
git push

# === 5. Add Comments (PR/Issue) ===
# Comment on PR for non-file changes (e.g., paper notes, mindmaps)
gh pr comment -b "Created a mindmap on paper"

# Comment on issue for questions or task approach
gh issue comment 123 -b "Need to understand the core definition of XXX first"

# === 6. More Work ===
git add .
gcres "Solve questions on XXX"
git push

# === 7. Merge ===
gh prms  # or gh pr merge --squash --delete-branch
# → GitHub Issue #123: Closed
# → Linear LEA-123: Done

# === 8. Cleanup (Optional) ===
# Clean up deleted remote branch references
git fetch --prune
# Or use alias if configured: gfa (git fetch --all --tags --prune --jobs=10)

```

### Workflow Steps

1. **Create issue** - Use `lg parent/sub` command
2. **Create branch** - Include issue number in branch name
3. **Initial commit** - Use `lgcmf` command (auto-generates commit message) or manual commit
4. **Create draft PR** - Include Linear issue ID in title, `solve: #123` in body
5. **Linear auto-sync** - Status becomes `Todo`
6. **Start work** - Begin actual development
7. **Commit changes** - Regular commits as work progresses
8. **Mark PR ready** - Use `gh pr ready` when ready for review
9. **Linear auto-sync** - Status becomes `In Progress`
10. **Add comments** - Use PR comments for non-file progress, issue comments for questions
11. **Continue work** - More commits as needed
12. **Merge** - When task is complete
13. **Auto-close** - GitHub issue closes automatically
14. **Linear auto-sync** - Status becomes `Done`
15. **Cleanup** - Use `git fetch --prune` or `gfa` to clean up deleted remote branch references (optional)

## Linear Settings

Configure Linear's GitHub integration:

1. Linear Settings → Integrations → GitHub
2. Open "Pull request and commit automations"
3. Configure:
   - **On draft PR open** → `Todo` ✅
   - **On PR open (ready)** → `In Progress` ✅ (triggered by `gh pr ready`)
   - **On PR review request** → `No Action`
   - **On PR ready for merge** → `No Action` (or keep default)
   - **On PR merge** → `Done` ✅

**Key Settings:**
- Draft PRs set status to `Todo` (task identified, not started)
- Ready PRs set status to `In Progress` (work has begun)
- Merged PRs set status to `Done` (task complete)

## Branch Naming Convention

Include issue numbers in branch names for easy reference:

- `feat/LEA-123-implement-login`
- `fix/LEA-456-bug-fix`
- `docs/LEA-789-update-readme`
- `chore/LEA-101-update-dependencies`
- `refactor/LEA-202-restructure-code`
- `test/LEA-303-add-unit-tests`
- `research/LEA-404-data-analysis`

## PR Title and Body Format

### PR Title

Include Linear issue ID (copy with `Cmd + .` in Linear):

```
LEA-123 Implement login feature
```

### PR Body

Include GitHub issue reference:

```
solve: #123

## Changes

## Testing

## Related Information
```

Or use `Closes #123` for completion:

```
Closes #123

## Summary
```

## Partial Progress PRs (Non-Completing)

> [!NOTE] This Workflow Is Exceptional Case Only
> As a rule, it is strongly recommended to split tasks into smaller sub-issues and create separate PRs for each. The following workflow for partial-progress PRs should only be used as an exception, in cases where subdividing the issue is not practical or possible:

- You want to track incremental work on a large issue
- The PR represents only part of the work needed to complete the issue
- You want to merge progress without closing the issue

### How It Works

**Key difference:** Do NOT include the Linear issue ID in the PR title.

- **PR title:** Regular title without Linear issue ID (e.g., `Add login form component`)
- **PR body:** Include `Ref: #123` to link to the issue
- **Result:** PR links to issue for visibility, but merging won't change Linear status

### Workflow Example

```bash
# === Setup ===
# 1. Create issue
lg parent/sub
# select n when prompted to create branch

# 2. Create branch (can include issue number for reference)
git switch -c feat/add-login-form

# === 1. Create Draft PR (Partial Progress) ===
# Make changes, then create draft PR
git add .
gcfeat "add login form component" "Ref: #123"
git push -u origin feat/add-login-form

# Create PR WITHOUT Linear issue ID in title
gh pr create --draft --fill
# Title: "Add login form component" (NO LEA-123)
# Body: "Ref: #123\n\n## Changes\n..."
# → Linear: Status unchanged (no Linear ID in title)

# === 2. Work and Mark Ready ===
git add .
gcfeat "Add form validation"
git push
gh pr ready
# → Linear: Status unchanged (no Linear ID in title)

# === 3. Merge ===
gh prms  # or gh pr merge --squash --delete-branch
# → GitHub Issue #123: NOT closed (Ref: doesn't close)
# → Linear LEA-123: Status unchanged (no Linear ID in title)
```

### PR Format for Partial Progress

**PR Title:**

```
Add login form component
```

(Do NOT include `LEA-123` or Linear issue ID)

**PR Body:**

```
Ref: #123

## Changes
- Added login form component
- Implemented basic validation

## Notes
This is part of the larger login feature work tracked in #123.
```

### When to Use

- ✅ **Incremental progress** - Track work on large issues incrementally
- ✅ **Related work** - PR relates to issue but doesn't complete it
- ✅ **Work history** - Keep record of related work without status changes
- ❌ **Issue completion** - Use `Closes #123` or `solve: #123` instead

### Comparison

| Type | Title Format | Body Format | Linear Status on Merge | GitHub Issue on Merge |
|------|-------------|-------------|------------------------|----------------------|
| **Completing PR** | `LEA-123 Implement login` | `solve: #123` or `Closes #123` | `Done` | Closed |
| **Partial Progress PR** | `Add login form` (no Linear ID) | `Ref: #123` | Unchanged | Not closed |

## Progress Tracking

### Using PR Comments

For non-file changes or progress updates:

```bash
# Add comment to PR
gh pr comment -b "Created initial design mockup on paper"
gh pr comment -b "Reviewed related documentation"
```

### Using Issue Comments

For questions or task approach discussions:

```bash
# Add comment to issue
gh issue comment 123 -b "Need clarification on requirement X"
gh issue comment 123 -b "Considering approach A vs B"
```

### Benefits

- ✅ **Visibility** - Progress tracked even without file changes
- ✅ **History** - Questions and decisions documented
- ✅ **Context** - PR shows full development journey
- ✅ **Automation** - Linear status updates automatically

## Additional Commands

### lgcmf: Auto-generate First Commit

The `lgcmf` command automatically creates the first commit with proper message format by:
- Extracting Linear issue ID from current branch name
- Fetching Linear issue title and GitHub issue number
- Generating commit message: `feat: {linearId} {title}` with body `solve: #{githubIssueNumber}`

**Usage:**

```bash
# After creating branch with Linear issue ID
git switch -c feat/LEA-123-implement-login
lgcmf  # Automatically creates commit with proper format
git push -u origin feat/LEA-123-implement-login
```

**Requirements:**
- Branch name must include Linear issue ID (e.g., `feat/LEA-123-title`)
- Linear issue must be linked to a GitHub issue
- `.env` file with `LINEAR_API_KEY` must be configured

### Cleanup Remote Branch References

After merging PRs and deleting branches, clean up stale remote-tracking branch references:

```bash
# Clean up deleted remote branch references
git fetch --prune

# Or use alias if configured (recommended)
gfa  # git fetch --all --tags --prune --jobs=10
```

**Why prune?**
- `git branch -r` shows remote-tracking branches cached locally
- When remote branches are deleted, local references remain until pruned
- Pruning removes references to deleted remote branches

### Other Commands

For branch name auto-extraction or more complex logic, you can create custom shell functions or use `gh pr create` (without `--fill`) for interactive input, which allows you to manually enter the issue number.

## Preventing Unpushed Commits in PR Body

When using `gh pr create --fill`, unpushed commits are included in the PR body, which can lead to incorrect PR content. Two solutions are available:

### Solution 1: Safe Wrapper Function (prdf)

Replace the `gh alias` `prdf` with a safe wrapper function that checks for unpushed commits:

```bash
# Setup prdf function (adds to ~/.zshrc or ~/.bashrc)
bash setup-prdf.sh

# Reload shell config
source ~/.zshrc  # or source ~/.bashrc

# Usage (same as before, but now safe)
prdf
```

The wrapper function will:
- Check for unpushed commits before creating PR
- Warn if multiple commits are found
- Show the unpushed commits
- Prompt for confirmation before proceeding

**Note:** After setup, use `prdf` directly (not `gh prdf`). The function replaces the `gh alias` version.

### Solution 2: Post-Commit Hook

Install a git hook that warns about unpushed commits after each commit:

```bash
# Install the hook
bash install-hooks.sh

# Or manually:
cp post-commit-hook.sh .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

The hook will display a warning after each commit if there are unpushed commits, reminding you to push before creating a PR.

### Recommended Approach

Use both solutions for maximum protection:
1. Install the post-commit hook for continuous reminders
2. Setup `prdf` function to replace `gh alias prdf` (run `setup-prdf.sh`)

## Troubleshooting

### PR doesn't link to Linear issue

1. Check PR body contains `solve: #123` or `Closes #123`
2. Verify Linear GitHub integration is enabled
3. Confirm issue number is correct (must be repository issue)
4. Check PR title includes Linear issue ID

### Status doesn't update automatically

1. Check Linear Settings → Integrations → GitHub automation settings
2. Verify PR state (draft, ready, review, etc.)
3. Wait for Linear sync (may take seconds to minutes)
4. Ensure `gh pr ready` was used to transition from draft to ready

### Draft PR doesn't set status to Todo

1. Verify Linear setting: "On draft PR open → Todo"
2. Check PR was created with `--draft` flag
3. Confirm Linear integration is active

### Unpushed commits included in PR body

1. Setup `prdf` function: `bash setup-prdf.sh`
2. Use `prdf` instead of `gh prdf` (function replaces alias)
3. Install post-commit hook to get warnings: `bash install-hooks.sh`
4. Always push commits before creating PR: `git push`

## Summary

### Key Workflow Points

1. **Create draft PR early** - Right after branch creation, before work begins
2. **Use `gh pr ready`** - When starting actual work, mark PR as ready
3. **Track progress** - Use PR/issue comments for non-file progress
4. **Linear auto-sync** - Status updates automatically: Todo → In Progress → Done

### Two PR Types

**Completing PRs (Issue Completion):**
- Include Linear issue ID in title (e.g., `LEA-123 Implement login`)
- Use `solve: #123` or `Closes #123` in body
- Merging sets Linear status to `Done` and closes GitHub issue

**Partial Progress PRs (Non-Completing):**
- Do NOT include Linear issue ID in title (e.g., `Add login form`)
- Use `Ref: #123` in body
- Merging keeps Linear status unchanged and doesn't close GitHub issue

### Implementation

**Recommended: Use aliases or `gh pr create --fill`**

```bash
# Simple alias setup (optional)
gh alias set prd 'pr create --draft --title "$1" --body "solve: #$2"'
gh alias set prms 'pr merge --squash --delete-branch'

# Or use auto-fill mode
gh pr create --draft --fill
gh pr ready  # Standard command, no alias needed
gh prms      # Merge with squash and delete branch
```

**Workflow:**
1. Create issue → `lg parent/sub`
2. Create branch (automatic) → unless, `git switch -c feat/LEA-123-task`
3. First commit → `lgcmf` (auto-generates commit message) or manual commit
4. Push commits → `git push` (important: push before creating PR)
5. Draft PR → `prdf` (safe wrapper function) or `gh pr create --draft --fill` (Linear: Todo)
6. Start work → Code, commit, push
7. Mark ready → `gh pr ready` (Linear: In Progress)
8. Continue → More commits, comments
9. Merge → `gh prms` (Linear: Done, GitHub: Closed)
10. Cleanup → `git fetch --prune` or `gfa` (optional)

**Note:** To prevent unpushed commits from being included in PR body, setup `prdf` function via `bash setup-prdf.sh` or ensure all commits are pushed before creating PR.

This workflow provides clear visibility into task status and progress throughout the development cycle.
