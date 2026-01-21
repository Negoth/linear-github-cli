# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and cursor agent when working with code and in this repository.

## Key Rules

1. API Keys: Never commit .env files. Always use os.environ.get("ANTHROPIC_API_KEY")

## Git Workflow

**Commit format (conventional commits)**:

```
feat(scope): add new feature
fix(scope): fix bug
docs(scope): update documentation
research(scope): conduct research
style: lint/format
```

## Python Conventions

**Python version**: `>=3.10` (per `pyproject.toml`)

**Code style**:
- Follow PEP 8 guidelines
- Use `snake_case` for functions and variables
- Use `UPPER_CASE` for constants
- Use `pathlib.Path` for file operations
- Prefer f-strings for string formatting
- Import order: standard library → third-party → local

**Scripts structure**:
- Include shebang: `#!/usr/bin/env python3`
- Add docstrings with Usage section
- Use `if __name__ == "__main__":` for executable code

**Dependencies**:
- Use `uv add <package>` or `uv add --dev <package>` to add dependencies
- Never edit `pyproject.toml` directly - `uv add` ensures `pyproject.toml` and `uv.lock` stay synchronized
- Pin versions for reproducibility when needed

## Markdown Conventions

**File structure**:
- Use YAML frontmatter (delimited by `---`) for metadata
- Include `tags` field in frontmatter when appropriate
- Use hierarchical tags with `/` separator (e.g., `statistics/regression`)
- Use standard markdown headings (`#`, `##`, `###`)
- Never use `---` as a section divider in markdown documents

**Formatting (markdownlint compliance)**:
- Add blank line before and after headings
- Add blank line before and after lists
- Add blank line before and after code blocks
- No trailing spaces at end of lines
- Use spaces for indentation (no hard tabs)
- Maximum one blank line between paragraphs

## Build and Development Commands

- Install deps: `npm install`
- Run CLI in dev mode: `npm run dev create-parent` or `npm run dev create-sub`
- Build: `npm run build`

## Code Style

- Language: TypeScript targeting Node 18+.
- Keep CLI prompts and output concise and friendly.
- Prefer small, focused functions in `commands/`, `github-client.ts`, and `linear-client.ts`.
- Avoid committing secrets; `.env` files stay local.

## Testing Instructions

- No automated test suite is configured yet.
- Do quick manual checks:
  - `npm run dev create-parent`
  - `npm run dev create-sub`

## Workflow and Etiquette

- Follow conventional commits per @CLAUDE.md.
- Use issue-based branch names (e.g., `username/LEA-123-short-title`).
- Keep PRs small; draft early when possible.
- If you touch UX or prompts, validate flows in both parent and sub commands.

## Version Control

When making code changes, increment the version in @package.json following semantic versioning:
- Patch version (x.x.X): For bug fixes and minor changes
- Minor version (x.X.x): For new features that don't break existing functionality
- Major version (X.x.x): For breaking changes

Always update the version number before committing code changes.
