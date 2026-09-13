// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { heliaStarlight } from '@ambiqai/helia-ui/starlight';

/*
 * Placeholders. `site` is the origin Pages serves from and `base` is the
 * repository name with a leading slash; together they are what makes a
 * root-relative link resolve in production as well as in `astro dev`. Change
 * both before the first deploy, then never again.
 */
const site = 'https://ambiqai.github.io';
const base = '/PRODUCT-REPO-NAME';
const basePath = `${base}/`;

export default defineConfig({
  site,
  base,
  /*
   * Math is an Astro-level concern. Starlight's own `markdown` option covers
   * heading links and extra processed directories only, so the remark and
   * rehype plugins go here, where Starlight's content collection picks them up
   * with the rest of the site's Markdown.
   */
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  integrations: [
    starlight({
      title: 'PRODUCT NAME',
      description: 'One line describing what the product does.',
      /*
       * The Tailwind entry leads so the package sheets land after it; the
       * plugin splices them in at that seam. KaTeX and the site sheet follow,
       * so a rule in either wins without extra specificity.
       */
      customCss: [
        './src/styles/tailwind.css',
        'katex/dist/katex.min.css',
        './src/styles/site.css',
      ],
      plugins: [
        heliaStarlight({
          footer: {
            links: [
              { label: 'Overview', href: basePath },
              { label: 'Install', href: `${basePath}install/` },
              { label: 'Reference', href: `${basePath}reference/` },
              {
                label: 'HELIA developer hub',
                href: 'https://ambiqai.github.io/helia-developer-hub/',
              },
            ],
            tagline: 'Part of the Ambiq HELIA developer ecosystem.',
            logo: 'ambiq',
          },
        }),
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/AmbiqAI/PRODUCT-REPO-NAME',
        },
      ],
      sidebar: [
        { label: 'Overview', slug: '' },
        { label: 'Install', slug: 'install' },
        /* A named group takes an `items` array; the autogenerate object goes
         * inside it. Starlight dropped `label` on autogenerate itself. */
        {
          label: 'How-to',
          collapsed: false,
          items: [{ autogenerate: { directory: 'how-to' } }],
        },
        {
          label: 'Reference',
          collapsed: false,
          items: [{ autogenerate: { directory: 'reference' } }],
        },
        {
          label: 'Guides',
          collapsed: false,
          items: [{ autogenerate: { directory: 'guides' } }],
        },
      ],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
