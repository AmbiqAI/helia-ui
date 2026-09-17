// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The extractor's contract: which Doxygen compound and which command lands in
 * which field of the reference model, and what the C reference looks like once
 * the shared renderer has had it.
 *
 * The fixture under `fixtures/doxygen` is real Doxygen 1.17.0 output, not a
 * hand-written approximation. `src/helia_sample.h` and the `Doxyfile` beside
 * it are the input, `xml/` is what `doxygen Doxyfile` wrote, and the only
 * edit is that the schema files and the compounds for directories and the
 * deprecation list were deleted as things this reader never opens. Capturing
 * the tool's own output is the point: an assumption about the XML that a new
 * Doxygen release breaks should fail here, on a file that can be regenerated
 * in one command, rather than on a product site.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import {
  DoxyrefSchemaError,
  extractModel,
  parseDoxygenXml,
  readDoxygenXml,
  summarize,
} from './lib/doxyref-extract.mjs';
import { parseXml, textOf } from './lib/xml.mjs';
import { renderReference } from './lib/reference-render.mjs';
import { validateReferenceModel } from '../reference-model.ts';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/doxygen/xml',
);

const dump = await readDoxygenXml(FIXTURE);

/** The fixture as a model, with the warnings the run produced. */
const extract = (options = {}) =>
  extractModel(dump, options, { schema: 'urn:test:schema' });

const { model, warnings } = extract();
const header = model.modules[0].submodules[0];
const find = (id) => header.symbols.find((symbol) => symbol.id === id);

test('the XML reader keeps text, attributes and entities', () => {
  const root = parseXml(
    '<a x="1&amp;2"><b/>text &lt;here&gt;<!-- skip --><c><![CDATA[<raw>]]></c></a>',
  );
  assert.equal(root.name, 'a');
  assert.equal(root.attrs.x, '1&2');
  assert.equal(textOf(root), 'text <here><raw>');
});

test('a directory that is not a Doxygen dump is refused, not misread', async () => {
  await assert.rejects(
    () => readDoxygenXml(join(FIXTURE, 'nope')),
    DoxyrefSchemaError,
  );
  assert.throws(
    () => parseDoxygenXml({ index: '<other/>', compounds: new Map() }),
    /expected <doxygenindex>/,
  );
  assert.throws(
    () =>
      parseDoxygenXml({
        index: '<doxygenindex version="1.17.0"/>',
        compounds: new Map(),
      }),
    /lists no compounds/,
  );
});

test('a file compound becomes a module whose page keeps the header name', () => {
  assert.equal(model.name, 'helia-sample');
  assert.equal(model.language, 'c');
  assert.deepEqual(model.generatedFrom, {
    tool: 'doxyref',
    version: '1.17.0',
  });
  assert.equal(model.modules.length, 1);
  assert.equal(model.modules[0].path, 'helia-sample');
  /* The route drops the extension so it splits on dots like every other
   * module path; the title keeps it, because that is the file. */
  assert.equal(header.path, 'helia-sample.helia_sample');
  assert.equal(header.name, 'helia_sample.h');
  assert.equal(header.summary, 'A miniature HELIA runtime header.');
  assert.match(header.description, /deliberately small and deliberately/);
  assert.deepEqual(warnings, []);
});

test('every memberdef kind lands on the model kind it maps to', () => {
  assert.deepEqual(
    header.symbols.map((symbol) => [symbol.id, symbol.kind]),
    [
      ['helia_config_t', 'struct'],
      ['HELIA_MAX_NAME', 'macro'],
      ['helia_model_t', 'type'],
      ['helia_status_t', 'enum'],
      ['helia_model_load', 'function'],
      ['helia_model_run', 'function'],
    ],
  );
  for (const symbol of header.symbols) assert.equal(symbol.language, 'c');
});

test('a define becomes a macro carrying the value it expands to', () => {
  const macro = find('HELIA_MAX_NAME');
  assert.equal(macro.signature, '#define HELIA_MAX_NAME 32');
  assert.equal(
    macro.summary,
    'Largest model name the runtime will accept, in bytes.',
  );
  assert.match(macro.description, /fits in the descriptor/);
  assert.deepEqual(macro.params, []);
  assert.deepEqual(macro.source, { path: 'src/helia_sample.h', line: 23 });
});

