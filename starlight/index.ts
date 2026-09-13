// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The HELIA Starlight plugin: the stylesheets and the parts of the Starlight
 * shell that carry no site vocabulary.
 *
 * A plugin's `updateConfig` shallow-merges over the user's config, so an array
 * or a map written here REPLACES the user's rather than adding to it. Both
 * values this plugin touches are therefore read from `config` and merged by
 * hand: the stylesheets are spliced into the user's `customCss`, and an
 * override is installed only under a key the user left alone. A site that
 * names its own Footer keeps it.
 */

import type { AstroIntegration } from 'astro';
import type { StarlightPlugin } from '@astrojs/starlight/types';

export interface HeliaFooterLink {
  label: string;
  href: string;
}

export interface HeliaFooterOptions {
  /** Navigation shown on the right of the footer's brand row. */
  links: HeliaFooterLink[];
  /** One-line description printed under the logo. */
  tagline?: string;
  /** `false` drops the brand lockup and renders the tagline on its own. */
  logo?: 'ambiq' | false;
}

export interface HeliaShellOptions {
  themeSelect?: boolean;
  mobileMenuToggle?: boolean;
  footer?: boolean;
}

export interface HeliaStarlightOptions {
  /** Adds the package stylesheets to `customCss`. Default `true`. */
  styles?: boolean;
  /** Per-component opt-out of the shell overrides. Each defaults to `true`. */
  shell?: HeliaShellOptions;
  footer?: HeliaFooterOptions;
}

/** The shape the shell components read from `virtual:helia-ui/starlight-config`. */
export interface HeliaStarlightConfig {
  footer: {
    links: HeliaFooterLink[];
    tagline: string | undefined;
    logo: 'ambiq' | false;
  };
}

export const VIRTUAL_CONFIG_ID = 'virtual:helia-ui/starlight-config';

/*
 * Order is the contract, not just the contents. The sheets are unlayered, so
 * they outrank every cascade layer the consuming site's Tailwind entry
 * declares, and the site's own sheet has to come after them so a page rule
 * needs no extra specificity to win.
 */
const STYLESHEETS = [
  '@ambiqai/helia-ui/tokens.css',
  '@ambiqai/helia-ui/semantic.css',
  '@ambiqai/helia-ui/recipes.css',
  '@ambiqai/helia-ui/starlight.css',
];

const OVERRIDES = {
  themeSelect: ['ThemeSelect', 'ThemeMenu.astro'],
  mobileMenuToggle: ['MobileMenuToggle', 'MobileMenuToggle.astro'],
  footer: ['Footer', 'Footer.astro'],
} as const satisfies Record<keyof HeliaShellOptions, readonly [string, string]>;

/*
 * A Tailwind v4 entry declares the layer order and runs the Starlight compat
 * round trip, both of which have to be in the stylesheet before the token
 * sheets restate what they own. The consuming site keeps that entry — it is
 * the only side that can write a `@source` glob out of node_modules — so the
 * package sheets go after the site's leading Tailwind roots rather than at the
 * very front. The convention that names them is documented in
 * docs/design-system.md, "Package layout".
 */
const isTailwindEntry = (entry: string) =>
  /(^|\/)tailwind[\w.-]*\.css$/.test(entry);

/** Index of the first `customCss` entry that is not a Tailwind root. */
function insertionPoint(customCss: readonly string[]) {
  let index = 0;
  while (index < customCss.length && isTailwindEntry(customCss[index]!)) {
    index += 1;
  }
  return index;
}

/**
 * Serves the resolved options to the shell components. Starlight hands nothing
 * to a component override, so the values have to reach the Footer through the
 * module graph; a virtual module is how Starlight itself does this, and it
 * keeps the options build-time constants rather than runtime lookups.
 */
function configModule(config: HeliaStarlightConfig): AstroIntegration {
  const resolvedId = `\0${VIRTUAL_CONFIG_ID}`;
  return {
    name: '@ambiqai/helia-ui/starlight',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'helia-ui:starlight-config',
                resolveId: (id: string) =>
                  id === VIRTUAL_CONFIG_ID ? resolvedId : undefined,
                load: (id: string) =>
                  id === resolvedId
                    ? `export default ${JSON.stringify(config)};`
                    : undefined,
              },
            ],
          },
        });
      },
    },
  };
}

export function heliaStarlight(
  options: HeliaStarlightOptions = {},
): StarlightPlugin {
  const { styles = true, shell = {}, footer } = options;

  const resolved: HeliaStarlightConfig = {
    footer: {
      links: footer?.links ?? [],
      tagline: footer?.tagline,
      logo: footer?.logo ?? 'ambiq',
    },
  };

  return {
    name: '@ambiqai/helia-ui/starlight',
    hooks: {
      'config:setup': ({ addIntegration, config, updateConfig }) => {
        const customCss = [...(config.customCss ?? [])];
        if (styles) {
          const missing = STYLESHEETS.filter(
            (sheet) => !customCss.includes(sheet),
          );
          customCss.splice(insertionPoint(customCss), 0, ...missing);
        }

        const components: Record<string, string> = {
          ...(config.components ?? {}),
        };
        for (const [key, [name, file]] of Object.entries(OVERRIDES)) {
          if (shell[key as keyof HeliaShellOptions] === false) continue;
          if (name in components) continue;
          components[name] = `@ambiqai/helia-ui/starlight/${file}`;
        }

        updateConfig({ customCss, components });
        addIntegration(configModule(resolved));
      },
    },
  };
}

export default heliaStarlight;
