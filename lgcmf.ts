#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { commitFirst } from './commands/commit-first';

// Load .env file from the project root
// __dirname points to dist/ in compiled output, so we go up one level
config({ path: resolve(__dirname, '..', '.env') });

commitFirst().catch((error) => {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

