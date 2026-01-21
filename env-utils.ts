import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
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
function hasLinearApiKey(envPath: string): boolean {
  const contents = readFileSync(envPath, 'utf-8');
  const match = contents.match(/^\s*LINEAR_API_KEY\s*=\s*(.+)\s*$/m);
  if (!match) {
    return false;
  }
  const rawValue = match[1].trim();
  const unquoted = rawValue.replace(/^['"]|['"]$/g, '').trim();
  return unquoted.length > 0;
}

function exitMissingLinearApiKey(): never {
  console.error('❌ LINEAR_API_KEY not found in .env');
  console.error('   Add it to your .env file:');
  console.error('     echo "LINEAR_API_KEY=lin_api_..." > .env');
  process.exit(1);
}

export function loadEnvFile(): void {
  // First, try to find .env in current working directory and parent directories
  let currentDir = process.cwd();
  const root = process.platform === 'win32' ? currentDir.split('\\')[0] + '\\' : '/';
  
  while (currentDir !== root) {
    const envPath = resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      if (!hasLinearApiKey(envPath)) {
        exitMissingLinearApiKey();
      }
      console.log(`✅ LINEAR_API_KEY found in ${envPath}`);
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
    if (!hasLinearApiKey(homeEnvPath)) {
      exitMissingLinearApiKey();
    }
    console.log(`✅ LINEAR_API_KEY found in ${homeEnvPath}`);
    config({ path: homeEnvPath });
    return;
  }
  
  exitMissingLinearApiKey();
}

