#!/bin/bash

# Install git hooks for Linear-GitHub workflow
# This script installs the post-commit hook that warns about unpushed commits

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SOURCE="$SCRIPT_DIR/post-commit-hook.sh"
HOOK_TARGET=".git/hooks/post-commit"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "Error: Not in a git repository"
  exit 1
fi

# Check if hook source exists
if [ ! -f "$HOOK_SOURCE" ]; then
  echo "Error: Hook source not found: $HOOK_SOURCE"
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy hook
cp "$HOOK_SOURCE" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"

echo "✅ Post-commit hook installed successfully!"
echo "   Location: $HOOK_TARGET"
echo ""
echo "The hook will now warn you about unpushed commits after each commit."

