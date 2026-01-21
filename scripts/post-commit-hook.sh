#!/bin/bash

# Git post-commit hook
# Alerts user about unpushed commits to prevent including them in PR body
#
# Installation: Copy this file to .git/hooks/post-commit and make it executable
#   cp scripts/post-commit-hook.sh .git/hooks/post-commit
#   chmod +x .git/hooks/post-commit

# Get current branch name
BRANCH=$(git branch --show-current)

# Check if branch exists on remote
if ! git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
  # New branch, no remote tracking - skip warning
  exit 0
fi

# Count unpushed commits (commits ahead of origin)
AHEAD=$(git rev-list --count "origin/$BRANCH"..HEAD 2>/dev/null || echo "0")

if [ "$AHEAD" -gt 0 ]; then
  echo ""
  echo "⚠️  You have $AHEAD unpushed commit(s) on the '$BRANCH' branch."
  echo "   If you're planning to create a PR, consider pushing them:"
  echo "      git push"
  echo ""
fi

