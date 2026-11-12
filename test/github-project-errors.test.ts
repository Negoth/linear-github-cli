import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAlreadyInProjectError } from '../src/github-project-errors';

test('isAlreadyInProjectError detects the duplicate-item error from gh', () => {
  assert.equal(isAlreadyInProjectError('gh: Content already exists in this project'), true);
  assert.equal(
    isAlreadyInProjectError('[{"type":"UNPROCESSABLE","message":"Content already exists in this project"}]'),
    true,
  );
});

test('isAlreadyInProjectError ignores other errors', () => {
  assert.equal(isAlreadyInProjectError('gh: Could not resolve to a node with the global id'), false);
  assert.equal(isAlreadyInProjectError(''), false);
});
