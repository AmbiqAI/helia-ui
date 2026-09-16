// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The frontmatter the package's Starlight overrides read.
 *
 * Starlight has no hook a plugin can extend the docs collection schema from,
 * and a key the schema does not declare is stripped before a component ever
 * sees it, so the site has to name this fragment once in its content config:
 *
 *   schema: docsSchema({ extend: heliaFrontmatterSchema })
 *
 * A site that leaves it out loses nothing else: the field is absent, and every
 * override falls back to what Starlight would have rendered.
 */

import { z } from 'astro/zod';

export const heliaFrontmatterSchema = z.object({
  helia: z
    .object({
      /**
       * `false` drops Starlight's `<h1>` from the top of the page, for a page
       * whose content opens with the `Hero` part and carries its own headline.
       */
      pageTitle: z.boolean().optional(),
    })
    .optional(),
});

/** The shape a component reads back off `entry.data`. */
export type HeliaFrontmatter = z.infer<typeof heliaFrontmatterSchema>;
