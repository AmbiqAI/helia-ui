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
          /* This site has one landing page under `template: splash`, and it is
             there to show what a product site gets from this option. Every
             other page already carries the sidebar. */
          sidebar: 'always',
          /* The bar this site reads its own navigation from, and the only
             place the option and its narrow-width sidebar button are driven
             end to end. The bar stands in place of Starlight's header, which
             is where the social row renders, so GitHub is a link here. */
          header: {
            links: [
              { label: 'Foundations', href: `${basePath}foundations/` },
              { label: 'Gallery', href: `${basePath}gallery/` },
              {
                label: 'Starlight plugin',
                href: `${basePath}starlight-plugin/`,
              },
              {
                label: 'React components',
                href: `${basePath}react/inputs/`,
                match: `${basePath}react/`,
              },
              {
                label: 'GitHub',
                href: 'https://github.com/AmbiqAI/helia-developer-hub',
              },
            ],
            /* The Pages address until the hub has a domain of its own. */
            hub: { href: 'https://ambiqai.github.io/helia-developer-hub/' },
          },
          /*
           * The fixture for the `sections` option, and the reason it is a
           * fixture rather than this site's own navigation: a section-scoped
           * sidebar only works when every part of the site is a section, and
           * this site's bar carries a link to GitHub and leaves several
           * groups -- Astro parts, Reference, Templates -- off the bar
           * entirely. Adopting sections here would strand those pages.
           *
           * Under `starlight-plugin/` on purpose, so the bar's own
           * Starlight-plugin link is the section the fixture pages sit in and
           * the top bar has something to mark. Every page outside the fixture
           * keeps this site's full sidebar, which is the option's fallback
           * doing its job.
           */
          sections: [
            {
              /* The shape a product site's Home section has: no pages of its
                 own, so the landing page is read at the full width of the
                 frame and the sections are reached from the bar above it. */
              label: 'Demo home',
              href: `${basePath}starlight-plugin/sections/`,
              sidebar: false,
            },
            {
              label: 'Demo guide',
              href: `${basePath}starlight-plugin/sections/guide/`,
              sidebar: [
                {
                  label: 'First steps',
                  slug: 'starlight-plugin/sections/guide/first-steps',
                },
                {
                  label: 'Next steps',
                  slug: 'starlight-plugin/sections/guide/next-steps',
                },
              ],
            },
            {
              label: 'Demo reference',
              href: `${basePath}starlight-plugin/sections/reference/`,
              /* The generated shape: a directory, listed one level under the
                 section rather than under a group inside it. */
              sidebar: [
                {
                  autogenerate: {
                    directory: 'starlight-plugin/sections/reference',
                  },
                },
              ],
            },
          ],
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
            {
              label: 'Landing page example',
              slug: 'starlight-plugin/landing-example',
            },
            { label: 'Hero page example', slug: 'starlight-plugin/hero-page' },
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
          /* Autogenerated on purpose: it keeps the group honest as templates
             are added, and it is the shape the discoverability artifacts have
             to resolve, which nothing else on this site exercises. */
          items: [{ autogenerate: { directory: 'templates' } }],
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
