// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * `header.hub`, read at the option rather than off a rendered page: a site
 * either named the link or it did not, and the site the docs suite drives can
 * only be one of those two.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hubLabelParts, resolveHub } from '../starlight/header-hub.ts';

const href = 'https://helia.ambiq.com/';

test('a site that named no hub link carries none', () => {
  assert.equal(resolveHub(undefined), null);
});

test('the default wording names the hub', () => {
  assert.deepEqual(resolveHub({ href }), {
    label: 'HELIA DEV HUB',
    href,
  });
});

test('legacy labels use the shared destination name', () => {
  assert.equal(resolveHub({ href, label: 'The hub' })?.label, 'HELIA DEV HUB');
});

test('the family name is the accented run of the default wording', () => {
  assert.deepEqual(hubLabelParts('Part of HELIA Dev Hub'), [
    { text: 'Part of ', accent: false },
    { text: 'HELIA', accent: true },
    { text: ' Dev Hub', accent: false },
  ]);
});

test('a label that opens or closes on the name has no empty run', () => {
  assert.deepEqual(hubLabelParts('HELIA Dev Hub'), [
    { text: 'HELIA', accent: true },
    { text: ' Dev Hub', accent: false },
  ]);
});

test('a label that does not say HELIA is accented whole', () => {
  assert.deepEqual(hubLabelParts('Developer hub'), [
    { text: 'Developer hub', accent: true },
  ]);
});
