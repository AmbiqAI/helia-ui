#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Fails when a style block reintroduces a literal that belongs in the token
 * layer. The scales live in packages/helia-ui/semantic.css and the primitives
 * in packages/helia-ui/tokens.css; see docs/design-system.md for the tables and
 * for the escape syntax.
 *
 * Scope: <style> blocks in src/components (recursively), src/styles, and the
 * stylesheets of packages/helia-ui. Literals are allowed in tokens.css and in
 * custom property declarations on a bare :root selector in the files that
 * define tokens, which is where the scales are defined. React islands are out
 * of scope; they carry their own MUI palette.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  IGNORED_DIRS,
  PACKAGE_DIR,
  ROOT,
  WORKSPACE,
  isUnder,
  joinRel,
  pkg,
} from './lib/scope.mjs';

const BREAKPOINTS = new Set(['42rem', '62rem', '72rem']);
const DOCS_DIR = pkg('docs/src');
const PRIMITIVES_FILE = pkg('tokens.css');

// Starlight owns the page frame, so these files still need the escape hatches.
// The package recipes are not shell: they render into markup we own.
const SHELL_FILES = new Set([
  'src/components/Header.astro',
  'src/components/Sidebar.astro',
  'src/components/PageTitle.astro',
  pkg('starlight/Footer.astro'),
  pkg('starlight/ThemeMenu.astro'),
  pkg('starlight.css'),
  // Mermaid bakes an id-scoped palette into every SVG it emits, so the sheet
  // that maps those diagrams onto the tokens is an override of a foreign frame
  // in the same way the Starlight skins are.
  pkg('mermaid.css'),
  // Site-title color and the markdown margins the catalog grids sit in are
  // both Starlight's frame, reached from the hub's own sheet.
  'src/styles/site.css',
]);

// Where a bare :root selector is the definition of a scale rather than a use of
// one, so a literal in a custom property is the point.
// A site theme file is nothing but a bare :root block of dials, so a hue or a
// font stack written there is the point in the same way a scale is here.
const TOKEN_DEFINITION_FILES = new Set([
  pkg('semantic.css'),
  pkg('site-theme.css'),
  pkg('docs/src/styles/site-theme.css'),
  'src/styles/site.css',
  'src/styles/site-theme.css',
]);

/*
 * Where a scale may be defined. `:root` is the document's own; the attribute
 * and the class are the theme-scope hooks, where semantic.css repeats the
 * compositions so a dial set on a wrapper reaches the subtree under it.
 */
const TOKEN_SELECTOR =
  /^(:root(\[[^\]]*\])?|\[data-helia-theme\]|\.helia-theme-scope)$/;

const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/;
const SPACING_PROPERTY =
  /^(padding|margin|gap|row-gap|column-gap|inset)(-(block|inline|top|right|bottom|left|start|end))*$/;

/*
 * Motion. A duration written as a literal is a step nobody can reach: it is
 * off the three-step scale, and it survives `--helia-motion-scale: 0`, which
 * is what the reduced-motion block in semantic.css gives a visitor who asks
 * for no movement. Easings are a scale of one for the same reason.
 *
 * Scope is the package sheets, where the scale is defined and where every
 * consumer inherits it; a site's own components are swept on their own.
 */
const MOTION_PROPERTY = /^(transition|animation)(-[a-z-]+)?$/;
const DURATION_LITERAL = /(?<![\w.-])\d*\.?\d+m?s(?![\w-])/;
const EASING_LITERAL =
  /cubic-bezier\([^)]*\)|(?<![\w-])(?:ease(?:-in)?(?:-out)?|linear)(?![\w-])/;
const OFFSET_PROPERTY = /^(top|right|bottom|left)$/;
const RULES = [
  'arbitrary',
  'color',
  'font-size',
  'font-weight',
  'font',
  'border-radius',
  'line-height',
  'letter-spacing',
  'motion',
  'media',
  'spacing',
  'offset',
  'z-index',
  'opacity',
  'important',
  'global',
];

function collectFiles(dir) {
  const files = [];
  for (const entry of fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = joinRel(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(rel));
    } else if (entry.name.endsWith('.astro') || entry.name.endsWith('.css')) {
      files.push(rel);
    }
  }
  return files;
}

