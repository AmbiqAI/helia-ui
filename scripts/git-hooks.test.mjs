// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkCommitMessage, checkStagedFiles } from './git-hooks.mjs';

test('commit subjects use conventional types and reject attribution trailers', () => {
  for (const message of [
    'fix: preserve identifiers',
    'feat(starlight)!: change layout',
    'chore(deps): update Astro',
  ]) {
    assert.doesNotThrow(() => checkCommitMessage(message));
  }
  assert.throws(() => checkCommitMessage('update stuff'), /conventional/);
  assert.throws(
    () =>
      checkCommitMessage(
        'fix: preserve identifiers\n\nCo-authored-by: Someone',
      ),
    /trailers/,
  );
});

test('pre-commit checks the staged content even when the worktree is formatted', async () => {
  const root = mkdtempSync(join(tmpdir(), 'helia-ui-hooks-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init', '--quiet');
    writeFileSync(join(root, '.prettierrc.json'), '{"singleQuote":true}\n');
    const file = join(root, 'file with spaces.mjs');
    writeFileSync(file, 'export const value=1;\n');
    git('add', 'file with spaces.mjs');
    writeFileSync(file, 'export const value = 1;\n');
    await assert.rejects(checkStagedFiles(root), /format and stage/);
    git('add', 'file with spaces.mjs');
    await checkStagedFiles(root);
    git('rm', '--cached', 'file with spaces.mjs');
    await checkStagedFiles(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
