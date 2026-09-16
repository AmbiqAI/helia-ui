// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Which section a path lands in. The top bar lights one link from this answer
 * and the route middleware cuts the sidebar down to the same section, so a
 * wrong answer is two wrong things that agree with each other.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchSection } from '../starlight/sections.ts';

const base = '/heliaCORE/';

/* The seven sections of the heliaCORE site plan, in the order its bar lists
   them. Reference is the one whose pages do not live under its link. */
const sections = [
  { label: 'Home', href: base },
  { label: 'Getting started', href: `${base}getting-started/` },
  { label: 'Architecture', href: `${base}architecture/` },
  { label: 'Coverage', href: `${base}coverage/` },
  { label: 'Performance', href: `${base}performance/` },
  {
    label: 'Reference',
    href: `${base}reference/kernels/`,
    match: `${base}reference/`,
  },
  { label: 'Contributing', href: `${base}contributing/` },
];

const labelAt = (pathname) =>
  matchSection(sections, pathname, base)?.label ?? null;

test('a section takes every page under it', () => {
  assert.equal(labelAt(`${base}getting-started/`), 'Getting started');
  assert.equal(labelAt(`${base}getting-started/install/`), 'Getting started');
  assert.equal(labelAt(`${base}architecture/graph/passes/`), 'Architecture');
});

test('a trailing slash either side does not change the answer', () => {
  assert.equal(labelAt(`${base}coverage`), 'Coverage');
  assert.equal(labelAt(`${base}coverage/`), 'Coverage');
});

test('match names the prefix when the pages are not under the href', () => {
  assert.equal(labelAt(`${base}reference/operators/add/`), 'Reference');
});

test('a section at the base is the landing page alone', () => {
  assert.equal(labelAt(base), 'Home');
  assert.equal(labelAt('/heliaCORE'), 'Home');
  assert.equal(labelAt(`${base}performance/`), 'Performance');
});

test('a page in no section matches nothing', () => {
  assert.equal(labelAt(`${base}changelog/`), null);
});

test('the longer prefix wins, whatever order they are declared in', () => {
  const nested = [
    { label: 'Guides', href: '/guides/' },
    { label: 'Deployment', href: '/guides/deployment/' },
  ];
  assert.equal(
    matchSection(nested, '/guides/deployment/aws/', '/')?.label,
    'Deployment',
  );
  assert.equal(
    matchSection([...nested].reverse(), '/guides/deployment/aws/', '/')?.label,
    'Deployment',
  );
  assert.equal(matchSection(nested, '/guides/intro/', '/')?.label, 'Guides');
});

test('an external bar link never matches a path', () => {
  const links = [{ label: 'GitHub', href: 'https://github.com/AmbiqAI' }];
  assert.equal(matchSection(links, `${base}anything/`, base), undefined);
});
