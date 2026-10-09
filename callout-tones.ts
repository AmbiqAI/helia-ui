// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The callout vocabulary as data: which icon a tone draws, and the geometry of
 * the icon itself.
 *
 * `Callout.astro` renders this and the Starlight plugin's markdown transform
 * builds the same markup from it, so an aside written as `:::note` and one
 * written as the component cannot drift apart. The icon is described once as
 * attributes and path data rather than taken from FontAwesome's own renderer,
 * because the transform needs element nodes and `set:html` needs a string, and
 * only a shared description makes the two identical.
 */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowRight,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faClockRotateLeft,
  faCodeBranch,
  faLink,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

/*
 * Written out rather than derived from the table below, because the props
 * reference inlines the alias and a reader of that page wants the tones, not
 * `keyof typeof`. The `Record` keeps the two in step: a tone added here and
 * nowhere else does not type-check, and neither does the reverse.
 */
export type CalloutTone =
  | 'note'
  | 'tip'
  | 'success'
  | 'important'
  | 'warning'
  | 'critical'
  | 'compatibility'
  | 'experimental'
  | 'deprecated';

export const CALLOUT_ICONS: Record<CalloutTone, IconDefinition> = {
  note: faCircleInfo,
  tip: faArrowRight,
  /* Distinct from tip: tip is a suggestion, success is a step that finished. */
  success: faCircleCheck,
  important: faCircleExclamation,
  warning: faTriangleExclamation,
  critical: faTriangleExclamation,
  compatibility: faLink,
  experimental: faCodeBranch,
  deprecated: faClockRotateLeft,
};

/**
 * The tone, or `note` when it is not one.
 *
 * Takes a string rather than a tone: MDX and frontmatter hand the prop through
 * unchecked, which is the case this exists for, and a narrower parameter would
 * make the guard unreachable and the call a type error. A typo falls back
 * rather than taking the build down. Every use of the tone goes through
 * here, so the icon and the class cannot disagree about which tone it is.
 * `check:callout-tones` fails the build on a typo that reaches a page in this
 * repository, so the fallback is for a consumer's content rather than ours.
 */
export const resolveTone = (tone: string): CalloutTone =>
  Object.hasOwn(CALLOUT_ICONS, tone) ? (tone as CalloutTone) : 'note';

/** The classes that make an element the callout recipe, without the surface. */
export const calloutClasses = (tone: CalloutTone): string[] => [
  'helia-callout',
  `helia-callout--${resolveTone(tone)}`,
];

export interface CalloutIconSvg {
  /** `<svg>` attributes, written as they are spelled in the markup. */
  attributes: Record<string, string>;
  /** One `d` per `<path>`; FontAwesome ships several for a layered glyph. */
  paths: string[];
}

export function calloutIcon(tone: CalloutTone): CalloutIconSvg {
  const [width, height, , , pathData] = CALLOUT_ICONS[resolveTone(tone)].icon;
  return {
    attributes: {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${width} ${height}`,
      fill: 'currentColor',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    paths: Array.isArray(pathData) ? [...pathData] : [pathData],
  };
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** The same SVG as a string, for the `set:html` the component renders it with. */
export function calloutIconMarkup(tone: CalloutTone): string {
  const { attributes, paths } = calloutIcon(tone);
  const attrs = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
  const children = paths
    .map((d) => `<path d="${escapeAttribute(d)}"></path>`)
    .join('');
  return `<svg${attrs}>${children}</svg>`;
}
