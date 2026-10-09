// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

test('Astro formatting preserves embedded CSS comments across repeated passes', async () => {
  const filepath = fileURLToPath(
    new URL('../astro/Stack.astro', import.meta.url),
  );
  const options = { ...(await prettier.resolveConfig(filepath)), filepath };
  const input = `---
---
<div>Fixture</div>
<style>
  .fixture {
    /*
     * Preserve the constraint that belongs beside this declaration.
     */
    color: red;
  }
</style>
`;
  const once = await prettier.format(input, options);
  assert.equal(await prettier.format(once, options), once);
  assert.match(once, /Preserve the constraint/);
});
