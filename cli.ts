#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createParentIssue } from './commands/create-parent';
import { createSubIssue } from './commands/create-sub';

// Load .env file from the project root
// __dirname points to dist/ in compiled output, so we go up one level
config({ path: resolve(__dirname, '..', '.env') });

const program = new Command();

program
  .name('lg')
  .description('Linear + GitHub Integration CLI - Create GitHub issues with Linear sync')
  .version('1.0.0');

program
  .command('create-parent')
  .alias('parent')
  .description('Create a parent GitHub issue with Linear integration')
  .action(async () => {
    try {
      await createParentIssue();
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('create-sub')
  .alias('sub')
  .description('Create a sub-issue linked to a parent issue')
  .action(async () => {
    try {
      await createSubIssue();
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

