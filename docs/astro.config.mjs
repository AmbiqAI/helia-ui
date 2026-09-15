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
import rehypeMermaid from 'rehype-mermaid';
import { heliaStarlight } from '@ambiqai/helia-ui/starlight';

const base = '/helia-ui';
const basePath = `${base}/`;

export default defineConfig({
  site: 'https://ambiqai.github.io',
  base,
  /*
   * Diagrams are rendered here, at build, so the page ships no diagram runtime.
   * `inline-svg` needs a headless browser: CI gets one from Playwright, and a
   * local build reads PLAYWRIGHT_BROWSERS_PATH. A missing browser fails the
   * build rather than shipping an empty figure. See the Diagrams page.
   */
  markdown: {
    rehypePlugins: [[rehypeMermaid, { strategy: 'inline-svg' }]],
  },
  integrations: [
    starlight({
      title: 'helia-ui',
      description:
        'Design tokens, Astro parts, React components, and the Starlight theme for HELIA sites.',
      /* The diagram theme is opt-in rather than spliced in by the plugin: it is
         only meaningful on a site that also runs the rehype plugin. */
      customCss: [
        './src/styles/tailwind.css',
        '@ambiqai/helia-ui/mermaid.css',
        './src/styles/site-theme.css',
        './src/styles/site.css',
        /* Last, so the worked examples on the Site theme page are read as the
           site theme they would be if either one were this site's `:root`. */
        './src/styles/example-theme.css',
      ],
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
        {
          label: 'Foundations',
          collapsed: false,
          items: [
            { label: 'Tokens and scales', slug: 'foundations' },
            { label: 'Color tokens', slug: 'foundations/tokens' },
            { label: 'Site theme', slug: 'foundations/site-theme' },
            {
              label: 'Typeface candidates',
              slug: 'foundations/typeface-candidates',
            },
          ],
        },
        /* Near the top on purpose: it is the page an owner picking a card
           treatment is sent to, not a reference the parts pages lead into. */
        { label: 'Gallery', slug: 'gallery' },
        {
          label: 'Starlight plugin',
          collapsed: false,
          items: [
            { label: 'Adopting the plugin', slug: 'starlight-plugin' },
            {
              label: 'Discoverability',
              slug: 'starlight-plugin/discoverability',
            },
          ],
        },
        {
          label: 'Migrating from MkDocs',
          collapsed: false,
          items: [
            { label: 'Feature mapping', slug: 'migrating-from-mkdocs' },
            { label: 'Python API reference', slug: 'python-api-reference' },
            { label: 'C and C++ API reference', slug: 'c-api-reference' },
            {
              label: 'TypeScript API reference',
              slug: 'typescript-api-reference',
            },
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
            { label: 'Diagrams', slug: 'diagrams' },
            { label: 'Layout', slug: 'layout' },
          ],
        },
        {
          label: 'Reference',
          collapsed: false,
          items: [
            { label: 'Astro part contracts', slug: 'reference/astro-parts' },
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
            /* A decision page rather than a reference one, so it sits with
               the components it would change rather than under Foundations. */
            {
              label: 'Charting candidates',
              slug: 'react/charts-candidates',
            },
            /* Last on purpose: it reads the pages above it back against the
               Astro parts, so it only makes sense after them. */
            { label: 'Cohesion', slug: 'react/cohesion' },
          ],
        },
      ],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    /*
     * The package is linked, not installed, so a peer it imports resolves in
     * its own tree and a peer this site imports resolves here: two copies of
     * the same library in one bundle. A React part composed across that seam
     * then holds a provider from one copy and a consumer from the other, and
     * the consumer reads the default instead of the provided value: no error,
     * just an empty frame, which is how a chart came to draw nothing. Every
     * peer that ships to the browser is pinned to this site's copy, the way
     * @astrojs/react already pins react and react-dom.
     * See AmbiqAI/helia-ui#53.
     */
    resolve: {
      dedupe: [
        '@tanstack/react-table',
        'class-variance-authority',
        'cmdk',
        'cn',
        'echarts',
        'lucide-react',
        'radix-ui',
        'react',
        'react-dom',
        'recharts',
        'sonner',
      ],
    },
  },
});
