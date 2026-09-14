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

export interface HeliaShellOptions {
  themeSelect?: boolean;
  mobileMenuToggle?: boolean;
  footer?: boolean;
  /** `false` drops the brand font preload and leaves Starlight's head alone. */
  head?: boolean;
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
  head: ['Head', 'Head.astro'],
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
 */
const CODE_THEMES: NonNullable<ExpressiveCodeOptions['themes']> = [
  'github-dark',
  'github-light',
];

/** The `url("data:image/svg+xml,...")` form Expressive Code expects for icons. */
const inlineSvgUrl = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/*
 * Painted as a mask, so only the artwork's alpha reaches the page; the stroke
 * colour below is inert. Same outline as the icon buttons in the Astro parts.
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
 * custom property cannot be parsed as a colour; the background the rendered
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
 * A highlight is emphasis, not a colour: the syntax theme's own marker blue
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
 * The frame. The three window dots and the coloured tab brim are both dropped:
 * the package's frames carry a plain bar, and a tinted edge on a panel is ruled
 * out by the surface hierarchy in docs/design-system.md. With the tab and the
 * bar sharing one colour and no indicator line, the editor frame reads as the
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
  editorTabBorderRadius: '0px',
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
     * Starlight's own UI colours are applied as theme-level overrides, which
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
  const { styles = true, code = true, shell = {}, footer } = options;

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

        const expressiveCode =
          code && config.expressiveCode !== false
            ? mergeExpressiveCode(
                typeof config.expressiveCode === 'object'
                  ? config.expressiveCode
                  : {},
              )
            : config.expressiveCode;

        updateConfig({ customCss, components, expressiveCode });
        addIntegration(configModule(resolved));
      },
    },
  };
}

export default heliaStarlight;