/** Style source lines with their original line numbers. */
function styleLines(rel, source) {
  const lines = source.split('\n');
  if (!rel.endsWith('.astro'))
    return lines.map((text, i) => ({ text, line: i + 1 }));
  const out = [];
  let inStyle = false;
  lines.forEach((text, i) => {
    if (/<style[^>]*>/.test(text)) {
      inStyle = true;
      return;
    }
    if (/<\/style>/.test(text)) {
      inStyle = false;
      return;
    }
    if (inStyle) out.push({ text, line: i + 1 });
  });
  return out;
}

/**
 * Logical statements, so a declaration Prettier wrapped over several lines is
 * checked as one value. Each statement carries the line it starts on.
 *
 * Comments are removed before the split because the delimiters below are
 * structural: a `;` or a `{` in prose would flush mid-declaration and leave the
 * tracked selector pointing at the wrong rule for the rest of the file.
 */
function statements(lines) {
  const out = [];
  let buffer = '';
  let start = 0;
  let inComment = false;
  const flush = (kind) => {
    const text = buffer.trim();
    if (text !== '') out.push({ kind, text, line: start });
    buffer = '';
    start = 0;
  };
  for (const { text, line } of lines) {
    const escape =
      /\/\*\s*style-lint:\s*(allow-file|allow)\s+([a-z-]+)\s+--\s*(.+?)\s*\*\//.exec(
        text,
      );
    if (escape && !inComment && buffer.trim() === '') {
      out.push({
        kind: 'escape',
        scope: escape[1],
        rule: escape[2],
        reason: escape[3],
        line,
      });
      continue;
    }
    let code = '';
    for (let i = 0; i < text.length; i += 1) {
      if (inComment) {
        if (text[i] === '*' && text[i + 1] === '/') {
          inComment = false;
          i += 1;
        }
        continue;
      }
      if (text[i] === '/' && text[i + 1] === '*') {
        inComment = true;
        i += 1;
        continue;
      }
      code += text[i];
    }
    for (const char of code) {
      if (buffer.trim() === '' && char.trim() !== '') start = line;
      buffer += char;
      if (char === '{') flush('selector');
      else if (char === '}') flush('close');
      else if (char === ';') flush('declaration');
    }
    buffer += '\n';
  }
  flush('declaration');
  return out;
}

const violations = [];
const notes = [];

