// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The `sections` option's half of the navigation: the left sidebar carries the
 * current section's pages and nothing else, and the narrow-width menu carries
 * every section with its pages under it.
 *
 * The entries are not resolved here. The plugin appends one top-level group
 * per section to the site's `sidebar` config, so Starlight resolves them the
 * way it resolves every other group -- `autogenerate` walked, slugs turned
 * into labels and hrefs, `isCurrent` set -- and this middleware only has to
 * pick one of the resolved groups out of the route's sidebar and hand its
 * entries back as the whole sidebar. Starlight exports no helper that builds
 * entries from a sidebar config at request time (`getSidebarFromConfig` is
 * behind the package's exports map), and going around that is what this
 * arrangement avoids.
 *
 * The appended groups are the last ones in the array, in the order the
 * sections were declared, because that is how the plugin appended them; a
 * mismatch means something else rewrote the sidebar, and the route keeps
 * Starlight's own rather than a half-applied one. A section that declared
 * `sidebar: false` appended none, so it is left out of the comparison.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import config from 'virtual:helia-ui/starlight-config';

import { matchSection, type HeliaSectionLink } from './sections';

type SidebarEntry = StarlightRouteData['sidebar'][number];

/**
 * A section with no pages, as one entry of the narrow-width menu: the section
 * is still somewhere to go, so it is a link where the others are groups.
 */
function sectionLink(
  section: HeliaSectionLink,
  isCurrent: boolean,
): SidebarEntry {
  return {
    type: 'link',
    label: section.label,
    href: section.href,
    isCurrent,
    badge: undefined,
    attrs: {},
  };
}

export const onRequest = defineRouteMiddleware((context) => {
  const sections = config.sections;
  if (sections.length === 0) return;

  const route = context.locals.starlightRoute;
  const paned = sections.filter((section) => section.sidebar !== false);
  const split = route.sidebar.length - paned.length;
  if (split < 0) return;

  const appended = route.sidebar.slice(split);
  const aligned = appended.every(
    (entry, index) =>
      entry.type === 'group' && entry.label === paned[index]?.label,
  );
  if (!aligned) return;

  const current = matchSection(
    sections,
    context.url.pathname,
    import.meta.env.BASE_URL,
  );

  if (!current) {
    /* A page in no section keeps the sidebar the site would have had without
       the option, at every width: the sections are not where it is read from,
       so the narrow-width menu is not a list of them either. A site that
       declared no sidebar has only the sections, and an empty pane there would
       be worse than all of them. */
    const own = route.sidebar.slice(0, split);
    if (own.length > 0) route.sidebar = own;
    return;
  }

  /*
   * The whole navigation, for the menu the header's button opens: below the
   * bar's collapse point the sections are nowhere else on the page. Every
   * section is collapsed but the current one, so the menu opens as a list of
   * sections rather than as the site's every page.
   */
  context.locals.heliaSectionNav = sections.map((section) => {
    const group = appended[paned.indexOf(section)];
    if (group?.type !== 'group') {
      return sectionLink(section, section === current);
    }
    return { ...group, collapsed: section !== current };
  });

  if (current.sidebar === false) {
    /*
     * No pane, and the layout column with it: the Sidebar override marks the
     * route so the frame gives the width back to the content, which is what
     * `sidebar: 'always'` cannot be allowed to undo. The flag stays set all
     * the same, because the pane is also the menu the narrow-width button
     * opens, and a route without one has nothing for the button to open.
     */
    route.hasSidebar = true;
    route.sidebar = [];
    return;
  }

  const group = appended[paned.indexOf(current)];
  if (group?.type === 'group') route.sidebar = group.entries;
});
