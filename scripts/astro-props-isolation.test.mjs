// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const source = resolve(import.meta.dirname, '..');

test('props generation ignores neighboring repository documents', () => {
  const root = mkdtempSync(join(tmpdir(), 'helia-ui-isolation-'));
  try {
    const isolated = join(root, 'unrelated', 'library');
    mkdirSync(join(isolated, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'docs'));
    const neighbor = join(root, 'docs', 'design-system.md');
    const sentinel = 'A neighboring document with no generator markers.\n';
    writeFileSync(neighbor, sentinel);
    for (const name of [
      'astro',
      '.prettierrc.json',
      'package.json',
      'docs/src/content/docs/reference/astro-parts.mdx',
      'scripts/astro-props.mjs',
    ]) {
      cpSync(join(source, name), join(isolated, name), { recursive: true });
    }
    symlinkSync(
      join(source, 'node_modules'),
      join(isolated, 'node_modules'),
      'dir',
    );
    const generated = join(
      isolated,
      'docs/src/content/docs/reference/astro-parts.mdx',
    );
    const expected = readFileSync(generated, 'utf8');
    for (const args of [[], ['--check']]) {
      const result = spawnSync(
        process.execPath,
        [join(isolated, 'scripts/astro-props.mjs'), ...args],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 60000,
        },
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readFileSync(neighbor, 'utf8'), sentinel);
      assert.equal(readFileSync(generated, 'utf8'), expected);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
