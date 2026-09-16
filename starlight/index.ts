// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The HELIA Starlight plugin: the stylesheets and the parts of the Starlight
 * shell that carry no site vocabulary.
 *
 * A plugin's `updateConfig` shallow-merges over the user's config, so an array
 * or a map written here REPLACES the user's rather than adding to it. Every
 * value this plugin touches is therefore read from `config` and merged by
 * hand: the stylesheets are spliced into the user's `customCss`, an override is
 * installed only under a key the user left alone, and the Expressive Code
 * settings go under the site's own. A site that names its own Footer keeps it.
 */

import type { AstroIntegration } from 'astro';
import type { HookParameters, StarlightPlugin } from '@astrojs/starlight/types';
import {
  discoverabilityIntegration,
  resolveDiscoverability,
  type HeliaDiscoverabilityOptions,
  type ResolvedDiscoverability,
} from './discoverability';

export type { HeliaDiscoverabilityOptions } from './discoverability';
export { heliaFrontmatterSchema } from './schema';
export type { HeliaFrontmatter } from './schema';

type StarlightConfigInput = HookParameters<'config:setup'>['config'];

/** Starlight's Expressive Code options, minus the `false` opt-out. */
type ExpressiveCodeOptions = Exclude<
  StarlightConfigInput['expressiveCode'],
  boolean | undefined
>;

type CodeStyleOverrides = NonNullable<ExpressiveCodeOptions['styleOverrides']>;

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

export interface HeliaHeaderLink {
  label: string;
  href: string;
  /**
   * Path prefix that marks the link current, for a section whose pages do not
   * live under its `href`. Defaults to the `href`.
   */
  match?: string;
}

export interface HeliaHeaderOptions {
  /** The name at the top-left. Defaults to the site's own title. */
  title?: string;
  /** The sections beside the name. */
  links?: HeliaHeaderLink[];
  /** Starlight's search trigger. Default `true`. */
  search?: boolean;
  /** The package theme menu. Default `true`, and off with `shell.themeSelect`. */
  themeToggle?: boolean;
}

/**
 * The product accents `semantic.css` maps onto `--helia-product-accent`. The
 * list is here as well as there so a typo is a failed build rather than a site
 * that silently falls back to slate.
 */
export const PRODUCT_ACCENTS = [
  'helia-aot',
  'helia-core',
  'helia-dsp',
  'helia-edge',
  'helia-ml',
  'helia-profiler',
  'helia-rt',
  'kit-compression',
  'kit-heart',
  'kit-physio',
  'kit-sleep',
  'kit-sound',
  'kit-vision',
] as const;

export type HeliaProductAccent = (typeof PRODUCT_ACCENTS)[number];

export interface HeliaShellOptions {
  themeSelect?: boolean;
  mobileMenuToggle?: boolean;
  footer?: boolean;
  /** `false` drops the brand font preload and leaves Starlight's head alone. */
  head?: boolean;
  /**
   * Installs the `PageTitle` override, which honors
   * `helia: { pageTitle: false }`. `false` leaves Starlight's heading on every
   * page, frontmatter or no frontmatter.
   */
  pageTitle?: boolean;
}

