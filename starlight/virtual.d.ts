// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
declare module 'virtual:helia-ui/starlight-config' {
  const config: import('./index').HeliaStarlightConfig;
  export default config;
}

/*
 * The `sections` route middleware resolves the whole section navigation and
 * the Sidebar override renders it, and the route object Starlight passes
 * between them has no field either side could put it in: `sidebar` is the
 * pane, which by then is one section's pages. Locals are the request's own
 * scratch space, which is the next thing down.
 */
declare namespace App {
  interface Locals {
    /** Every section, with its pages under it, for the narrow-width menu. */
    heliaSectionNav?: import('@astrojs/starlight/route-data').StarlightRouteData['sidebar'];
  }
}

/*
 * Starlight builds a `virtual:starlight/components/*` module for every
 * overridable component and its own templates import them, which is how an
 * override reaches a component it did not render itself. The declarations live
 * in a file Starlight does not list in its exports, so a consumer outside the
 * package cannot reference them; restating the three the Footer needs against
 * the public component paths keeps the import typed without reaching into
 * node_modules by path.
 */
declare module 'virtual:starlight/components/EditLink' {
  const EditLink: typeof import('@astrojs/starlight/components/EditLink.astro').default;
  export default EditLink;
}

declare module 'virtual:starlight/components/LastUpdated' {
  const LastUpdated: typeof import('@astrojs/starlight/components/LastUpdated.astro').default;
  export default LastUpdated;
}

declare module 'virtual:starlight/components/Pagination' {
  const Pagination: typeof import('@astrojs/starlight/components/Pagination.astro').default;
  export default Pagination;
}
