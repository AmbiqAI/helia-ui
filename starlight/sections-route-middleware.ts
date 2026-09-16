// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The `sections` option's half of the navigation: the left sidebar carries the
 * current section's pages and nothing else.
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
 * Starlight's own rather than a half-applied one.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import config from 'virtual:helia-ui/starlight-config';

import { matchSection } from './sections';

export const onRequest = defineRouteMiddleware((context) => {
  const sections = config.sections;
  if (sections.length === 0) return;

  const route = context.locals.starlightRoute;
  const split = route.sidebar.length - sections.length;
  if (split < 0) return;

  const appended = route.sidebar.slice(split);
  const aligned = appended.every(
    (entry, index) =>
      entry.type === 'group' && entry.label === sections[index]?.label,
  );
  if (!aligned) return;

  const current = matchSection(
    sections,
    context.url.pathname,
    import.meta.env.BASE_URL,
  );

  if (!current) {
    /* A page in no section keeps the sidebar the site would have had without
       the option. A site that declared none has only the sections, and an
       empty pane there would be worse than all of them. */
    const own = route.sidebar.slice(0, split);
    if (own.length > 0) route.sidebar = own;
    return;
  }

  const group = appended[sections.indexOf(current)];
  if (group?.type === 'group') route.sidebar = group.entries;
});
