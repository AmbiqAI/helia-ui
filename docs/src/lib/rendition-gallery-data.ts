// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The model behind the "from a model" examples.
 *
 * Not one of these strings is written in gallery.mdx, which is the whole point
 * of them: the page's Markdown rendition is reduced from that source, so it can
 * only carry this text if the parts state it themselves at build time. The
 * docs build asserts exactly that. See AmbiqAI/helia-ui#167.
 */
import type { AsciiTerminalLine } from '@ambiqai/helia-ui/astro/AsciiTerminal';

export interface GalleryEntry {
  href: string;
  title: string;
  description: string;
}

export const modelCard: GalleryEntry = {
  href: '/helia-ui/cards/',
  title: 'Cards from a model',
  description: 'Every word of this card comes from a record the page imports.',
};

export const modelGuide: GalleryEntry = {
  href: '/helia-ui/foundations/',
  title: 'Foundations from a model',
  description: 'The header carries the link and the body carries the line.',
};

export const modelAction = {
  href: '/helia-ui/starlight-plugin/discoverability/',
  label: 'Read the discoverability guide',
};

export const modelTranscript: AsciiTerminalLine[] = [
  { kind: 'command', text: 'npm run docs:build' },
  { kind: 'muted', text: 'Reading what the parts stated' },
  { kind: 'output', text: '  ROUTES    26' },
  { kind: 'success', text: 'renditions written' },
];
