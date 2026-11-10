import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gitHubIssueUrlSearchTerm,
  normalizeGitHubIssueUrl,
  pickIssueIdByGitHubUrl,
} from '../src/github-url';

const parentUrl = 'https://github.com/owner/repo/issues/1';

test('normalizeGitHubIssueUrl strips URL variations', () => {
  const expected = 'https://github.com/owner/repo/issues/1';
  assert.equal(normalizeGitHubIssueUrl(parentUrl), expected);
  assert.equal(normalizeGitHubIssueUrl('https://github.com/owner/repo/issues/1/'), expected);
  assert.equal(normalizeGitHubIssueUrl('https://github.com/owner/repo/issues/1#issuecomment-123'), expected);
  assert.equal(normalizeGitHubIssueUrl('https://github.com/owner/repo/issues/1?foo=bar'), expected);
  assert.equal(normalizeGitHubIssueUrl('http://www.github.com/Owner/Repo/issues/1'), expected);
  assert.equal(normalizeGitHubIssueUrl('  https://github.com/owner/repo/issues/1  '), expected);
});

test('normalizeGitHubIssueUrl keeps different issue numbers distinct', () => {
  assert.notEqual(
    normalizeGitHubIssueUrl('https://github.com/owner/repo/issues/13'),
    normalizeGitHubIssueUrl(parentUrl)
  );
  assert.notEqual(
    normalizeGitHubIssueUrl('https://github.com/owner/repo/issues/100'),
    normalizeGitHubIssueUrl(parentUrl)
  );
});

test('normalizeGitHubIssueUrl rejects non-issue URLs', () => {
  assert.equal(normalizeGitHubIssueUrl('https://github.com/owner/repo/pull/1'), null);
  assert.equal(normalizeGitHubIssueUrl('https://github.com/owner/repo/issues/1abc'), null);
  assert.equal(normalizeGitHubIssueUrl('https://example.com/owner/repo/issues/1'), null);
});

test('pickIssueIdByGitHubUrl: parent #1 does not match sub #13 (regression)', () => {
  // Sub #13 is returned first, as happened in the original bug.
  const attachments = [
    { url: 'https://github.com/owner/repo/issues/13', issueId: 'sub-13' },
    { url: 'https://github.com/owner/repo/issues/100', issueId: 'issue-100' },
    { url: 'https://github.com/owner/repo/issues/1', issueId: 'parent-1' },
  ];
  assert.equal(pickIssueIdByGitHubUrl(attachments, parentUrl), 'parent-1');
});

test('pickIssueIdByGitHubUrl returns null when only prefix matches exist', () => {
  const attachments = [
    { url: 'https://github.com/owner/repo/issues/13', issueId: 'sub-13' },
    { url: 'https://github.com/owner/repo/issues/10', issueId: 'issue-10' },
  ];
  assert.equal(pickIssueIdByGitHubUrl(attachments, parentUrl), null);
});

test('pickIssueIdByGitHubUrl ignores other repos with the same number', () => {
  const attachments = [
    { url: 'https://github.com/owner/repo-other/issues/1', issueId: 'other' },
    { url: 'https://github.com/owner/repo/issues/1#issuecomment-9', issueId: 'parent-1' },
  ];
  assert.equal(pickIssueIdByGitHubUrl(attachments, parentUrl), 'parent-1');
});

test('pickIssueIdByGitHubUrl skips attachments without an issue', () => {
  const attachments = [
    { url: parentUrl, issueId: null },
    { url: parentUrl, issueId: 'parent-1' },
  ];
  assert.equal(pickIssueIdByGitHubUrl(attachments, parentUrl), 'parent-1');
});

test('gitHubIssueUrlSearchTerm drops the scheme for a broad server-side search', () => {
  assert.equal(
    gitHubIssueUrlSearchTerm('https://github.com/Owner/Repo/issues/1/'),
    'github.com/owner/repo/issues/1'
  );
});
