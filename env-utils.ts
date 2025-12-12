import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';

/**
 * Finds and loads .env file from multiple locations:
 * 1. Current working directory and parent directories (up to filesystem root)
 * 2. Home directory (~/.env)
 * 
 * This allows the CLI to work both when:
 * - Installed globally (user can create .env in their project or home directory)
 * - Installed locally (works with project's .env file)
 */
export function loadEnvFile(): void {
  // First, try to find .env in current working directory and parent directories
  let currentDir = process.cwd();
  const root = process.platform === 'win32' ? currentDir.split('\\')[0] + '\\' : '/';
  
  while (currentDir !== root) {
    const envPath = resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      config({ path: envPath });
      return;
    }
    const parentDir = dirname(currentDir);
    // Stop if we've reached the filesystem root (parent is same as current)
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  
  // Fallback: try home directory
  const homeEnvPath = resolve(homedir(), '.env');
  if (existsSync(homeEnvPath)) {
    config({ path: homeEnvPath });
    return;
  }
  
  // If no .env file found, dotenv will use environment variables
  // This is fine - we don't need to throw an error here
  config();
}

