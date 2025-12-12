#!/usr/bin/env tsx
/**
 * Validation script to check code structure and imports
 * Run with: tsx validate.ts
 */

import { LinearClientWrapper } from './linear-client';
import { GitHubClientWrapper } from './github-client';
import { InputHandler } from './input-handler';

console.log('✅ All imports successful!');

// Test class instantiation (without API calls)
console.log('\n📦 Testing class structure...');

try {
  // Test LinearClientWrapper structure
  const linearClient = new LinearClientWrapper('test-key');
  console.log('✅ LinearClientWrapper can be instantiated');
  
  // Test GitHubClientWrapper structure
  const githubClient = new GitHubClientWrapper('test/repo');
  console.log('✅ GitHubClientWrapper can be instantiated');
  
  // Test InputHandler structure
  const inputHandler = new InputHandler(linearClient, githubClient);
  console.log('✅ InputHandler can be instantiated');
  
  console.log('\n✅ All classes are properly structured!');
  console.log('\n📋 Next steps:');
  console.log('   1. Install dependencies: npm install');
  console.log('   2. Set LINEAR_API_KEY environment variable');
  console.log('   3. Authenticate GitHub CLI: gh auth login');
  console.log('   4. Test with: tsx create-parent-issue.ts');
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

