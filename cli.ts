#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import updateNotifier from 'update-notifier';
import { createParentIssue } from './commands/create-parent';
import { createSubIssue } from './commands/create-sub';
import { loadEnvFile } from './env-utils';

// Load .env file from current working directory, parent directories, or home directory
loadEnvFile();

// Check for updates
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));
updateNotifier({ pkg }).notify();

const program = new Command();

program
  .name('lg')
  .description('Linear + GitHub Integration CLI - Create GitHub issues with Linear sync')
  .version('1.0.2');

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