test('a typedef becomes a type spelled the way the header spells it', () => {
  assert.equal(
    find('helia_model_t').signature,
    'typedef struct helia_model helia_model_t',
  );
});

test('an enum carries its values as members, with their initializers', () => {
  const status = find('helia_status_t');
  assert.equal(status.signature, 'enum helia_status_t');
  assert.equal(status.since, '0.2');
  assert.deepEqual(
    status.members.map((member) => [
      member.id,
      member.kind,
      member.signature,
      member.summary,
    ]),
    [
      ['HELIA_OK', 'constant', 'HELIA_OK = 0', 'The call succeeded.'],
      [
        'HELIA_ERR_ARG',
        'constant',
        'HELIA_ERR_ARG = 1',
        'A pointer argument was null or a size was zero.',
      ],
      [
        'HELIA_ERR_MEMORY',
        'constant',
        'HELIA_ERR_MEMORY = 2',
        'The arena could not satisfy the allocation.',
      ],
    ],
  );
});

test('a struct compound becomes a symbol with its fields as members', () => {
  const config = find('helia_config_t');
  assert.equal(config.signature, 'struct helia_config_t');
  assert.equal(config.summary, 'Where a model puts its working memory.');
  assert.deepEqual(
    config.members.map((member) => [member.id, member.kind, member.signature]),
    [
      ['helia_config_t::arena', 'attribute', 'void * arena'],
      ['helia_config_t::arena_bytes', 'attribute', 'size_t arena_bytes'],
      ['helia_config_t::name', 'attribute', 'char name[HELIA_MAX_NAME]'],
    ],
  );
  /* An undocumented public field is still part of the struct's layout, so it
   * is listed with an empty description rather than dropped. */
  assert.equal(config.members[2].description, '');
});

test('parameters take their type from the declaration and their meaning from the docs', () => {
  const load = find('helia_model_load');
  assert.equal(
    load.signature,
    'helia_status_t helia_model_load(const helia_config_t *config, helia_model_t **model)',
  );
  assert.deepEqual(load.params, [
    {
      name: 'config',
      type: 'const helia_config_t *',
      description: 'Arena and name for the model.',
      direction: 'in',
    },
    {
      name: 'model',
      type: 'helia_model_t **',
      description: 'Receives the handle on success, untouched on failure.',
      direction: 'out',
    },
  ]);
});

test('an out parameter and an in-out parameter keep their direction', () => {
  const run = find('helia_model_run');
  assert.deepEqual(
    run.params.map((param) => [param.name, param.direction]),
    [
      ['model', 'in'],
      ['input', 'in'],
      ['scratch', 'inout'],
      ['output', 'out'],
    ],
  );
});

test('the return section becomes a return, not prose', () => {
  assert.deepEqual(find('helia_model_load').returns, [
    {
      description:
        '`HELIA_OK`, or `HELIA_ERR_MEMORY` when the arena is too small.',
    },
  ]);
  assert.deepEqual(find('helia_model_run').returns, [
    { description: '`HELIA_OK` on success.' },
  ]);
  /* Everything the sections claimed is out of the prose, so a reader does not
   * meet the same sentence twice. */
  assert.equal(find('helia_model_run').description, 'Run one inference pass.');
});

test('since and deprecated come off the sections that carry them', () => {
  assert.equal(find('helia_model_load').since, '0.2');
  assert.equal(find('helia_model_load').deprecated, undefined);
  assert.equal(
    find('helia_model_run').deprecated,
    "Use helia_model_invoke() instead; this entry point ignores the model's quantization parameters.",
  );
  assert.equal(find('helia_model_run').since, undefined);
});

