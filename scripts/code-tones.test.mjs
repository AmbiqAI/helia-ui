// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heliaStarlight } from '../starlight/index.ts';

function configuredCode(code, expressiveCode) {
  let result;
  heliaStarlight({ code }).hooks['config:setup']({
    config: { title: 'Fixture', expressiveCode },
    addIntegration: () => {},
    addRouteMiddleware: () => {},
    updateConfig: (config) => {
      result = config.expressiveCode;
    },
  });
  return result;
}

test('muted site defaults reach Markdown editor and terminal frames', () => {
  const frames = configuredCode({ tone: 'muted' }).styleOverrides.frames;
  assert.equal(frames.editorBackground, 'var(--helia-surface-card-muted)');
  assert.equal(frames.terminalBackground, 'var(--helia-surface-card-muted)');
  const defaults = configuredCode(true).styleOverrides.frames;
  assert.notEqual(defaults.editorBackground, frames.editorBackground);
  assert.notEqual(defaults.terminalBackground, frames.terminalBackground);
  assert.deepEqual(configuredCode({ tone: 'default' }), configuredCode(true));
});

test('explicit site overrides and code opt-outs retain precedence', () => {
  const code = configuredCode(
    { tone: 'muted' },
    {
      styleOverrides: {
        frames: { editorBackground: '#123456', terminalBackground: '#abcdef' },
        borderRadius: '0px',
      },
    },
  );
  assert.equal(code.styleOverrides.frames.editorBackground, '#123456');
  assert.equal(code.styleOverrides.frames.terminalBackground, '#abcdef');
  assert.equal(code.styleOverrides.borderRadius, '0px');
  assert.equal(configuredCode({ tone: 'muted' }, false), false);
  assert.equal(configuredCode(false, false), false);
});
