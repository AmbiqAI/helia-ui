// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * What is known about each charting candidate, as opposed to what is visible
 * on the page.
 *
 * Licence and version are the installed package's own, read from
 * node_modules; the byte figure is the island's share of the built page,
 * summed from the dist chunks the page loads for that island and reported
 * minified rather than compressed, because it is the parse cost that differs
 * between these three. Re-measure with `npm run docs:build` and read the
 * chunk sizes Astro prints. Both move with the pinned range, so they are
 * stated next to the version they were taken from.
 */

export interface ChartCandidate {
  id: string;
  /** How the library is referred to in prose. */
  name: string;
  /** The specifier the island imports. */
  pkg: string;
  version: string;
  licence: string;
  /** Minified JavaScript the page loads for this island, in bytes. */
  bytes: number;
  /** What the server render contains. */
  serverRender: string;
  /** What it takes to put the library in the site's colours and type. */
  theming: string;
}

export const candidates: ChartCandidate[] = [
  {
    id: 'mui',
    name: 'MUI X Charts',
    pkg: '@mui/x-charts',
    version: '9.13.0',
    licence: 'MIT',
    bytes: 497604,
    serverRender:
      'In part. The surface and the legend are in the HTML; the marks wait to be measured.',
    theming:
      'Colours are props, gridlines need an sx rule, and the rest is MUI theme defaults.',
  },
  {
    id: 'recharts',
    name: 'Recharts',
    pkg: 'recharts',
    version: '3.8.0',
    licence: 'MIT',
    bytes: 408383,
    serverRender:
      'No. ResponsiveContainer has nothing to measure, so the HTML holds an empty container.',
    theming:
      'Every colour is a prop on the element that draws it, and there is no theme to override.',
  },
  {
    id: 'plot',
    name: 'Observable Plot',
    pkg: '@observablehq/plot',
    version: '0.6.17',
    licence: 'ISC',
    bytes: 300935,
    serverRender:
      'No. Plot.plot builds against a document, so the island is client only.',
    theming: 'One colour scale and one style object per figure.',
  },
];

/** Bytes as the table prints them. */
export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024).toLocaleString('en-GB')} KB`;
}
