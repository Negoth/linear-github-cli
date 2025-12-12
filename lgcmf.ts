#!/usr/bin/env node
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import updateNotifier from 'update-notifier';
import { commitFirst } from './commands/commit-first';

// Load .env file from the project root
// __dirname points to dist/ in compiled output, so we go up one level
config({ path: resolve(__dirname, '..', '.env') });

// Check for updates
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));
updateNotifier({ pkg }).notify();

commitFirst().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

