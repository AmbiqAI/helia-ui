// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { matchSection } from '../starlight/sections.ts';

const source = readFileSync(
  new URL('../starlight/sections-route-middleware.ts', import.meta.url),
  'utf8',
)
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '')
  .replace('import.meta.env.BASE_URL', "'/site/'");
const code = ts
  .transpile(source, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  })
  .replace(/^export /gm, '');
const load = new Function(
  'defineRouteMiddleware',
  'config',
  'matchSection',
  `${code}\nreturn onRequest;`,
);

for (const header of [null, { links: [] }]) {
  test(`sidebar-free home preserves navigation with header ${Boolean(header)}`, () => {
    const config = {
      header,
      sections: [
        { label: 'Home', href: '/site/', sidebar: false },
        { label: 'Guide', href: '/site/guide/' },
      ],
    };
    const route = {
      hasSidebar: true,
      sidebar: [{ type: 'group', label: 'Guide', entries: [] }],
    };
    const context = {
      url: new URL('https://example.test/site/'),
      locals: { starlightRoute: route },
    };
    load((callback) => callback, config, matchSection)(context);
    assert.equal(route.hasSidebar, !header);
    assert.deepEqual(route.sidebar, []);
    assert.equal(context.locals.heliaSectionNav.length, 2);
  });
}