export interface HeliaStarlightOptions {
  /** Adds the package stylesheets to `customCss`. Default `true`. */
  styles?: boolean;
  /**
   * Themes Expressive Code so a fenced code block renders on the package
   * surface instead of Starlight's default frame. Default `true`.
   *
   * A site's own `expressiveCode` config is merged over these settings rather
   * than replacing them: `styleOverrides` and its `frames` and `textMarkers`
   * maps are merged key by key, and any other key the site names wins
   * outright. A site that sets `expressiveCode: false` keeps it switched off.
   */
  code?: boolean;
  /**
   * The product whose identity color the site carries. The Head override puts
   * it on the document element as `data-helia-accent`, which is what
   * `semantic.css` resolves onto `--helia-product-accent`, so a site needs no
   * stylesheet of its own to have an accent. Needs `shell.head` left
   * installed; with scripting off the accent stays the default slate.
   */
  accent?: HeliaProductAccent;
  /** Per-component opt-out of the shell overrides. Each defaults to `true`. */
  shell?: HeliaShellOptions;
  footer?: HeliaFooterOptions;
  /**
   * Installs the package top bar: the site name as text at the top-left, the
   * links beside it, search, and the theme menu. Absent, Starlight's own
   * header stands.
   */
  header?: HeliaHeaderOptions;
  /**
   * `'always'` keeps the left sidebar on every page, a landing page under
   * `template: splash` included, which is what a product site wants. `'docs'`
   * is Starlight's own behavior. Default `'docs'`.
   */
  sidebar?: 'docs' | 'always';
  /**
   * Search-engine and agent discoverability. Every part defaults to `true`;
   * `false` switches the lot off. Needs an absolute `site` in astro.config,
   * and the per-page tags need `shell.head` left installed.
   */
  discoverability?: HeliaDiscoverabilityOptions | false;
}

