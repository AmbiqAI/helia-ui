#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Generates the ADR-0005 third-party notices for the deployed site and for the
 * published package.
 *
 *   npm run notices           rewrite the notices files
 *   npm run check:notices     exit 1 when one of them is stale
 *
 * Each root generates the notices its own lockfile determines, and only those:
 * the package's when the package is the root, the site's when the root it is
 * pointed at names itself under `notices` in helia-ui.config.json. Two
 * lockfiles resolve the same ranges to different versions, so a root that
 * regenerated the other's file would overwrite a record of a tree it did not
 * install. The site's notices cover the package's runtime dependencies anyway,
 * because the walk follows first-party links into their dependencies.
 *
 * The walk reads the installed tree in node_modules, following `dependencies`
 * only. Development dependencies are excluded because they do not ship.
 * `optionalDependencies` are excluded because npm installs a different subset
 * of the native binary packages on every build host, and notices that change
 * with the host cannot be checked in CI; the build tooling they belong to is
 * listed through its own parent package. Peer dependencies come from the
 * consuming site, so they are recorded by license name only.
 *
 * License texts are deduplicated by content: MIT and BSD differ per copyright
 * holder, so the distinct texts are reproduced once each with the packages
 * they cover, which keeps the obligation intact without repeating the same
 * paragraph hundreds of times.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { PACKAGE_DIR, ROOT as repoRoot } from './lib/scope.mjs';
import { CONFIG_FILE, INSTALLED, SITE } from './lib/site-config.mjs';

/** Bumped whenever the output shape changes, so a rerun is reproducible. */
const GENERATOR_VERSION = '1.0.0';

/*
 * A site's notices are its own: only the site can say what it is called and
 * what the file covers, so it says both under `notices` in helia-ui.config.json
 * and the walk then reads the lockfile beside them.
 */
const SITE_TARGET = {
  title: SITE.notices.title,
  scope: SITE.notices.scope,
  manifestDir: repoRoot,
  output: join(repoRoot, 'THIRD-PARTY-NOTICES.md'),
};

const PACKAGE_TARGET = {
  title: '@ambiqai/helia-ui',
  scope:
    'the runtime dependency tree of the published package, plus component source derived from shadcn/ui',
  manifestDir: join(repoRoot, PACKAGE_DIR),
  output: join(repoRoot, PACKAGE_DIR, 'THIRD-PARTY-NOTICES.md'),
};

if (INSTALLED && SITE.notices.title === '') {
  console.error(
    `${CONFIG_FILE} at the scan root declares no 'notices.title' and 'notices.scope', ` +
      `and an installed copy of @ambiqai/helia-ui generates the notices of the tree ` +
      `it is pointed at, not its own. Add the file and name the site.`,
  );
  process.exit(1);
}

const TARGETS = SITE.notices.title === '' ? [PACKAGE_TARGET] : [SITE_TARGET];

/**
 * shadcn/ui is not an npm dependency: its parts are copied into the tree and
 * modified, so the obligation travels with our source, not with a lockfile
 * entry. https://github.com/shadcn-ui/ui
 */
