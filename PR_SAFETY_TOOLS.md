# PR Safety Tools

Tools to prevent unpushed commits from being included in PR body when using `gh pr create --fill`.

## Problem

When using `gh pr create --fill`, GitHub CLI includes all commits on the branch (including unpushed ones) in the PR body. This can lead to incorrect PR content if you have multiple unpushed commits.

## Solutions

### Solution 1: Safe Wrapper Function (`prdf`)

Replace `gh alias prdf` with a safe wrapper function that checks for unpushed commits before creating a PR.

**Features:**
- Checks for unpushed commits before PR creation
- Shows unpushed commits if found
- Prompts for confirmation before proceeding
- Maintains the same `prdf` command name you're used to

**Setup:**

```bash
# Run setup script (adds prdf function to ~/.zshrc or ~/.bashrc)
bash setup-prdf.sh

# Reload shell config
source ~/.zshrc  # or source ~/.bashrc
```

**Usage:**

```bash
# Create draft PR safely (same command as before, but now safe)
prdf

# Note: Use prdf directly, not gh prdf
# The function replaces the gh alias version
```

**Behavior:**
- If no unpushed commits: Creates PR immediately
- If 1 unpushed commit: Creates PR (single commit is usually intentional)
- If 2+ unpushed commits: Shows warning, lists commits, prompts for confirmation

### Solution 2: Post-Commit Hook (`post-commit-hook.sh`)

A git hook that warns about unpushed commits after each commit.

**Features:**
- Automatically runs after each commit
- Warns if there are unpushed commits
- Reminds to push before creating PR
- Non-intrusive (doesn't block commits)

**Setup:**

```bash
# Install using the installation script (recommended)
bash install-hooks.sh

# Or manually:
cp post-commit-hook.sh .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

**Behavior:**
- After each commit, checks for unpushed commits
- If found, displays a warning message
- Doesn't block the commit process

### Recommended Approach

Use both solutions for maximum protection:

1. **Install post-commit hook** - Get continuous reminders after each commit
2. **Setup prdf function** - Get final check before creating PR

## Workflow Integration

### Setup prdf Function

Replace `gh alias prdf` with the safe wrapper function:

```bash
# Remove old gh alias (if exists)
gh alias delete prdf

# Setup prdf function
bash setup-prdf.sh
source ~/.zshrc  # or source ~/.bashrc

# Now use prdf directly (not gh prdf)
prdf
```

### Best Practice Workflow

```bash
# 1. Create branch and commit
git switch -c username/LEA-123-task
lgcmf  # or manual commit

# 2. Push immediately (important!)
git push -u origin username/LEA-123-task

# 3. Create draft PR (prdf function will verify no unpushed commits)
prdf

# 4. Continue work...
git add .
git commit -m "Add feature"
git push  # Always push before creating/updating PR

# 5. Mark ready when starting work
gh pr ready
```

## Files

- `gh-pr-safe.sh` - Safe wrapper script for `gh pr create --fill` (used by prdf function)
- `setup-prdf.sh` - Setup script to add prdf function to shell config
- `post-commit-hook.sh` - Git post-commit hook script
- `install-hooks.sh` - Installation script for git hooks

## Troubleshooting

### Hook not running

Check if hook is installed and executable:
```bash
ls -la .git/hooks/post-commit
```

Reinstall if needed:
```bash
bash install-hooks.sh
```

### prdf function not found

Ensure you've run the setup script and reloaded your shell config:
```bash
bash setup-prdf.sh
source ~/.zshrc  # or source ~/.bashrc
```

If the function still doesn't work, check that it was added to your shell config file.

### False positives

The wrapper checks commits ahead of `origin/branch`. If you're on a new branch without remote tracking, it will proceed safely (no remote to compare against).