/** The shape the shell components read from `virtual:helia-ui/starlight-config`. */
export interface HeliaStarlightConfig {
  /** The `data-helia-accent` value the Head puts on the document element. */
  accent: HeliaProductAccent | undefined;
  footer: {
    links: HeliaFooterLink[];
    tagline: string | undefined;
    logo: 'ambiq' | false;
  };
  /** `null` when the site asked for no package header. */
  header: {
    title: string;
    links: HeliaHeaderLink[];
    search: boolean;
    themeToggle: boolean;
  } | null;
  /** The site's own title and description, which a component override cannot read. */
  site: {
    title: string;
    description: string | undefined;
  };
  discoverability: ResolvedDiscoverability;
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
  head: ['Head', 'Head.astro'],
  pageTitle: ['PageTitle', 'PageTitle.astro'],
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

/*
 * GitHub's themes are the pair the package's own Shiki-rendered parts already
 * use, and their editor backgrounds sit closest to `--helia-surface-card` in
 * both modes, so the syntax ink was picked for the surface it lands on. One
 * light and one dark is also what makes Starlight emit `[data-theme]` selectors
 * instead of a media query, which is how the blocks follow the theme toggle.
 *
 * The high-contrast variants rather than the base pair: the base themes ship
 * ink that fails WCAG AA on the card surface in both modes -- `variable` at
 * 3.49:1 on light paper, `comment` at 3.95:1 on the dark card -- and the
 * package draws them on its own surface rather than the theme's editor
 * background, so the theme's own contrast budget does not carry over. The
 * high-contrast pair keeps GitHub's hue assignments, so the change is one of
 * depth rather than palette. The docs accessibility scan covers a code page in
 * both themes; see AmbiqAI/helia-ui#33.
 */
const CODE_THEMES: NonNullable<ExpressiveCodeOptions['themes']> = [
  'github-dark-high-contrast',
  'github-light-high-contrast',
];

/** The `url("data:image/svg+xml,...")` form Expressive Code expects for icons. */
const inlineSvgUrl = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/*
 * Painted as a mask, so only the artwork's alpha reaches the page; the stroke
 * color below is inert. Same outline as the icon buttons in the Astro parts.
 */
const COPY_ICON = inlineSvgUrl(
  [
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='black' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'>`,
    `<path d='M6.25 6.25V4.5A1.75 1.75 0 0 1 8 2.75h7.5a1.75 1.75 0 0 1 1.75 1.75V12A1.75 1.75 0 0 1 15.5 13.75h-1.75'/>`,
    `<rect x='2.75' y='6.25' width='11' height='11' rx='1.75'/>`,
    `</svg>`,
  ].join(''),
);

/*
 * The package surface restated in Expressive Code's vocabulary. Two settings
 * are deliberately absent. `codeBackground` stays whatever the Shiki theme
 * declares, because Expressive Code runs contrast maths against it and a
 * custom property cannot be parsed as a color; the background the rendered
 * `pre` actually paints is `frames.editorBackground`, which is where the token
 * goes instead. `codeForeground` stays with the theme for the same reason, and
 * because the unhighlighted ink should match the highlighted ink around it.
 */
const CODE_STYLE_OVERRIDES: CodeStyleOverrides = {
  borderColor: 'var(--helia-surface-border)',
  borderRadius: 'var(--helia-radius-md)',
  borderWidth: '1px',
  codeFontFamily: 'var(--helia-font-mono)',
  codeFontSize: 'var(--helia-text-small)',
  codeLineHeight: '1.65',
  codePaddingBlock: 'var(--helia-space-3)',
  codePaddingInline: 'var(--helia-space-4)',
  uiFontFamily: 'var(--helia-font-sans)',
  uiFontSize: 'var(--helia-text-small)',
  uiPaddingBlock: 'var(--helia-space-2)',
  uiPaddingInline: 'var(--helia-space-3)',
};

/*
 * A highlight is emphasis, not a color: the syntax theme's own marker blue
 * competes with the code it is drawing attention to. A wash of the page ink
 * reads on either theme and leaves the accent to mean one thing.
 */
const CODE_MARKER_OVERRIDES: NonNullable<CodeStyleOverrides['textMarkers']> = {
  markBackground:
    'color-mix(in srgb, var(--helia-ink-primary) 8%, transparent)',
  markBorderColor:
    'color-mix(in srgb, var(--helia-ink-primary) 28%, transparent)',
};

/*
 * The frame. The three window dots and the colored tab brim are both dropped:
 * the package's frames carry a plain bar, and a tinted edge on a panel is ruled
 * out by the surface hierarchy in docs/design-system.md. With the tab and the
 * bar sharing one color and no indicator line, the editor frame reads as the
 * flat toolbar the parts draw rather than as a VS Code tab.
 */
const CODE_FRAME_OVERRIDES: NonNullable<CodeStyleOverrides['frames']> = {
  editorActiveTabBackground: 'var(--helia-surface-card-muted)',
  editorActiveTabForeground: 'var(--helia-ink-primary)',
  editorActiveTabIndicatorBottomColor: 'transparent',
  editorActiveTabIndicatorHeight: '0px',
  editorActiveTabIndicatorTopColor: 'transparent',
  editorBackground: 'var(--helia-surface-card)',
  editorTabBarBackground: 'var(--helia-surface-card-muted)',
  editorTabBarBorderBottomColor: 'var(--helia-surface-border)',
  editorTabBarBorderColor: 'var(--helia-surface-border)',
  /*
   * The tab is the first thing drawn in the tab bar, so its inline-start
   * corner sits exactly on the frame's. Squaring it left that corner painted
   * outside the frame's curve; matching `borderRadius` keeps it inside, and
   * the tab still reads flat because it shares the bar's color.
   */
  editorTabBorderRadius: 'var(--helia-radius-md)',
  frameBoxShadowCssValue: 'none',
  terminalBackground: 'var(--helia-surface-card)',
  terminalTitlebarBackground: 'var(--helia-surface-card-muted)',
  terminalTitlebarBorderBottomColor: 'var(--helia-surface-border)',
  terminalTitlebarDotsOpacity: '0',
  terminalTitlebarForeground: 'var(--helia-ink-primary)',
  /* An icon button: no border, no idle fill, and a wash on hover. */
  copyIcon: COPY_ICON,
  inlineButtonBackground: 'var(--helia-ink-primary)',
  inlineButtonBackgroundActiveOpacity: '0.12',
  inlineButtonBackgroundHoverOrFocusOpacity: '0.08',
  inlineButtonBackgroundIdleOpacity: '0',
  inlineButtonBorderOpacity: '0',
  inlineButtonForeground: 'var(--helia-ink-muted)',
  tooltipSuccessBackground: 'var(--helia-ink-primary)',
  tooltipSuccessForeground: 'var(--helia-surface-card)',
};

/**
 * Layers the package settings under the site's own. Starlight itself only
 * shallow-merges `expressiveCode`, so `styleOverrides` and its per-plugin maps
 * are merged a level at a time here; every other key the site names replaces
 * ours.
 */
function mergeExpressiveCode(site: ExpressiveCodeOptions) {
  const { styleOverrides = {}, ...rest } = site;
  const { frames, textMarkers, ...otherOverrides } = styleOverrides;

  return {
    themes: CODE_THEMES,
    /*
     * Starlight's own UI colors are applied as theme-level overrides, which
     * outrank config-level ones, so leaving this on would silently discard the
     * frame settings above. The tokens replace it rather than sit under it.
     */
    useStarlightUiThemeColors: false,
    ...rest,
    styleOverrides: {
      ...CODE_STYLE_OVERRIDES,
      ...otherOverrides,
      frames: { ...CODE_FRAME_OVERRIDES, ...frames },
      textMarkers: { ...CODE_MARKER_OVERRIDES, ...textMarkers },
    },
  } satisfies ExpressiveCodeOptions;
}

/**
 * The site title as one string.
 *
 * Starlight accepts either a plain title or a map keyed by locale, and a
 * multilingual site gets the map. The shell components and the site-wide
 * artifacts want one name, so the default locale's is the one that travels.
 */
function siteTitleOf(title: StarlightConfigInput['title']): string {
  if (typeof title === 'string') return title;
  const entries = Object.entries(title ?? {});
  const preferred = entries.find(
    ([locale]) => locale === 'en' || locale === 'root',
  );
  return preferred?.[1] ?? entries[0]?.[1] ?? '';
}

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
  const {
    styles = true,
    code = true,
    shell = {},
    footer,
    header,
    sidebar = 'docs',
    accent,
  } = options;
  const discoverability = resolveDiscoverability(options.discoverability);