for (const rel of [
  ...(WORKSPACE
    ? [...collectFiles('src/components'), ...collectFiles('src/styles')]
    : []),
  ...collectFiles(PACKAGE_DIR),
]) {
  if (rel === PRIMITIVES_FILE) continue;
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const isShell = SHELL_FILES.has(rel);
  const definesTokens = TOKEN_DEFINITION_FILES.has(rel);
  const inPackage = isUnder(rel, PACKAGE_DIR);

  const fileAllows = new Map();
  let pending = null;
  let selector = '';
  let seenSelector = false;

  for (const item of statements(styleLines(rel, source))) {
    if (item.kind === 'escape') {
      if (!RULES.includes(item.rule)) {
        violations.push(
          `${rel}:${item.line} escape: unknown rule '${item.rule}'`,
        );
      } else if (item.scope === 'allow-file') {
        if (seenSelector) {
          violations.push(
            `${rel}:${item.line} escape: allow-file must come before the first selector`,
          );
        } else {
          fileAllows.set(item.rule, {
            reason: item.reason,
            count: 0,
            line: item.line,
          });
        }
      } else if (!seenSelector) {
        violations.push(
          `${rel}:${item.line} escape: line-scope allow before the first selector; use allow-file`,
        );
      } else {
        pending = item.rule;
      }
      continue;
    }

    const { kind, text, line } = item;
    const allowed = (rule) => {
      const fileAllow = fileAllows.get(rule);
      if (fileAllow) {
        fileAllow.count += 1;
        return true;
      }
      return pending === rule;
    };
    const report = (rule, detail) => {
      if (!allowed(rule)) violations.push(`${rel}:${line} ${rule}: ${detail}`);
    };

    if (kind === 'selector') {
      seenSelector = true;
      selector = text.replace(/\{$/, '').trim();
      // Escaping the scope is the shell's job. Everywhere else it is either a
      // theme value that belongs in the token layer or markup the component
      // does not own, and the latter has to say so.
      if (!isShell && selector.includes(':global('))
        report('global', 'escapes the component scope outside the shell');
      if (selector.startsWith('@media')) {
        for (const value of selector.matchAll(/([\d.]+rem)/g)) {
          if (!BREAKPOINTS.has(value[1]))
            report('media', `${value[1]} is not one of 42rem, 62rem, 72rem`);
        }
      }
    }

    // Literals are the point only where the scales are defined: a
    // token-definition file, in a block whose every selector is either :root or
    // one of the theme-scope hooks semantic.css re-derives the dials on. No
    // descendant part, so a use of a scale can never pass as a definition.
    const tokenBlock =
      definesTokens &&
      selector
        .split(',')
        .every((part) => TOKEN_SELECTOR.test(part.trim().replace(/\{$/, '')));

    if (kind === 'declaration') {
      const color = COLOR.exec(text);
      if (color && !tokenBlock) report('color', `${color[0]} is not a token`);

      const declaration = /^\s*(--)?([a-z-]+)\s*:\s*([\s\S]+);$/.exec(text);
      if (declaration) {
        const [, custom, property, rawValue] = declaration;
        const value = rawValue.replace(/\s+/g, ' ').trim();
        const bare = value.replace(/\s*!important$/, '');

        if (!custom) {
          if (property === 'font-size' && !/^(var\(|inherit$)/.test(bare)) {
            report('font-size', `${bare} is not a token`);
          }
          if (
            property === 'font-weight' &&
            !/^(var\(|inherit$|normal$|bold$)/.test(bare)
          ) {
            report('font-weight', `${bare} is not a token`);
          }
          if (property === 'font' && !/^(inherit$|var\()/.test(bare)) {
            report(
              'font',
              `use the individual font properties with tokens, not the shorthand`,
            );
          }
          if (/^border(-[a-z]+)*-radius$/.test(property)) {
            if (!/^(var\(|0$)/.test(bare) && !bare.includes('%')) {
              report('border-radius', `${bare} is not a token`);
            }
          }
          if (SPACING_PROPERTY.test(property)) {
            for (const part of splitValue(bare)) {
              if (!spacingAllowed(part))
                report(
                  'spacing',
                  `${part} in '${property}: ${bare}' is not a token`,
                );
            }
          }
        }

        /*
         * The rules below take the same scope as motion, and for the same
         * reason: the scales are defined in the package sheets, every consumer
         * inherits them, and a site's own components are swept on their own.
         *
         * Leading and tracking follow the font-size rule in accepting any
         * `var()`, because a recipe property is a hook whose fallback is the
         * token. Stacking and fade name their families outright: neither has a
         * hook form, and a z-index only means anything against the other
         * z-indexes in its stacking context, so a free number there is a layer
         * nobody else can sort against. 0 and 1 stay literal for opacity and 1
         * for leading: those are absence and presence, not steps on a scale.
         */
        if (inPackage && !tokenBlock) {
          const duration = DURATION_LITERAL.exec(bare);
          if (duration) report('motion', `${duration[0]} is not a token`);
          if (!custom && MOTION_PROPERTY.test(property)) {
            const easing = EASING_LITERAL.exec(bare);
            if (easing) report('motion', `${easing[0]} is not a token`);
          }
          if (!custom) {
            if (
              property === 'line-height' &&
              !/^(var\(|1$|normal$|inherit$)/.test(bare)
            ) {
              report('line-height', `${bare} is not a token`);
            }
            if (
              property === 'letter-spacing' &&
              !/^(var\(|normal$|inherit$)/.test(bare)
            ) {
              report('letter-spacing', `${bare} is not a token`);
            }
            if (
              property === 'z-index' &&
              !/^(auto$|var\(--helia-layer-)/.test(bare)
            ) {
              report('z-index', `${bare} is not a layer token`);
            }
            if (
              property === 'opacity' &&
              !/^(0$|1$|var\(--helia-opacity-)/.test(bare)
            ) {
              report('opacity', `${bare} is not a token`);
            }
            if (OFFSET_PROPERTY.test(property) && !spacingAllowed(bare)) {
              report('offset', `${bare} in '${property}' is not a token`);
            }
          }
        }
      }
    }

    if (!isShell && text.includes('!important'))
      report('important', 'outside the shell overrides');

    if (kind === 'declaration' || kind === 'selector' || kind === 'close')
      pending = null;
  }

  for (const [rule, allow] of fileAllows) {
    notes.push(
      `${rel}:${allow.line} allow-file ${rule} suppressed ${allow.count} check(s) -- ${allow.reason}`,
    );
  }
}

/*
 * Tailwind arbitrary values reopen exactly the hole the rules above close:
 * `p-[13px]` is a literal that no token owns, and it passes every check that
 * only reads <style> blocks. The scale is the contract, so a value that is not
 * on it has to become one before it can be used.
 *
 * Scope is class attributes in markup, which is where utilities are written.
 * Interpolations are stripped first so an index expression in a template
 * literal is not mistaken for a bracket.
 */
/*
 * packages/helia-ui/react is generated: `shadcn add` writes those files and
 * rewrites them on the next add, so an escape comment placed in one does not
 * survive. The arbitrary-value rule exists to stop a hand-written literal that
 * no token owns; a vendored file is not hand-written, and its variants are how
 * the upstream component is expressed rather than a value choice. The
 * suppression is counted and printed below so it stays visible, and it stops at
 * that directory: src/components/islands is hand-authored and fully in scope.
 *
 * What keeps this honest is the theme bridge, not this exemption. Those class
 * strings resolve against packages/helia-ui/shadcn.css, so a shadcn size or color
 * still comes from a hub token or it does not render at all.
 */
const GENERATED_DIR = `${pkg('react')}/`;

const MARKUP = ['.astro', '.mdx', '.tsx'];
const CLASS_ATTRIBUTE =
  /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
const ARBITRARY = /(?:^|\s)(\S*\[[^\]\s]*\]\S*)/g;
const ALLOW_ARBITRARY = /style-lint:\s*allow\s+arbitrary\s+--\s*\S/;

function collectMarkup(dir) {
  const files = [];
  for (const entry of fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = joinRel(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...collectMarkup(rel));
    } else if (MARKUP.some((ext) => entry.name.endsWith(ext))) files.push(rel);
  }
  return files;
}

let generatedSuppressed = 0;

for (const rel of [
  ...(WORKSPACE ? collectMarkup('src') : []),
  ...collectMarkup(pkg('react')),
  ...collectMarkup(DOCS_DIR),
]) {
  const generated = rel.startsWith(GENERATED_DIR);
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const lines = source.split('\n');
  for (const attribute of source.matchAll(CLASS_ATTRIBUTE)) {
    const raw = attribute[1] ?? attribute[2] ?? attribute[3] ?? '';
    const offset = attribute.index + attribute[0].indexOf(raw);
    const value = raw.replace(/\$\{[^}]*\}/g, ' ');
    for (const token of value.matchAll(ARBITRARY)) {
      if (generated) {
        generatedSuppressed += 1;
        continue;
      }
      const line = source.slice(0, offset + token.index).split('\n').length;
      const escaped =
        ALLOW_ARBITRARY.test(lines[line - 1]) ||
        (line > 1 && ALLOW_ARBITRARY.test(lines[line - 2]));
      if (!escaped) {
        violations.push(
          `${rel}:${line} arbitrary: ${token[1]} is not on the scale`,
        );
      }
    }
  }
}

/** Split a shorthand into parts without breaking calc()/clamp()/var(). */
function splitValue(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ' ' && depth === 0) {
      if (current !== '') parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current !== '') parts.push(current);
  return parts;
}

function spacingAllowed(part) {
  if (/^(0|auto|inherit|initial|unset|revert|normal)$/.test(part)) return true;
  if (/^-?[\d.]+%$/.test(part)) return true;
  if (/^var\(--helia-space-(px|\d)\)$/.test(part)) return true;
  // A recipe property is a hook rather than a value. What renders when nobody
  // sets it is the fallback, so the fallback is what has to be on the scale --
  // the same reading the font-size rule already takes.
  const hook = /^var\(\s*--[a-z0-9-]+\s*,\s*([\s\S]+)\)$/.exec(part);
  if (hook) return spacingAllowed(hook[1].trim());
  // Starlight owns the page frame measurements the shell has to line up with.
  if (/^var\(--sl-[a-z0-9-]+\)$/.test(part)) return true;
  // Fluid section rhythm is a clamp, not a step; calc has to build on a token.
  if (/^(clamp|min|max)\(/.test(part)) return true;
  if (/^calc\(/.test(part)) return /var\(--|clamp\(|min\(|max\(/.test(part);
  return false;
}

if (generatedSuppressed > 0) {
  notes.push(
    `${GENERATED_DIR} generated: arbitrary rule skipped ${generatedSuppressed} time(s) -- shadcn writes these files and rewrites them on the next add`,
  );
}

for (const note of notes) console.log(`style-lint: ${note}`);
for (const message of violations) console.error(message);

if (violations.length) {
  console.error(`\n${violations.length} style literal violation(s).`);
  process.exit(1);
}

console.log('check:styles - no style literals outside the token layer');
