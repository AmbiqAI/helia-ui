// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
// @ts-check
/*
 * The package's own documentation site.
 *
 * It consumes @ambiqai/helia-ui exactly as an unrelated site would: through
 * the export map and the Starlight plugin, with nothing reached for by
 * relative path. That is the point of it. Anything the package cannot supply
 * to this site is a package gap, not a site one, and the split in the
 * extraction plan's step 7 carries this directory along with the package.
 */
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { heliaStarlight } from '@ambiqai/helia-ui/starlight';

const base = '/helia-ui';
const basePath = `${base}/`;

export default defineConfig({
  site: 'https://ambiqai.github.io',
  base,
  integrations: [
    starlight({
      title: 'helia-ui',
      description:
        'Design tokens, Astro parts, React components, and the Starlight theme for HELIA sites.',
      customCss: ['./src/styles/tailwind.css', './src/styles/site.css'],
      plugins: [
        heliaStarlight({
          footer: {
            links: [
              { label: 'Overview', href: basePath },
              { label: 'Foundations', href: `${basePath}foundations/` },
              { label: 'Primitives', href: `${basePath}primitives/` },
              {
                label: 'Starlight plugin',
                href: `${basePath}starlight-plugin/`,
              },
              {
                label: 'GitHub',
                href: 'https://github.com/AmbiqAI/helia-developer-hub',
              },
            ],
            tagline:
              'The shared design system behind the HELIA developer surfaces.',
            logo: 'ambiq',
          },
        }),
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/AmbiqAI/helia-developer-hub',
        },
      ],
      sidebar: [
        { label: 'Overview', slug: '' },
        { label: 'Foundations', slug: 'foundations' },
        { label: 'Starlight plugin', slug: 'starlight-plugin' },
        {
          label: 'Migrating from MkDocs',
          collapsed: false,
          items: [
            { label: 'Feature mapping', slug: 'migrating-from-mkdocs' },
            { label: 'Python API reference', slug: 'python-api-reference' },
          ],
        },
        {
          label: 'Astro parts',
          collapsed: false,
          items: [
            { label: 'Primitives', slug: 'primitives' },
            { label: 'Cards', slug: 'cards' },
            { label: 'Media', slug: 'media' },
            { label: 'Code', slug: 'code' },
            { label: 'Callouts', slug: 'callouts' },
            { label: 'Disclosure', slug: 'disclosure' },
            { label: 'Timeline', slug: 'timeline' },
            { label: 'Layout', slug: 'layout' },
          ],
        },
        {
          label: 'Templates',
          collapsed: false,
          items: [
            { label: 'Docs sites', slug: 'templates/docs-sites' },
            { label: 'Web apps', slug: 'templates/web-apps' },
          ],
        },
        {
          label: 'React components',
          collapsed: false,
          items: [
            { label: 'Inputs', slug: 'react/inputs' },
            { label: 'Form depth', slug: 'react/form-depth' },
            { label: 'Overlays', slug: 'react/overlays' },
            { label: 'Feedback', slug: 'react/feedback' },
            { label: 'Data display', slug: 'react/data-display' },
            { label: 'Navigation', slug: 'react/navigation' },
            { label: 'Versioning', slug: 'react/versioning' },
          ],
        },
      ],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
