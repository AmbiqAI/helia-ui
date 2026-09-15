#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Generates the Astro parts reference from the parts themselves.
 *
 *   node scripts/astro-props.mjs           write the page
 *   node scripts/astro-props.mjs --check   fail if the page is out of date
 *
 * The contract of a part is its `Props` interface, the defaults in its
 * `Astro.props` destructure, and the `@slot` lines in its component doc
 * comment. All three are in the file already, so a hand-written reference page
 * would be a second copy of them that drifts the first time a default changes.
 * This reads them instead, which is why `--check` runs in `validate`: a part
 * whose props move and whose page does not is a failed build, not a stale page.
 *
 * Slots are read from `@slot` rather than from the template because a slot
 * needs a sentence about what belongs in it, and only the author can write it.
 * The template is still parsed, to fail when a slot exists and is undocumented.
 *
 * The gallery links live here rather than in the parts: a part is consumed by
 * sites that are not this one, and a URL into this docs site would be wrong in
 * every one of them.
 */

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import prettier from 'prettier';
import ts from 'typescript';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASTRO_DIR = join(PACKAGE_ROOT, 'astro');
const OUT_PATH = join(
  PACKAGE_ROOT,
  'docs/src/content/docs/reference/astro-parts.mdx',
);

/** The docs site's base path. Its own `astro.config.mjs` sets the same value. */
const DOCS_BASE = '/helia-ui';

/**
 * Where each part is shown working. Every part must have an entry: a part with
 * no example is a part nobody has looked at rendered, so the omission fails the
 * build rather than producing a section with no way through to the thing.
 */
const EXAMPLES = {
  AccordionGroup: { page: 'disclosure', label: 'Disclosure' },
  AsciiTerminal: { page: 'code', label: 'Code', anchor: 'ascii-terminal' },
  Badge: { page: 'cards', label: 'Cards', anchor: 'badge' },
  Band: { page: 'gallery', label: 'Gallery', anchor: 'band' },
  BigNumber: { page: 'gallery', label: 'Gallery', anchor: 'figures' },
  Button: { page: 'primitives', label: 'Primitives', anchor: 'button' },
  Callout: { page: 'callouts', label: 'Callouts', anchor: 'core-guidance' },
  Card: { page: 'cards', label: 'Cards', anchor: 'the-card-parts' },
  CardActions: {
    page: 'cards',
    label: 'Cards',
    anchor: 'a-card-with-every-part',
  },
  CardContent: {
    page: 'cards',
    label: 'Cards',
    anchor: 'a-card-with-every-part',
  },
  CardGrid: { page: 'gallery', label: 'Gallery', anchor: 'card-grid' },
  CardHeader: {
    page: 'cards',
    label: 'Cards',
    anchor: 'a-card-with-every-part',
  },
  CardList: { page: 'gallery', label: 'Gallery', anchor: 'content-first' },
  CardQuote: { page: 'gallery', label: 'Gallery', anchor: 'content-first' },
  CardMedia: {
    page: 'cards',
    label: 'Cards',
    anchor: 'a-card-with-every-part',
  },
  Chart: { page: 'gallery', label: 'Gallery', anchor: 'charts' },
  ChartGroup: { page: 'gallery', label: 'Gallery', anchor: 'three-across' },
  Chip: { page: 'primitives', label: 'Primitives', anchor: 'chip' },
  CodeBlock: { page: 'code', label: 'Code', anchor: 'file-example' },
  CodeTabs: { page: 'code', label: 'Code', anchor: 'language-tabs' },
  DataTable: { page: 'layout', label: 'Layout', anchor: 'data-table' },
  EditorialBand: { page: 'layout', label: 'Layout', anchor: 'editorial-band' },
  Eyebrow: { page: 'primitives', label: 'Primitives', anchor: 'eyebrow' },
  Icon: { page: 'primitives', label: 'Primitives', anchor: 'icon' },
  IconRow: { page: 'gallery', label: 'Gallery', anchor: 'icon-rows' },
  IconTile: { page: 'gallery', label: 'Gallery', anchor: 'icon-tiles' },
  LinkCard: { page: 'gallery', label: 'Gallery', anchor: 'linkcard' },
  Masonry: { page: 'gallery', label: 'Gallery', anchor: 'masonry' },
  Media: { page: 'media', label: 'Media', anchor: 'generative-artwork' },
  MediaEmbed: { page: 'media', label: 'Media', anchor: 'hosted-video' },
  Mosaic: { page: 'gallery', label: 'Gallery', anchor: 'mosaic' },
  Reveal: { page: 'gallery', label: 'Gallery', anchor: 'reveal-on-scroll' },
  SectionHeader: { page: 'layout', label: 'Layout', anchor: 'section-header' },
  ShowcaseCarousel: {
    page: 'layout',
    label: 'Layout',
    anchor: 'showcase-carousel',
  },
  Sparkline: { page: 'gallery', label: 'Gallery', anchor: 'figures' },
  SplitPanel: { page: 'gallery', label: 'Gallery', anchor: 'split-panel' },
  StatCard: { page: 'gallery', label: 'Gallery', anchor: 'statcard' },
  Surface: { page: 'primitives', label: 'Primitives', anchor: 'surface' },
  Timeline: { page: 'timeline', label: 'Timeline', anchor: 'recent-updates' },
};

