# Linear + GitHub CLI Tool

A CLI tool for creating GitHub issues with Linear integration, providing an interactive experience with autocomplete and dropdown selections.

## Installation

### Option 1: Install from npm (Recommended)

```bash
npm install -g linear-github-cli
```

After installation, use `lg` or `linear-github` from anywhere:

```bash
lg create-parent
lg create-sub
lg --help
```

### Option 2: Install from Source

```bash
git clone <repository-url>
cd linear-github-cli
npm install
npm install -g .
```

### Option 3: Development Mode

```bash
git clone <repository-url>
cd linear-github-cli
npm install
npm run dev create-parent
npm run dev create-sub
```

## Setup

### 1. Install Dependencies (if installing from source)

```bash
npm install
```

### 2. Configure Environment Variables

**Option 1: Using .env file (Recommended)**

Create a `.env` file in the project root:

```bash
cp .env.example .env
# Then edit .env and add your API key: LINEAR_API_KEY=lin_api_...
```

Or create it directly:

```bash
echo 'LINEAR_API_KEY=lin_api_...' > .env
```

**Option 2: Export in shell (Temporary)**

```bash
export LINEAR_API_KEY="lin_api_..."
```

**Get your Linear API key:**
1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Create a new Personal API Key
3. Copy the key (starts with `lin_api_`)

**Note:** The `.env` file is already in `.gitignore`, so it won't be committed to Git.

### 3. Authenticate GitHub CLI

```bash
gh auth login
gh auth status  # Verify
```

## Usage

### Create Parent Issue

```bash
lg create-parent
# or
lg parent
```

Follow the interactive prompts:
1. Select repository from dropdown
2. Enter issue title (required)
3. Enter description (opens in editor)
4. Set due date (YYYY-MM-DD, required)
5. Select GitHub labels (checkboxes). Choices: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `research`
6. Optionally select GitHub project
7. Optionally select Linear project (after sync)

### Create Sub-Issue

```bash
lg create-sub
# or
lg sub
```

Follow the interactive prompts:
1. Select repository from dropdown
2. Select parent issue from list
3. Enter sub-issue title (required)
4. Enter description (opens in editor)
5. Set due date (YYYY-MM-DD, required)
6. Select GitHub labels (same predefined list as above)
7. Optionally select Linear project (after sync)

### Show Help

```bash
lg --help
lg create-parent --help
lg create-sub --help
```

## Features

- ✅ **Interactive repository selection**: Choose from accessible GitHub repositories
- ✅ **Project autocomplete**: Select GitHub and Linear projects from dropdowns
- ✅ **Parent issue selection**: Browse and select parent issues when creating sub-issues
- ✅ **GitHub label sync**: Multi-select from the seven standard labels (feat, fix, chore, docs, refactor, test, research); selections are mirrored to matching Linear team labels
- ✅ **Due date input**: Required date picker with validation
- ✅ **Automatic Linear sync**: Waits for Linear sync and updates metadata (due date, project, labels)
- ✅ **Parent-child relationships**: Automatically links sub-issues to parent issues
- ✅ **Status automation**: Issues start in Linear backlog; rely on the Linear × GitHub PR automation for status changes

## Examples

### Basic Usage

```bash
# Create a parent issue
lg create-parent

# Create a sub-issue
lg create-sub
```

### With Environment Variable

```bash
LINEAR_API_KEY="lin_api_..." lg create-parent
```

## Requirements

