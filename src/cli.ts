#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import updateNotifier from 'update-notifier';
import { createParentIssue } from './commands/create-parent';
import { createSubIssue } from './commands/create-sub';
import { loadEnvFile } from './env-utils';

// Load .env file from current working directory, parent directories, or home directory
loadEnvFile();

// Check for updates (support both dev and built paths)
const pkgPathCandidates = [
  resolve(__dirname, 'package.json'),
  resolve(__dirname, '..', 'package.json'),
];
const pkgPath = pkgPathCandidates.find(candidate => existsSync(candidate));
const pkg = pkgPath ? JSON.parse(readFileSync(pkgPath, 'utf-8')) : null;
if (pkg) {
  updateNotifier({ pkg }).notify();
}

const program = new Command();

program
  .name('lg')
  .description('Linear + GitHub Integration CLI - Create GitHub issues with Linear sync')
  .version(pkg?.version ?? 'unknown');

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

