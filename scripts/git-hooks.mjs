#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

export function checkCommitMessage(message) {
  const subject = message.split(/\r?\n/, 1)[0];
  if (
    !/^(feat|fix|docs|refactor|test|chore|build|ci|perf|style|revert)(\([\w./-]+\))?!?: \S/.test(
      subject,
    )
  ) {
    throw new Error(
      'Use a conventional commit subject, for example: fix: preserve reference identifiers.',
    );
  }
  if (/^\s*(Co-authored-by|Generated-with|Signed-off-by):/im.test(message)) {
    throw new Error('Commit messages must not include attribution trailers.');
  }
}

export async function checkStagedFiles(root) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('diff', '--cached', '--check');
  const names = git(
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
  )
    .split('\0')
    .filter(Boolean);
  for (const name of names) {
    const filepath = resolve(root, name);
    const info = await prettier.getFileInfo(filepath, {
      ignorePath: resolve(root, '.prettierignore'),
    });
    if (info.ignored || !info.inferredParser) continue;
    // The index is the commit's input; an unstaged correction must not hide a bad staged file.
    const content = git('show', `:${name}`);
    const config = await prettier.resolveConfig(filepath);
    if ((await prettier.format(content, { ...config, filepath })) !== content) {
      throw new Error(`${name}: format and stage the file before committing.`);
    }
    if (name.endsWith('.mjs')) {
      const result = spawnSync(
        process.execPath,
        ['--check', '--input-type=module'],
        { input: content, encoding: 'utf8' },
      );
      if (result.status !== 0) throw new Error(`${name}: ${result.stderr}`);
    }
  }
}

async function main() {
  const [hook, messagePath] = process.argv.slice(2);
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error('Use Node 24 or newer for repository hooks.');
  if (hook === 'commit-msg') {
    if (!messagePath) throw new Error('commit-msg requires a message file.');
    checkCommitMessage(readFileSync(messagePath, 'utf8'));
  } else if (hook === 'pre-commit') {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim();
    await checkStagedFiles(root);
  } else {
    throw new Error(`Unknown hook: ${hook ?? '(missing)'}.`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