- **Node.js** 18+ and npm
- **GitHub CLI** (`gh`) installed and authenticated
- **Linear API key** (get from [Linear Settings](https://linear.app/settings/api))

## Building from Source

```bash
npm install
npm run build
```

The compiled JavaScript will be in the `dist/` directory.

## Troubleshooting

### "LINEAR_API_KEY environment variable is required"

Make sure you've set the environment variable:

```bash
export LINEAR_API_KEY="lin_api_..."
```

### GitHub Project date fields not being set

If start date or target date fields are not being set in GitHub Projects:

1. **Enable debug mode** to see detailed logs:
   ```bash
   DEBUG=true lg parent
   ```

2. **Check the logs** for:
   - Whether the project item was found (may require retries due to timing)
   - Whether the date fields exist in the project
   - Any GraphQL errors

3. **Common issues**:
   - The issue may not be indexed in the project yet (the tool will retry automatically)
   - The project may not have "Target" or "Start" date fields configured
   - Network or API rate limiting issues

### "lg: command not found"

If you installed globally, make sure npm's global bin directory is in your PATH:

```bash
# Check npm global prefix
npm config get prefix

# Add to PATH (macOS/Linux)
export PATH="$(npm config get prefix)/bin:$PATH"
```

### "gh: command not found"

Install GitHub CLI:
- **macOS**: `brew install gh`
- **Linux/Windows**: See [GitHub CLI installation](https://cli.github.com/manual/installation)

### Repository list is empty

Make sure you're authenticated:

```bash
gh auth status
gh auth login  # if not authenticated
```

### Projects not showing

GitHub Projects might not be available via CLI in all repositories. This is optional - you can skip project selection.

### Linear issue not found after sync

The tool waits 5 seconds for Linear sync. If the issue still isn't found:
- Check Linear GitHub integration is enabled
- Wait a bit longer and manually update metadata in Linear
- The GitHub Actions workflow will also set metadata automatically

## Architecture

```
lg (CLI)
├── cli.ts                    # CLI entry point (Commander.js)
├── commands/
│   ├── create-parent.ts     # Parent issue command
│   └── create-sub.ts        # Sub-issue command
├── linear-client.ts          # Linear SDK wrapper
├── github-client.ts          # GitHub CLI/API wrapper
└── input-handler.ts          # Interactive prompts (Inquirer.js)
```

## Development

### Run in Development Mode

```bash
npm run dev create-parent
npm run dev create-sub
```

### Build

```bash
npm run build
```

## Label Behaviour

- The CLI surfaces the seven standard GitHub labels: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `research`. (Custom GitHub labels can still be added manually after creation.)
- When an issue syncs to Linear, the CLI ensures team-scoped Linear labels exist. New labels are created for the linked team if necessary and then attached to the issue.
- Linear issues are always created in the backlog ("No status"). Move them forward by opening PRs and letting the Linear × GitHub integration handle status updates automatically.

## Future Enhancements

- Caching of repositories and projects
- Configuration file for defaults
- Better error handling and retry logic
- Additional commands (list, update, close issues)
- Template support for issue creation

## PR Creation Workflow

After creating issues with `lg`, use the Linear-GitHub integration workflow to manage PRs and track progress.

### Recommended Approach: Aliases

The simplest approach is to use `gh` aliases or interactive mode:

```bash
# Set up aliases (optional)
gh alias set prd 'pr create --draft --title "$1" --body "solve: #$2"'
gh alias set prms 'pr merge --squash --delete-branch'

# Or use interactive mode (recommended)
gh pr create --draft --fill
gh pr ready  # Standard command, use directly when starting work
gh prms      # Merge with squash and delete branch
```

### Workflow Overview

1. **Create issue** - Use `lg parent/sub` command
2. **Create branch** - Include issue number (e.g., `username/LEA-123-task`)
3. **Create draft PR** - Right after branch creation, before work begins
   - Include Linear issue ID in title (copy with `Cmd + .` in Linear)
   - Include `solve: #123` or `Closes #123` in body
   - Linear status: `Todo`
4. **Start work** - Begin actual development
5. **Mark PR ready** - Use `gh pr ready` when ready for review
   - Linear status: `In Progress`
6. **Continue work** - More commits, add PR/issue comments for progress
7. **Merge** - When task is complete
   - Linear status: `Done`
   - GitHub issue: Closed automatically

### Two PR Types

**Completing PRs (Issue Completion):**
- Include Linear issue ID in title: `LEA-123 Implement login`
- Use `solve: #123` or `Closes #123` in body
- Merging sets Linear status to `Done` and closes GitHub issue

**Partial Progress PRs (Non-Completing):**
- Do NOT include Linear issue ID in title: `Add login form`
- Use `Ref: #123` in body
- Merging keeps Linear status unchanged and doesn't close GitHub issue
- Useful for tracking incremental work on large issues

### Linear Settings

Configure Linear's GitHub integration:

1. Linear Settings → Integrations → GitHub
2. Open "Pull request and commit automations"
3. Configure:
   - **On draft PR open** → `Todo` ✅
   - **On PR open (ready)** → `In Progress` ✅ (triggered by `gh pr ready`)
   - **On PR review request** → `No Action`
   - **On PR ready for merge** → `No Action`
   - **On PR merge** → `Done` ✅

### Additional Notes

For branch name auto-extraction or more complex logic, you can create custom shell functions or use `gh pr create --fill` interactively, which allows you to manually enter the issue number.

For most cases, aliases or `gh pr create --fill` are simpler and sufficient.

### Documentation

See `workflow.md` for complete workflow documentation, examples, and troubleshooting.

## License

ISC
