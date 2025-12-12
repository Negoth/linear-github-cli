#!/bin/bash

# gh-pr-safe: Safe wrapper for gh pr create --fill
# Checks for unpushed commits before creating PR to avoid including them in PR body
#
# Usage: gh-pr-safe [--draft] [other gh pr create flags]
# Example: gh-pr-safe --draft

set -e

# Get current branch
BRANCH=$(git branch --show-current)

# Get base branch (default: main, can be overridden)
BASE_BRANCH="${BASE_BRANCH:-main}"
BASE_REMOTE="origin/$BASE_BRANCH"

# Check if base branch exists on remote
if ! git rev-parse --verify "$BASE_REMOTE" >/dev/null 2>&1; then
  echo "⚠️  Warning: Base branch '$BASE_REMOTE' does not exist on remote."
  echo "   Cannot check for unpushed commits. Proceeding anyway..."
  exec gh pr create --fill "$@"
fi

# Check if main has unpushed commits
MAIN_AHEAD=$(git rev-list --count "$BASE_REMOTE".."$BASE_BRANCH" 2>/dev/null || echo "0")

if [ "$MAIN_AHEAD" -gt 0 ]; then
  echo "⚠️  Warning: There are $MAIN_AHEAD unpushed commit(s) on '$BASE_BRANCH' branch."
  echo ""
  echo "Unpushed commits on $BASE_BRANCH:"
  git log "$BASE_REMOTE".."$BASE_BRANCH" --oneline
  echo ""
  echo "These commits will be included in the PR body if you create a PR now."
  echo "Consider pushing them first:"
  echo "  git checkout $BASE_BRANCH"
  echo "  git push"
  echo ""
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Check if current branch has unpushed commits (if branch exists on remote)
if git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
  BRANCH_AHEAD=$(git rev-list --count "origin/$BRANCH"..HEAD 2>/dev/null || echo "0")
  
  if [ "$BRANCH_AHEAD" -gt 1 ]; then
    echo "⚠️  Warning: There are $BRANCH_AHEAD unpushed commit(s) on branch '$BRANCH'."
    echo ""
    echo "Unpushed commits:"
    git log "origin/$BRANCH"..HEAD --oneline
    echo ""
    echo "If you create a PR now, these commits will be included in the PR body."
    echo "Consider pushing them first:"
    echo "  git push"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
  fi
fi

# Extract PR title from first commit message to preserve hyphens (e.g., LEA-123)
# lgcmf generates: "feat: LEA-123 {title}", so we extract everything after "type: "
FIRST_COMMIT_MSG=$(git log --format=%s -1 2>/dev/null || echo "")
if [[ "$FIRST_COMMIT_MSG" =~ ^[^:]+:\ (.+)$ ]]; then
  # Extract title part after "type: " (e.g., "feat: LEA-123 title" -> "LEA-123 title")
  PR_TITLE="${BASH_REMATCH[1]}"
else
  # Fallback: use branch name without prefix (e.g., "fix/LEA-123-title" -> "LEA-123-title")
  PR_TITLE="${BRANCH#*/}"  # Remove prefix/ if exists
  if [ "$PR_TITLE" = "$BRANCH" ]; then
    # No / found, use branch name as is
    PR_TITLE="$BRANCH"
  fi
fi

# Proceed with PR creation using commit message title to preserve hyphens
# --title preserves hyphens, --fill still auto-generates body from commits
exec gh pr create --title "$PR_TITLE" --fill "$@"

