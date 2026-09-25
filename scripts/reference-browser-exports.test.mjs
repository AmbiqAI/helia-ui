// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

for (const specifier of [
  '@ambiqai/helia-ui/astro/ReferenceBrowser',
  '@ambiqai/helia-ui/react/reference-browser',
  '@ambiqai/helia-ui/astro/Landing',
]) {
  test(`${specifier} resolves to a shipped source file`, () => {
    assert.ok(existsSync(new URL(import.meta.resolve(specifier))), specifier);
  });
}
