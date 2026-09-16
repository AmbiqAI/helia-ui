// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * `sidebar: 'always'`, which a product site sets so its landing page keeps the
 * navigation the rest of the site has.
 *
 * Starlight decides a page has no sidebar when its template is `splash`, and
 * one flag on the route carries that decision to the page shell, the frame,
 * and the `data-has-sidebar` attribute the layout widths key off. Setting the
 * flag back is therefore the whole change: an override of the Sidebar
 * component would never be reached, because the frame does not render the
 * component at all when the flag is false, and forking the frame to ignore it
 * would fork the widths with it.
 *
 * The plugin registers this only when the option asks for it, so there is no
 * mode to read here.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

export const onRequest = defineRouteMiddleware((context) => {
  context.locals.starlightRoute.hasSidebar = true;
});