const SOURCE_DERIVED = [
  {
    name: 'shadcn/ui',
    license: 'MIT',
    origin: 'https://github.com/shadcn-ui/ui',
    note: 'Parts under the react/ directory of @ambiqai/helia-ui are derived from shadcn/ui source and carry Ambiq modifications.',
    text: `MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  },
];

/** First-party code, covered by the repository LICENSE rather than by notices. */
const FIRST_PARTY = /^@ambiqai\//;

const LICENSE_FILE = /^(licen[cs]e|copying|unlicense)(\.|$)/i;
const IGNORED_LICENSE_FILE = /\.(js|mjs|cjs|ts|json)$/i;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Node resolution: nearest node_modules wins, then walk up. The walk does not
 * stop at the generated root, because the package is installed two ways. Run
 * from its own repository it has a node_modules of its own; run from the hub
 * the same dependencies are hoisted to the workspace root, one level above the
 * package, and a walk bounded by the package would report every one of them
 * missing. Both trees resolve to the same versions or the notices differ
 * between them, which `--check` would catch.
 */
function resolvePackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * `license` has carried three shapes across npm's history and all three are
 * still in the registry, so each is read and the shape recorded as evidence.
 */
function readLicense(manifest) {
  if (typeof manifest.license === 'string') {
    return { id: manifest.license, evidence: 'package.json license field' };
  }
  if (manifest.license && typeof manifest.license.type === 'string') {
    return {
      id: manifest.license.type,
      evidence: 'package.json license object',
    };
  }
  if (Array.isArray(manifest.licenses) && manifest.licenses.length > 0) {
    const ids = manifest.licenses
      .map((entry) => entry.type ?? entry)
      .filter(Boolean);
    return {
      id: ids.join(' OR '),
      evidence: 'package.json licenses array (legacy)',
    };
  }
  return { id: 'UNKNOWN', evidence: 'no license field in package.json' };
}

function readLicenseText(packageDir) {
  const names = readdirSync(packageDir)
    .filter(
      (name) => LICENSE_FILE.test(name) && !IGNORED_LICENSE_FILE.test(name),
    )
    .filter((name) => statSync(join(packageDir, name)).isFile())
    .sort();
  if (names.length === 0) return null;
  const text = names
    // Upstream texts arrive with either line ending, and the repository stores
    // them normalized, so the generator normalizes too or --check fails on a
    // fresh clone.
    .map((name) =>
      readFileSync(join(packageDir, name), 'utf8')
        .replace(/\r\n/g, '\n')
        .trim(),
    )
    .join('\n\n');
  return { file: names.join(', '), text };
}

function repositoryUrl(manifest) {
  const repo = manifest.repository;
  const url = typeof repo === 'string' ? repo : repo?.url;
  if (!url) return null;
  return url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://');
}

function collect(manifestDir) {
  const rootManifest = readJson(join(manifestDir, 'package.json'));
  const packages = new Map();
  const missing = [];
  const queue = Object.keys(rootManifest.dependencies ?? {}).map((name) => ({
    name,
    fromDir: manifestDir,
    optional: name in (rootManifest.optionalDependencies ?? {}),
  }));

  while (queue.length > 0) {
    const { name, fromDir, optional } = queue.shift();
    if (FIRST_PARTY.test(name)) {
      const firstPartyDir = resolvePackageDir(name, fromDir);
      if (firstPartyDir) {
        const manifest = readJson(join(firstPartyDir, 'package.json'));
        for (const dep of Object.keys(manifest.dependencies ?? {})) {
          queue.push({ name: dep, fromDir: firstPartyDir });
        }
      }
      continue;
    }
    const packageDir = resolvePackageDir(name, fromDir);
    if (!packageDir) {
      if (!optional) missing.push(name);
      continue;
    }
    const manifest = readJson(join(packageDir, 'package.json'));
    const key = `${manifest.name}@${manifest.version}`;
    if (packages.has(key)) continue;

    const license = readLicense(manifest);
    const licenseText = readLicenseText(packageDir);
    packages.set(key, {
      key,
      name: manifest.name,
      version: manifest.version,
      license: license.id,
      evidence: license.evidence,
      textFile: licenseText?.file ?? null,
      text: licenseText?.text ?? null,
      repository: repositoryUrl(manifest),
    });

    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      queue.push({
        name: dep,
        fromDir: packageDir,
        optional: dep in (manifest.optionalDependencies ?? {}),
      });
    }
  }

  const peers = [];
  for (const name of Object.keys(rootManifest.peerDependencies ?? {})) {
    const packageDir = resolvePackageDir(name, manifestDir);
    const manifest = packageDir
      ? readJson(join(packageDir, 'package.json'))
      : null;
    peers.push({
      name,
      range: rootManifest.peerDependencies[name],
      license: manifest ? readLicense(manifest).id : 'not installed',
    });
  }

  return {
    packages: [...packages.values()].sort((a, b) => a.key.localeCompare(b.key)),
    peers: peers.sort((a, b) => a.name.localeCompare(b.name)),
    missing: missing.sort(),
  };
}

function fence(text) {
  const longest = (text.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  return '`'.repeat(Math.max(3, longest + 1));
}

function licenseHistogram(packages) {
  const counts = new Map();
  for (const pkg of packages)
    counts.set(pkg.license, (counts.get(pkg.license) ?? 0) + 1);
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
}

function render(target, collected) {
  const { packages, peers } = collected;
  const lines = [];
  lines.push(`# Third-party notices: ${target.title}`);
  lines.push('');
  lines.push(
    `<!-- Generated by third-party-notices.mjs v${GENERATOR_VERSION}. Do not edit by hand; run \`npm run notices\` from the root that owns the lockfile. -->`,
  );
  lines.push('');
  lines.push(
    `This file covers ${target.scope}. Development dependencies are excluded: they do not ship. ` +
      `So are the platform-specific native binary packages declared as optional dependencies of the ` +
      `build tooling, which npm selects per build host; their parent packages are listed below.`,
  );
  lines.push('');
  lines.push(
    `Ambiq-authored code is licensed separately under the BSD 3-Clause License; see LICENSE and NOTICE.`,
  );
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Packages: ${packages.length}`);
  lines.push(
    `- Distinct license identifiers: ${licenseHistogram(packages).length}`,
  );
  for (const [license, count] of licenseHistogram(packages)) {
    lines.push(`  - ${license}: ${count}`);
  }
  lines.push('');

  lines.push('## Source-derived components');
  lines.push('');
  for (const entry of SOURCE_DERIVED) {
    lines.push(`### ${entry.name} (${entry.license})`);
    lines.push('');
    lines.push(entry.note);
    lines.push('');
    lines.push(`Origin: ${entry.origin}`);
    lines.push('');
    const marker = fence(entry.text);
    lines.push(marker);
    lines.push(entry.text);
    lines.push(marker);
    lines.push('');
  }

  lines.push('## Runtime dependencies');
  lines.push('');
  for (const pkg of packages) {
    const parts = [`**${pkg.name}** ${pkg.version} — ${pkg.license}`];
    parts.push(`license from ${pkg.evidence}`);
    parts.push(
      pkg.textFile ? `text from ${pkg.textFile}` : 'no license text bundled',
    );
    if (pkg.repository) parts.push(pkg.repository);
    lines.push(`- ${parts.join(' — ')}`);
  }
  lines.push('');

  if (peers.length > 0) {
    lines.push('## Peer dependencies');
    lines.push('');
    lines.push(
      'Supplied by the consuming site, not distributed with this package. License names only.',
    );
    lines.push('');
    for (const peer of peers) {
      lines.push(`- **${peer.name}** ${peer.range} — ${peer.license}`);
    }
    lines.push('');
  }

  lines.push('## License texts');
  lines.push('');
  lines.push(
    'Each distinct text is reproduced once, with the packages it applies to.',
  );
  lines.push('');

  const byText = new Map();
  for (const pkg of packages) {
    if (!pkg.text) continue;
    const hash = createHash('sha256').update(pkg.text).digest('hex');
    if (!byText.has(hash))
      byText.set(hash, { text: pkg.text, license: pkg.license, packages: [] });
    byText.get(hash).packages.push(pkg.key);
  }
  const groups = [...byText.values()].sort((a, b) =>
    a.packages[0].localeCompare(b.packages[0]),
  );
  for (const group of groups) {
    lines.push(`### ${group.license} — ${group.packages.join(', ')}`);
    lines.push('');
    const marker = fence(group.text);
    lines.push(marker);
    lines.push(group.text);
    lines.push(marker);
    lines.push('');
  }

  const withoutText = packages.filter((pkg) => !pkg.text);
  if (withoutText.length > 0) {
    lines.push('### Packages with no bundled license text');
    lines.push('');
    lines.push(
      'The identifier below is the package metadata as published; no text file travels with the package.',
    );
    lines.push('');
    for (const pkg of withoutText) lines.push(`- ${pkg.key} — ${pkg.license}`);
    lines.push('');
  }

  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

const check = process.argv.includes('--check');
let stale = 0;

for (const target of TARGETS) {
  const collected = collect(target.manifestDir);
  const rendered = render(target, collected);
  const relative = target.output.slice(repoRoot.length + 1);

  if (collected.missing.length > 0) {
    console.error(
      `notices: ${relative}: ${collected.missing.length} declared dependencies are not installed ` +
        `(${collected.missing.join(', ')}). Run \`npm ci\` first.`,
    );
    process.exit(1);
  }

  if (check) {
    const current = existsSync(target.output)
      ? readFileSync(target.output, 'utf8')
      : '';
    if (current !== rendered) {
      console.error(
        `notices: ${relative} is stale. Run \`npm run notices\` and commit the result.`,
      );
      stale += 1;
      continue;
    }
    console.log(
      `check:notices: ${relative} current (${collected.packages.length} packages)`,
    );
    continue;
  }

  writeFileSync(target.output, rendered);
  const histogram = licenseHistogram(collected.packages)
    .map(([license, count]) => `${license}:${count}`)
    .join(' ');
  console.log(
    `notices: wrote ${relative} (${collected.packages.length} packages) ${histogram}`,
  );
}

if (stale > 0) process.exit(1);