const failures = [];

/* ------------------------------------------------------------------ parsing */

/** The frontmatter fence is the only part of an Astro file TypeScript can read. */
function frontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return match ? match[1] : '';
}

function template(source) {
  const match = /^---\r?\n[\s\S]*?\r?\n---/.exec(source);
  return match ? source.slice(match[0].length) : source;
}

/** The whole `/** ... *\/` block in front of a node, tags and all. */
function docComment(node, source) {
  const ranges = ts.getLeadingCommentRanges(source, node.pos) ?? [];
  const blocks = ranges
    .filter((range) => source.slice(range.pos, range.pos + 3) === '/**')
    .map((range) => source.slice(range.pos, range.end));
  return blocks.length > 0 ? blocks[blocks.length - 1] : '';
}

/** Strips the comment furniture, leaving the prose as written. */
function stripStars(block) {
  return block
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim();
}

function parseDoc(block) {
  const text = stripStars(block);
  const slots = [];
  const prose = [];
  for (const line of text.split('\n')) {
    const slot = /^@slot\s+(\S+)\s+--\s+(.+)$/.exec(line.trim());
    if (slot) {
      slots.push({ name: slot[1], description: slot[2].trim() });
      continue;
    }
    if (line.trim().startsWith('@')) continue;
    prose.push(line);
  }
  const paragraphs = prose
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { summary: paragraphs[0] ?? '', slots };
}

/** The doc comment on the first statement that carries one is the part's own. */
function componentDoc(sourceFile, source) {
  for (const statement of sourceFile.statements) {
    const block = docComment(statement, source);
    if (block) return parseDoc(block);
  }
  return { summary: '', slots: [] };
}

function localDeclarations(sourceFile) {
  const interfaces = new Map();
  const aliases = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      interfaces.set(statement.name.text, statement);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      aliases.set(statement.name.text, statement);
    }
  }
  return { interfaces, aliases };
}

function propertyDoc(member, source) {
  const block = docComment(member, source);
  if (!block) return '';
  return stripStars(block).replace(/\s+/g, ' ').trim();
}

function members(declaration, source, scope) {
  const collected = [];
  const inherited = [];
  const seen = new Set();

  const fromTypeNode = (typeNode) => {
    if (ts.isParenthesizedTypeNode(typeNode))
      return fromTypeNode(typeNode.type);
    if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
      for (const part of typeNode.types) fromTypeNode(part);
      return;
    }
    if (ts.isTypeLiteralNode(typeNode)) {
      addMembers(typeNode.members);
      return;
    }
    if (ts.isTypeReferenceNode(typeNode)) {
      const name = typeNode.typeName.getText();
      const local = scope.interfaces.get(name);
      if (local && !typeNode.typeArguments) {
        fromDeclaration(local);
        return;
      }
      inherited.push(typeNode.getText().replace(/\s+/g, ' '));
      return;
    }
    inherited.push(typeNode.getText().replace(/\s+/g, ' '));
  };

  const addMembers = (list) => {
    for (const member of list) {
      if (!ts.isPropertySignature(member) || !member.name) continue;
      const name = member.name.getText().replace(/^['"]|['"]$/g, '');
      if (seen.has(name)) continue;
      seen.add(name);
      collected.push({
        name,
        optional: Boolean(member.questionToken),
        type: expand(member.type, scope),
        raw: member.type ? member.type.getText() : 'unknown',
        description: propertyDoc(member, source),
      });
    }
  };

  const fromDeclaration = (node) => {
    if (ts.isInterfaceDeclaration(node)) {
      addMembers(node.members);
      for (const clause of node.heritageClauses ?? []) {
        for (const expression of clause.types) {
          const name = expression.expression.getText();
          const local = scope.interfaces.get(name);
          if (local && !expression.typeArguments) {
            fromDeclaration(local);
            continue;
          }
          inherited.push(expression.getText().replace(/\s+/g, ' '));
        }
      }
      return;
    }
    fromTypeNode(node.type);
  };

  fromDeclaration(declaration);
  return { props: collected, inherited: [...new Set(inherited)] };
}

/** A local alias is worth inlining; anything else stays a name the reader can grep. */
function expand(typeNode, scope) {
  if (!typeNode) return 'unknown';
  const text = typeNode.getText().replace(/\s+/g, ' ');
  if (ts.isTypeReferenceNode(typeNode) && !typeNode.typeArguments) {
    const alias = scope.aliases.get(typeNode.typeName.getText());
    if (alias) return alias.type.getText().replace(/\s+/g, ' ');
  }
  return text;
}

function defaults(sourceFile) {
  const found = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (
        !initializer ||
        !ts.isPropertyAccessExpression(initializer) ||
        initializer.getText().replace(/\s+/g, '') !== 'Astro.props'
      ) {
        continue;
      }
      if (!ts.isObjectBindingPattern(declaration.name)) continue;
      for (const element of declaration.name.elements) {
        if (element.dotDotDotToken) continue;
        const key = (element.propertyName ?? element.name).getText();
        if (!element.initializer) continue;
        found.set(key, element.initializer.getText().replace(/\s+/g, ' '));
      }
    }
  }
  return found;
}

