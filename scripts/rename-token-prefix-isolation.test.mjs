// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('token migration preserves its rules when scanning a parent checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'helia-token-root-'));
  try {
    const library = join(root, 'vendor', 'ui');
    mkdirSync(join(library, 'scripts'), { recursive: true });
    mkdirSync(join(library, 'react'));
    const script = join(library, 'scripts', 'rename-token-prefix.mjs');
    cpSync(join(import.meta.dirname, 'rename-token-prefix.mjs'), script);
    const original = readFileSync(script, 'utf8');
    writeFileSync(join(root, 'theme.css'), ':root { color: var(--ds-ink); }');
    writeFileSync(
      join(library, 'react', 'example.tsx'),
      'const style = "bg-accent";',
    );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    for (let run = 0; run < 2; run++) {
      execFileSync(process.execPath, [script, '--root', root], { cwd: root });
      assert.equal(readFileSync(script, 'utf8'), original);
      assert.equal(
        readFileSync(join(root, 'theme.css'), 'utf8'),
        ':root { color: var(--helia-ink); }',
      );
      assert.equal(
        readFileSync(join(library, 'react', 'example.tsx'), 'utf8'),
        'const style = "bg-subtle";',
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
