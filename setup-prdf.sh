#!/bin/bash

# Setup prdf as a safe wrapper function
# This script adds the prdf function to your shell config

set -e

# Get script directory (works in various execution contexts)
# Try BASH_SOURCE[0] first (works when script is sourced or executed directly)
# Fall back to $0 if BASH_SOURCE[0] is empty (works when executed via bash -c)
if [ -n "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
WRAPPER_SCRIPT="$SCRIPT_DIR/gh-pr-safe.sh"

# Verify wrapper script exists
if [ ! -f "$WRAPPER_SCRIPT" ]; then
  echo "❌ Error: Wrapper script not found at $WRAPPER_SCRIPT"
  echo "   Expected: $WRAPPER_SCRIPT"
  echo "   Script dir: $SCRIPT_DIR"
  exit 1
fi

# Detect shell config file based on current shell (not script interpreter)
CURRENT_SHELL="${SHELL##*/}"
if [ "$CURRENT_SHELL" = "zsh" ]; then
  SHELL_CONFIG="$HOME/.zshrc"
elif [ "$CURRENT_SHELL" = "bash" ]; then
  SHELL_CONFIG="$HOME/.bashrc"
else
  echo "⚠️  Warning: Unsupported shell '$CURRENT_SHELL'. Defaulting to .zshrc"
  SHELL_CONFIG="$HOME/.zshrc"
fi

# Function definition
FUNCTION_DEF=$(cat <<EOF

# prdf: Safe wrapper for gh pr create --draft --fill
# Checks for unpushed commits before creating PR
prdf() {
  bash "$WRAPPER_SCRIPT" --draft "\$@"
}
EOF
)

# Check if function already exists
if grep -q "^prdf()" "$SHELL_CONFIG" 2>/dev/null; then
  echo "⚠️  prdf function already exists in $SHELL_CONFIG"
  echo "Please remove the existing definition and run this script again."
  exit 1
fi

# Add function to shell config
echo "$FUNCTION_DEF" >> "$SHELL_CONFIG"

echo "✅ prdf function added to $SHELL_CONFIG"
echo ""
echo "To use it immediately, run:"
echo "  source $SHELL_CONFIG"
echo ""
echo "Or open a new terminal window."

