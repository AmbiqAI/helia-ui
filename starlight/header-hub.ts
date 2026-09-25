// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The link back to the Dev Hub, which the bar draws above the collapse point
 * and the narrow-width menu below it. Both draw the same wording with the same
 * word picked out, so the wording is read apart here rather than twice over.
 */

/** The link back to the Dev Hub, at the end of the bar. */
export interface HeliaHeaderHub {
  /**
   * The destination label. Defaults to `HELIA DEV HUB`.
   */
  label?: string;
  href: string;
}

/** The wording a site that named none gets. */
export const HUB_LABEL = 'HELIA DEV HUB';

/** `null` for a site that named no hub link, which is most of the option. */
export function resolveHub(
  hub: HeliaHeaderHub | undefined,
): { label: string; href: string } | null {
  return hub ? { label: hub.label ?? HUB_LABEL, href: hub.href } : null;
}

/** One run of the label: `accent` marks the name the family is known by. */
export interface HubLabelPart {
  text: string;
  accent: boolean;
}

/**
 * The label in runs, so the family's name carries the product accent and the
 * rest of the line stays quiet. A label that does not say HELIA is the
 * accented run itself: something in the line has to name what it links to.
 */
export function hubLabelParts(label: string): HubLabelPart[] {
  const runs = label.split(/\b(HELIA)\b/).filter((text) => text !== '');
  if (runs.length < 2) return [{ text: label, accent: true }];
  return runs.map((text) => ({ text, accent: text === 'HELIA' }));
}