/** Slot names the markup actually renders, so an undocumented one can fail. */
function templateSlots(markup) {
  const names = new Set();
  for (const match of markup.matchAll(/<slot\b([^>]*)>/g)) {
    const named = /name=["']([^"']+)["']/.exec(match[1]);
    names.add(named ? named[1] : 'default');
  }
  for (const match of markup.matchAll(
    /Astro\.slots\.has\(['"]([^'"]+)['"]\)/g,
  )) {
    names.add(match[1]);
  }
  return names;
}

function readPart(file) {
  const name = basename(file, '.astro');
  const source = readFileSync(file, 'utf8');
  const head = frontmatter(source);
  const sourceFile = ts.createSourceFile(
    `${name}.ts`,
    head,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  const scope = localDeclarations(sourceFile);
  const declaration =
    scope.interfaces.get('Props') ?? scope.aliases.get('Props');
  if (!declaration) {
    failures.push(`${name}: no Props declaration in the frontmatter.`);
    return null;
  }

  const doc = componentDoc(sourceFile, head);
  if (!doc.summary) failures.push(`${name}: no component doc comment.`);

  const { props, inherited } = members(declaration, head, scope);

  /*
   * `Button` and `Chip` are discriminated on `href`: required in the anchor
   * branch, absent from the other. Reporting it as required would be wrong for
   * half the component, so a prop counts as required only where every branch
   * demands it.
   */
  const branches =
    ts.isTypeAliasDeclaration(declaration) &&
    ts.isUnionTypeNode(declaration.type)
      ? declaration.type.types.map(
          (type) => members({ type }, head, scope).props,
        )
      : [];
  if (branches.length > 1) {
    for (const prop of props) {
      prop.optional = !branches.every((branch) =>
        branch.some((entry) => entry.name === prop.name && !entry.optional),
      );
    }
  }

  const fallbacks = defaults(sourceFile);
  for (const prop of props) {
    prop.default = fallbacks.get(prop.name) ?? '';
    if (!prop.description) {
      failures.push(`${name}.${prop.name}: undocumented prop.`);
    }
  }

  /* Astro's own destructure names the class prop `class`; parts that forward it
     declare it, so anything left over is a default with no prop behind it. */
  for (const key of fallbacks.keys()) {
    if (key !== 'class' && !props.some((prop) => prop.name === key)) {
      failures.push(`${name}: default for \`${key}\`, which is not a prop.`);
    }
  }

  const documented = new Set(doc.slots.map((slot) => slot.name));
  for (const slot of templateSlots(template(source))) {
    if (!documented.has(slot)) {
      failures.push(`${name}: slot \`${slot}\` has no @slot line.`);
    }
  }

  const shapes = [];
  for (const [shapeName, shapeNode] of scope.interfaces) {
    if (shapeName === 'Props') continue;
    const referenced = props.some((prop) =>
      new RegExp(`\\b${shapeName}\\b`).test(prop.raw),
    );
    if (!referenced) continue;
    shapes.push({
      name: shapeName,
      props: members(shapeNode, head, scope).props,
    });
  }
  for (const shape of shapes) {
    for (const prop of shape.props) {
      if (!prop.description) {
        failures.push(
          `${name}.${shape.name}.${prop.name}: undocumented field.`,
        );
      }
    }
  }

  const example = EXAMPLES[name];
  if (!example) failures.push(`${name}: no entry in EXAMPLES.`);

  return { name, doc, props, inherited, shapes, example };
}

/* ----------------------------------------------------------------- rendering */

/** Fences wide enough for a default that is itself a template literal. */
function code(text) {
  const runs = [...text.matchAll(/`+/g)].map((match) => match[0].length);
  const fence = '`'.repeat(Math.max(0, ...runs) + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** A bare `<tag>` outside a code span is JSX to MDX, so it has to be escaped. */
function mdxSafe(text) {
  return text
    .split(/(`+[^`]*`+)/)
    .map((chunk, index) => (index % 2 ? chunk : chunk.replace(/</g, '&lt;')))
    .join('');
}

function cell(text) {
  return mdxSafe(text).replace(/\|/g, '\\|');
}

function propsTable(props) {
  const rows = props.map((prop) => {
    const name = prop.optional ? code(prop.name) : `${code(prop.name)} (req.)`;
    const fallback = prop.default ? code(prop.default) : '--';
    return `| ${name} | ${cell(code(prop.type))} | ${cell(fallback)} | ${cell(prop.description)} |`;
  });
  return [
    '| Prop | Type | Default | Description |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function section(part) {
  const lines = [`## ${part.name}`, ''];
  lines.push(`**Use it for:** ${mdxSafe(part.doc.summary)}`, '');
  lines.push(
    `\`\`\`ts\nimport ${part.name} from '@ambiqai/helia-ui/astro/${part.name}';\n\`\`\``,
    '',
  );

  if (part.props.length > 0) {
    lines.push(propsTable(part.props), '');
  } else {
    lines.push('No props.', '');
  }

  if (part.inherited.length > 0) {
    const list = part.inherited.map((entry) => code(entry)).join(', ');
    lines.push(`Also accepts ${list}.`, '');
  }

  for (const shape of part.shapes) {
    lines.push(`**${shape.name}**`, '', propsTable(shape.props), '');
  }

  if (part.doc.slots.length > 0) {
    lines.push('**Slots**', '');
    for (const slot of part.doc.slots) {
      lines.push(`- ${code(slot.name)} -- ${mdxSafe(slot.description)}`);
    }
    lines.push('');
  } else {
    lines.push('**Slots** -- none.', '');
  }

  const { page, label, anchor } = part.example;
  const href = `${DOCS_BASE}/${page}/${anchor ? `#${anchor}` : ''}`;
  lines.push(`[See it rendered on ${label}](${href})`, '');

  return lines.join('\n');
}

function render(parts) {
  const head = [
    '---',
    'title: Astro part contracts',
    'description: Props, defaults, and slots for every part exported under @ambiqai/helia-ui/astro.',
    '---',
    '',
    '{/* Generated by scripts/astro-props.mjs. Edit the parts, not this file. */}',
    '',
    `Every part exported under \`@ambiqai/helia-ui/astro/*\`, read out of the parts`,
    'themselves: the `Props` interface, the defaults in the destructure, and the',
    'slots each one documents. A part whose contract changes without this page',
    'changing fails `validate`, so what is here is what the package ships.',
    '',
    'Props marked `(req.)` have no default and must be passed. A part that also',
    'lists inherited attributes forwards them to its root element.',
    '',
  ].join('\n');
  return `${head}\n${parts.map(section).join('\n')}`;
}

/* --------------------------------------------------------------------- main */

const files = readdirSync(ASTRO_DIR)
  .filter((entry) => entry.endsWith('.astro'))
  .sort()
  .map((entry) => join(ASTRO_DIR, entry));

const parts = files.map(readPart).filter(Boolean);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} Astro part contract problem${failures.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

const config = await prettier.resolveConfig(OUT_PATH);
const output = await prettier.format(render(parts), {
  ...config,
  filepath: OUT_PATH,
  parser: 'mdx',
});

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    current = '';
  }
  if (current !== output) {
    const scratch = join(
      mkdtempSync(join(tmpdir(), 'helia-astro-props-')),
      'astro-parts.mdx',
    );
    writeFileSync(scratch, output);
    console.error(
      `${OUT_PATH} is out of date.\nGenerated form: ${scratch}\nRun: node packages/helia-ui/scripts/astro-props.mjs`,
    );
    process.exit(1);
  }
  console.log(`astro-props: ${parts.length} parts, reference up to date.`);
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, output);
  console.log(`astro-props: ${parts.length} parts written to ${OUT_PATH}.`);
}
