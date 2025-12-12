#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';
import updateNotifier from 'update-notifier';
import { commitFirst } from './commands/commit-first';
import { loadEnvFile } from './env-utils';

// Load .env file from current working directory, parent directories, or home directory
loadEnvFile();

// Check for updates
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));
updateNotifier({ pkg }).notify();

commitFirst().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