test('descriptions are Markdown: paragraphs, code blocks and refs', () => {
  const load = find('helia_model_load');
  const [summary, prose, example] = load.description.split('\n\n');
  assert.equal(summary, "Load a model into the caller's arena.");
  /* A `ref` is an identifier, and an identifier reads as code. */
  assert.match(prose, /Nothing is copied out of `config`, so it may live/);
  assert.match(example, /^```c\n/);
  assert.match(
    example,
    /helia_config_t config = \{ \.arena = buffer, \.arena_bytes = sizeof\(buffer\) \};/,
  );
});

test('the language is C even though Doxygen labels a header C++', () => {
  assert.equal(extract({ language: 'cpp' }).model.language, 'cpp');
  assert.equal(
    extract({ name: 'helia-sdk' }).model.modules[0].path,
    'helia-sdk',
  );
});

test('source paths are made relative and can be linked to a code host', () => {
  const linked = extract({
    sourceUrl: 'https://example.test/blob/main/{path}#L{line}',
  }).model.modules[0].submodules[0];
  const load = linked.symbols.find((s) => s.id === 'helia_model_load');
  assert.deepEqual(load.source, {
    path: 'src/helia_sample.h',
    line: 68,
    url: 'https://example.test/blob/main/src/helia_sample.h#L68',
  });
});

test('a summary is the first sentence, trimmed to fit a description tag', () => {
  assert.equal(summarize('One. Two.'), 'One.');
  assert.equal(summarize('**No** `markup` here'), 'No markup here');
  assert.equal(summarize(`${'a '.repeat(120)}.`).length, 160);
});

/* -------------------------------------------------------------------------
 * Through the shared renderer
 * ---------------------------------------------------------------------- */

const options = { base: '/helia-sdk/', routePrefix: 'reference/api' };
const rendered = renderReference(model, options);

test('the extracted model is a reference model the guard accepts', () => {
  assert.deepEqual(validateReferenceModel(model), model);
});

test('the C reference renders the same page set the Python one does', () => {
  assert.deepEqual(
    rendered.pages.map((page) => page.path),
    ['helia-sample/index.mdx', 'helia-sample/helia_sample/index.mdx'],
  );
  assert.deepEqual(
    rendered.artifacts.map((artifact) => artifact.path),
    [
      'reference/api/reference.json',
      'reference/api/helia-sample.json',
      'reference/api/helia-sample/helia_sample.json',
      'reference/api/llms.txt',
      'reference/api/llms-full.txt',
    ],
  );
  assert.deepEqual(rendered.warnings, []);
});

test('a symbol page carries the anchors a link is written against', () => {
  const page = rendered.pages[1];
  assert.equal(
    page.route,
    '/helia-sdk/reference/api/helia-sample/helia_sample/',
  );
  assert.deepEqual(page.anchors, [
    'helia_config_t',
    'helia_config_t::arena',
    'helia_config_t::arena_bytes',
    'helia_config_t::name',
    'HELIA_MAX_NAME',
    'helia_model_t',
    'helia_status_t',
    'HELIA_OK',
    'HELIA_ERR_ARG',
    'HELIA_ERR_MEMORY',
    'helia_model_load',
    'helia_model_run',
  ]);
});

test('C parameter rows show direction without implying pointer nullability', () => {
  const { mdx } = rendered.pages[1];
  assert.match(
    mdx,
    /import RefParams from '@ambiqai\/helia-ui\/astro\/RefParams';/,
  );
  assert.match(mdx, /language=\{"c"\}/);
  assert.match(mdx, /defaultLabel=\{"Direction"\}/);
  assert.doesNotMatch(mdx, /Required/);
  assert.match(mdx, /kind=\{"macro"\}/);
  assert.match(mdx, /"name":"output","type":"float \*","default":"out"/);
  assert.match(mdx, /"name":"scratch","type":"size_t \*","default":"in, out"/);
  assert.match(mdx, /deprecated=\{"Use helia_model_invoke\(\)/);
});

test('llms-full.txt is the C reference as Markdown, signatures and all', () => {
  const full = rendered.artifacts.find((artifact) =>
    artifact.path.endsWith('llms-full.txt'),
  ).contents;
  assert.match(full, /```c\nenum helia_status_t\n```/);
  assert.match(full, /`macro` · `c`/);
  assert.match(full, /Available since 0\.2\./);
  assert.match(full, /\*\*Deprecated\.\*\* Use helia_model_invoke\(\)/);
});

/* -------------------------------------------------------------------------
 * Grouped headers, whose module names are the author's own spelling
 * ---------------------------------------------------------------------- */

const GROUPS = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/doxygen-groups/xml',
);

const grouped = renderReference(
  extractModel(await readDoxygenXml(GROUPS), {}, { schema: 'urn:test:schema' })
    .model,
  { base: '/helia-core/', routePrefix: 'reference/api' },
);

/** Every slug the sidebar fragment carries, at any depth. */
const sidebarSlugs = (entry) =>
  entry.items
    ? entry.items.flatMap(sidebarSlugs)
    : entry.slug
      ? [entry.slug]
      : [];

/** Every site URL an artifact points at. */
const linkedUrls = (contents) =>
  [...contents.matchAll(/\]\((\/[^)\s]+)\)/g)].map((match) => match[1]);

test('a mixed-case group is routed the way Starlight slugs it', () => {
  const page = grouped.pages.find((entry) => entry.route.includes('/nnconv/'));
  assert.equal(page.path, 'helia-groups/nnconv/index.mdx');
  assert.equal(page.route, '/helia-core/reference/api/helia-groups/nnconv/');
  assert.equal(page.artifact, 'reference/api/helia-groups/nnconv.json');
  /* The name the author wrote is still the module's identity; only the route
   * is slugged. */
  assert.equal(
    grouped.pages.some((entry) => entry.path.includes('NNConv')),
    false,
  );
});

test('every emitted URL and path is lowercase', () => {
  const emitted = [
    ...grouped.pages.flatMap((page) => [page.path, page.route, page.artifact]),
    ...grouped.artifacts.map((artifact) => artifact.path),
    ...grouped.artifacts
      .filter((artifact) => artifact.path.endsWith('.txt'))
      .flatMap((artifact) => linkedUrls(artifact.contents)),
    ...grouped.nav.flatMap(function hrefs(item) {
      return [item.href, ...(item.items ?? []).flatMap(hrefs)];
    }),
    ...sidebarSlugs(grouped.sidebar),
  ];
  for (const value of emitted) assert.equal(value, value.toLowerCase(), value);
});

test('a page URL is the page the generator wrote, on a case-sensitive host', () => {
  for (const page of grouped.pages) {
    const onDisk = page.path.replace(/index\.mdx$/, '');
    assert.equal(page.route, `/helia-core/reference/api/${onDisk}`);
  }
  const llms = grouped.artifacts.find((artifact) =>
    artifact.path.endsWith('llms.txt'),
  ).contents;
  const served = new Set(grouped.pages.map((page) => page.route));
  for (const url of linkedUrls(llms)) {
    if (url.endsWith('/')) assert.equal(served.has(url), true, url);
  }
});

test('a group with no brief still carries a description frontmatter', () => {
  for (const page of grouped.pages) {
    assert.match(page.mdx, /^description: "\S[^\n]*"$/m, page.path);
  }
  const gather = grouped.pages.find((page) => page.path.includes('gather'));
  assert.match(
    gather.mdx,
    /^description: "Functions, types and macros in Gather\."$/m,
  );
  /* The group that does brief itself keeps its own words. */
  const conv = grouped.pages.find((page) => page.path.includes('nnconv'));
  assert.match(conv.mdx, /^description: "Convolution kernels\."$/m);
});

test('wrapped C declarations separate parameters without a trailing comma', () => {
  const name =
    'helia_model_load_with_a_long_name_that_requires_a_wrapped_signature';
  const compounds = new Map(
    ['helia__sample_8h', 'structhelia__config__t'].map((id) => [
      id,
      readFileSync(join(FIXTURE, `${id}.xml`), 'utf8').replaceAll(
        'helia_model_load',
        name,
      ),
    ]),
  );
  const input = parseDoxygenXml({
    index: readFileSync(join(FIXTURE, 'index.xml'), 'utf8').replaceAll(
      'helia_model_load',
      name,
    ),
    compounds,
  });
  const result = extractModel(input);
  const symbols = (module) => [
    ...module.symbols,
    ...module.submodules.flatMap(symbols),
  ];
  const fn = result.model.modules
    .flatMap(symbols)
    .find((symbol) => symbol.name === name);
  assert.equal(
    fn.signature,
    `helia_status_t ${name}(\n    const helia_config_t *config,\n    helia_model_t **model\n)`,
  );
});
