// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import test from 'node:test';

import { regularTitlePrefix } from '../starlight/header-title.ts';

test('keeps the HELIA prefix treatment and allows a product prefix', () => {
  assert.equal(regularTitlePrefix('heliaCORE'), 'helia');
  assert.equal(regularTitlePrefix('physioKIT', 'physio'), 'physio');
  assert.equal(regularTitlePrefix('physioKIT'), '');
});

test('rejects a prefix that does not leave a title suffix', () => {
  assert.throws(() => regularTitlePrefix('physioKIT', 'heart'));
  assert.throws(() => regularTitlePrefix('physioKIT', 'physioKIT'));
});