  if (accent !== undefined && !PRODUCT_ACCENTS.includes(accent)) {
    throw new Error(
      `@ambiqai/helia-ui/starlight: unknown accent '${accent}'. One of: ${PRODUCT_ACCENTS.join(', ')}.`,
    );
  }

  return {
    name: '@ambiqai/helia-ui/starlight',
    hooks: {
      'config:setup': ({
        addIntegration,
        addRouteMiddleware,
        config,
        updateConfig,
      }) => {
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

        /* Off the map above: it is the option rather than `shell` that asks
           for this one, since a header with nothing in it is not a header. */
        if (header && !('Header' in components)) {
          components.Header = '@ambiqai/helia-ui/starlight/Header.astro';
        }

        if (sidebar === 'always') {
          addRouteMiddleware({
            entrypoint:
              '@ambiqai/helia-ui/starlight/sidebar-route-middleware.ts',
          });
        }

        const expressiveCode =
          code && config.expressiveCode !== false
            ? mergeExpressiveCode(
                typeof config.expressiveCode === 'object'
                  ? config.expressiveCode
                  : {},
              )
            : config.expressiveCode;

        const site = {
          title: siteTitleOf(config.title),
          description: config.description,
        };

        updateConfig({ customCss, components, expressiveCode });
        addIntegration(
          configModule({
            accent,
            footer: {
              links: footer?.links ?? [],
              tagline: footer?.tagline,
              logo: footer?.logo ?? 'ambiq',
            },
            header: header
              ? {
                  title: header.title ?? site.title,
                  links: header.links ?? [],
                  search: header.search ?? true,
                  /* A site that took the theme menu off the shell does not get
                     it back through the header. */
                  themeToggle:
                    (header.themeToggle ?? true) && shell.themeSelect !== false,
                }
              : null,
            site,
            discoverability,
          }),
        );

        /*
         * The sidebar is read here rather than in the integration because this
         * is the only hook that sees it: by `astro:config:done` it has become
         * Starlight's own virtual module, and llms.txt groups by the sections
         * the site's navigation declares rather than by directory.
         */
        if (
          discoverability.markdown ||
          discoverability.llms ||
          discoverability.ogImage
        ) {
          addIntegration(
            discoverabilityIntegration({
              resolved: discoverability,
              site,
              sidebar: (config.sidebar ?? []) as never,
            }),
          );
        }
      },
    },
  };
}

export default heliaStarlight;
