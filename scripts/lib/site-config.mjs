// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The site layout a check cannot infer.
 *
 * The site-facing checks ship as bins, so they run from an installed copy of
 * the package against a tree the package has never seen. Which directories
 * hold components, which hold islands, and which hold the data an island may
 * not reach for is the site's own arrangement, so the site declares it in
 * `helia-ui.config.json` at the root the check is pointed at. The file is
 * optional: without it the only tree in scope is the package's own, which is
 * what the package's own repository wants.
 *
 * An installed copy has nothing of its own left to check -- its files were
 * fixed at pack time and its repository checked them there -- so `INSTALLED`
 * drops the package trees and leaves the declared ones.
 *
 * Every declared value is a repo-relative directory or file path, so a check
 * reports the same paths whoever runs it and a config cannot reach outside the
 * root it was found in.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { PACKAGE_DIR, ROOT } from './scope.mjs';

export const CONFIG_FILE = 'helia-ui.config.json';

/** True when the package is a dependency of the root rather than part of it. */
export const INSTALLED = PACKAGE_DIR.split('/').includes('node_modules');

/*
 * The whole schema. `paths` fields take a list of repo-relative paths, `text`
 * fields a non-empty string. Anything else in the file is a mistake worth
 * failing on: a misspelled key that was silently ignored would read as a check
 * that passed.
 */
const SCHEMA = {
  styles: {
    sources: 'paths',
    markup: 'paths',
    shell: 'paths',
    tokens: 'paths',
  },
  islands: { pages: 'paths', dirs: 'paths', data: 'paths' },
  spdx: { roots: 'paths' },
  notices: { title: 'text', scope: 'text' },
};

const EMPTY = Object.fromEntries(
  Object.entries(SCHEMA).map(([section, fields]) => [
    section,
    Object.fromEntries(
      Object.entries(fields).map(([field, kind]) => [
        field,
        kind === 'paths' ? [] : '',
      ]),
    ),
  ]),
);

const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const list = (names) => names.map((name) => `'${name}'`).join(', ');

function normalizePath(value, where) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${where} takes a list of non-empty path strings`);
  }
  const clean = value.trim().replace(/\/+$/, '');
  if (clean.includes('\\')) {
    throw new Error(`${where}: '${value}' must use '/' separators`);
  }
  if (path.isAbsolute(clean)) {
    throw new Error(`${where}: '${value}' must be relative to the root`);
  }
  const parts = clean.split('/').filter((part) => part !== '' && part !== '.');
  if (parts.length === 0 || parts.includes('..')) {
    throw new Error(`${where}: '${value}' must stay inside the root`);
  }
  return parts.join('/');
}

/**
 * Validates one config object and fills in the defaults.
 *
 * @param {unknown} raw parsed JSON
 * @param {string} label the file name to name in an error
 * @returns {typeof EMPTY} every section present, absent fields empty
 * @throws {Error} on any key, type or path the schema does not allow
 */
export function parseSiteConfig(raw, label = CONFIG_FILE) {
  if (!isObject(raw)) throw new Error(`${label}: expected a JSON object`);
  const config = structuredClone(EMPTY);
  for (const [section, value] of Object.entries(raw)) {
    // A `$schema` pointer is for the editor, not for us.
    if (section === '$schema') continue;
    const fields = SCHEMA[section];
    if (!fields) {
      throw new Error(
        `${label}: unknown section '${section}'; expected one of ${list(Object.keys(SCHEMA))}`,
      );
    }
    if (!isObject(value)) {
      throw new Error(`${label}: '${section}' must be an object`);
    }
    for (const [field, given] of Object.entries(value)) {
      const kind = fields[field];
      if (!kind) {
        throw new Error(
          `${label}: unknown key '${section}.${field}'; expected one of ${list(Object.keys(fields))}`,
        );
      }
      const where = `${label}: '${section}.${field}'`;
      if (kind === 'text') {
        if (typeof given !== 'string' || given.trim() === '') {
          throw new Error(`${where} takes a non-empty string`);
        }
        config[section][field] = given.trim();
        continue;
      }
      if (!Array.isArray(given)) throw new Error(`${where} takes an array`);
      config[section][field] = given.map((entry) =>
        normalizePath(entry, where),
      );
    }
  }
  // Half a notices header is a file nobody can read: the title names the tree
  // and the scope says what the walk covered.
  const { title, scope } = config.notices;
  if ((title === '') !== (scope === '')) {
    throw new Error(
      `${label}: 'notices' takes both 'title' and 'scope', or neither`,
    );
  }
  return config;
}

/** The config at `root`, the defaults when there is none. Exits 1 on a bad file. */
export function loadSiteConfig(root = ROOT) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file))
    return { ...structuredClone(EMPTY), present: false };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`${CONFIG_FILE}: ${error.message}`);
    process.exit(1);
  }
  try {
    return { ...parseSiteConfig(raw), present: true };
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Stops a check that an installed copy cannot run: nothing of the package's
 * own is in scope and the site has declared nothing either, which would
 * otherwise pass silently and report on an empty scan.
 */
export function requireDeclaration(config, section, fields) {
  if (!INSTALLED) return;
  const declared = fields.some((field) => config[section][field].length > 0);
  if (declared) return;
  console.error(
    `${CONFIG_FILE} at the scan root declares no ${list(fields)} under '${section}', ` +
      `and an installed copy of @ambiqai/helia-ui has no tree of its own to check. ` +
      `Add the file and name the site's own directories.`,
  );
  process.exit(1);
}

export const SITE = loadSiteConfig();
