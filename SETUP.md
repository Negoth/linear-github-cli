# Setup Instructions

## Quick Start

### 1. Install CLI Tool Globally (Recommended)

```bash
npm install -g linear-github-cli
```

Or if installing from source:

```bash
git clone <repository-url>
cd linear-github-cli
npm install
npm install -g .
```

After installation, use `lg` or `linear-github` from anywhere:

```bash
lg create-parent
lg create-sub
lg --help
```

### 3. Set Environment Variable

**Option 1: Using .env file (Recommended)**

Create a `.env` file in the project root:

```bash
cp .env.example .env
# Then edit .env and add your API key
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

### 5. Verify GitHub CLI is Installed

```bash
gh --version
```

If not installed:
- **macOS**: `brew install gh`
- **Linux/Windows**: See [GitHub CLI installation guide](https://cli.github.com/manual/installation)

### 6. Authenticate GitHub CLI (if not already done)

```bash
gh auth login
```

Follow the prompts to authenticate.

### 7. Test the CLI Tool

```bash
# Test help command
lg --help

# Test parent issue creation (will prompt interactively)
lg create-parent

# Test sub-issue creation (will prompt interactively)
lg create-sub
```

## Alternative Installation Methods

### Option 1: Local Development (npm link)

```bash
git clone <repository-url>
cd linear-github-cli
npm install
npm link
```

### Option 2: Development Mode

```bash
git clone <repository-url>
cd linear-github-cli
npm install
npm run dev create-parent
npm run dev create-sub
```

## Usage Examples

### Create Parent Issue

```bash
lg create-parent
# or use alias
lg parent
```

Follow the interactive prompts to:
1. Select repository
2. Enter issue details
3. Select projects (optional)

### Create Sub-Issue

```bash
lg create-sub
# or use alias
lg sub
```

Follow the interactive prompts to:
1. Select repository
2. Select parent issue
3. Enter sub-issue details
4. Select projects (optional)

## Troubleshooting

### "lg: command not found"

If you installed globally, make sure npm's global bin directory is in your PATH:

```bash
# Check npm global prefix
npm config get prefix

# Add to PATH (macOS/Linux)
export PATH="$(npm config get prefix)/bin:$PATH"
```

Or use one of the alternative installation methods above.

### "LINEAR_API_KEY environment variable is required"

Make sure you've either:
1. Created a `.env` file in the project root with `LINEAR_API_KEY=lin_api_...`
2. Or exported the variable in your current shell session: `export LINEAR_API_KEY="lin_api_..."`

### "gh: command not found"

Install GitHub CLI (see step 5 above).

### Repository list is empty

Make sure you're authenticated:
```bash
gh auth status
gh auth login  # if not authenticated
```

### Projects not showing

GitHub Projects might not be available via CLI in all repositories. This is optional - you can skip project selection.

### "tsx: command not found" (Development Mode)

Install tsx globally:
```bash
npm install -g tsx
```

Or use npx (if installed from source):
```bash
npx tsx src/cli.ts create-parent
```

## Next Steps

Once setup is complete, you can:
1. Create parent issues: `lg create-parent`
2. Create sub-issues: `lg create-sub`
3. All issues will automatically sync to Linear
4. Metadata (due dates, projects) will be set automatically

See `README.md` for detailed usage instructions.
