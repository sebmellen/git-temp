import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRelative, formatBytes, instructionSnippet } from '../bin/git-temp.js';

test('cleanRelative keeps directories inside repo', () => {
  assert.equal(cleanRelative('temp/'), 'temp');
  assert.equal(cleanRelative('notes/scratch'), 'notes/scratch');
  assert.throws(() => cleanRelative('../nope'));
  assert.throws(() => cleanRelative('/tmp/nope'));
});

test('formatBytes is readable', () => {
  assert.equal(formatBytes(12), '12 B');
  assert.equal(formatBytes(2048), '2.0 KB');
});

test('instruction snippet names selected dir', () => {
  assert.match(instructionSnippet('scratch'), /\.\/scratch\//);
});
