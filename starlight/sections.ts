// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Which section a path belongs to.
 *
 * The top bar, the route middleware that scopes the sidebar, and the Sidebar
 * override all have to agree on the answer, and they run in three different
 * places, so the rule lives here rather than three times over.
 */

/** A section as the bar and the matcher see it: entries are Starlight's. */
export interface HeliaSectionLink {
  label: string;
  href: string;
  /**
   * Path prefix that marks the section current, for one whose pages do not
   * live under its `href`. Defaults to the `href`.
   */
  match?: string;
  /**
   * `false` for a section that declared no pages: its routes carry no sidebar
   * column, and it is one link rather than an expandable item in the
   * narrow-width menu.
   */
  sidebar?: false;
}

/** A path and a prefix compare with the same trailing slash or not at all. */
const withSlash = (value: string) => value.replace(/\/?$/, '/');

/**
 * The section a path sits in, or `undefined` for a path in none.
 *
 * Longest prefix wins, so a section nested under another one takes its own
 * pages; ties go to the earlier section. A prefix that is the site base is the
 * exception: every path on the site starts with the base, so a Home section
 * matches the landing page alone rather than the whole site.
 */
export function matchSection<T extends HeliaSectionLink>(
  sections: readonly T[],
  pathname: string,
  base: string,
): T | undefined {
  const path = withSlash(pathname);
  const root = withSlash(base);
  let current: T | undefined;
  let length = 0;

  for (const section of sections) {
    const prefix = withSlash(section.match ?? section.href);
    const matches = prefix === root ? path === root : path.startsWith(prefix);
    if (!matches || prefix.length <= length) continue;
    current = section;
    length = prefix.length;
  }

  return current;
}
