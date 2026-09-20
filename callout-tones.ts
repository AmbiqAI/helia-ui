// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The callout vocabulary as data: which icon a tone draws, whether it
 * interrupts, and the geometry of the icon itself.
 *
 * `Callout.astro` renders this and the Starlight plugin's markdown transform
 * builds the same markup from it, so an aside written as `:::note` and one
 * written as the component cannot drift apart. The icon is described once as
 * attributes and path data rather than taken from FontAwesome's own renderer,
 * because the transform needs element nodes and `set:html` needs a string, and
 * only a shared description makes the two byte-identical.
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

interface CalloutToneDefinition {
  icon: IconDefinition;
  /**
   * `alert` is announced as soon as it renders. Only `critical` earns it: it
   * is the one tone that means the reader loses something by reading past it.
   */
  role: 'alert' | 'note';
}

export const CALLOUT_TONES = {
  note: { icon: faCircleInfo, role: 'note' },
  tip: { icon: faArrowRight, role: 'note' },
  /* Distinct from tip: tip is a suggestion, success is a step that finished. */
  success: { icon: faCircleCheck, role: 'note' },
  important: { icon: faCircleExclamation, role: 'note' },
  warning: { icon: faTriangleExclamation, role: 'note' },
  critical: { icon: faTriangleExclamation, role: 'alert' },
  compatibility: { icon: faLink, role: 'note' },
  experimental: { icon: faCodeBranch, role: 'note' },
  deprecated: { icon: faClockRotateLeft, role: 'note' },
} as const satisfies Record<string, CalloutToneDefinition>;

export type CalloutTone = keyof typeof CALLOUT_TONES;

/**
 * The tone's icon and role.
 *
 * An unknown tone falls back to `note` rather than failing: MDX hands the prop
 * through as an unchecked string, so a typo in a page would otherwise take the
 * whole build down.
 */
export const calloutDefinition = (tone: CalloutTone): CalloutToneDefinition =>
  CALLOUT_TONES[tone] ?? CALLOUT_TONES.note;

/** The classes that make an element the callout recipe, without the surface. */
export const calloutClasses = (tone: CalloutTone): string[] => [
  'helia-callout',
  `helia-callout--${tone}`,
];

export interface CalloutIconSvg {
  /** `<svg>` attributes, written as they are spelled in the markup. */
  attributes: Record<string, string>;
  /** One `d` per `<path>`; FontAwesome ships several for a layered glyph. */
  paths: string[];
}

export function calloutIcon(tone: CalloutTone): CalloutIconSvg {
  const [width, height, , , pathData] = calloutDefinition(tone).icon.icon;
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
