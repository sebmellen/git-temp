import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanRelative, formatBytes, instructionSnippet, isCliEntry, parseArgs } from '../bin/git-temp.js';

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

test('CLI entry guard follows npm .bin symlink', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'git-temp-'));
  try {
    const link = path.join(dir, 'git-temp');
    symlinkSync(fileURLToPath(new URL('../bin/git-temp.js', import.meta.url)), link);
    assert.equal(isCliEntry(link), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--integrate is an init flag, not a directory', () => {
  assert.deepEqual(parseArgs(['--integrate']), { command: 'init', dir: undefined, integrate: true });
  assert.deepEqual(parseArgs(['temp', '--integrate']), { command: 'init', dir: 'temp', integrate: true });
});
