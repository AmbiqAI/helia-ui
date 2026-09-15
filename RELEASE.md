# Release manifest: @ambiqai/helia-ui

ADR-0005 requires "a release manifest carrying license and provenance, per demo
policy" but does not prescribe a filename or format, so this file records the
required facts in the package root next to LICENSE and NOTICE.

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Package           | `@ambiqai/helia-ui`                                                         |
| Version           | 0.1.0-alpha.6                                                               |
| Status            | Not published. Private, consumed from the git tag `v0.1.0-alpha.6`.         |
| License           | BSD-3-Clause (`LICENSE`)                                                    |
| Licensing tier    | Tier 1, ADR-0005                                                            |
| Source repository | https://github.com/AmbiqAI/helia-ui                                         |
| Source path       | Repository root, mirrored from `packages/helia-ui` in `helia-developer-hub` |
| Source commit     | Recorded at tag time.                                                       |

## What changed in 0.1.0-alpha.6

0.1.0-alpha.5 was mirrored but never tagged, so there is no `v0.1.0-alpha.5` to
compare against. This range starts at "Remove the card accent rule from the
package" (`c3088c1`), the commit that carried the 0.1.0-alpha.5 tree.

Issue references below are to `AmbiqAI/helia-ui`.

### Added

- `Button` gains a `danger` variant and a disabled state, to pair with shadcn's
  `destructive` and `disabled:opacity-50` (#20).
- `Badge` gains a `secondary` tone, drawn from `--helia-accent-secondary` (#23).
- Control heights become tokens (`--helia-control-sm`, `-md`, `-lg`), so a
  recipe and a generated class string can only agree by reading one number
  (#20).
- Six content-first `Card` options that need no imagery: an `icon` slot, a
  `step` numeral and `scale="display"` on `CardHeader`, a `stats` variant on
  `CardContent`, and the `CardList` and `CardQuote` parts (#21).
- Tracking tokens for the display, page, section and heading steps (#16).
- Roboto Variable ships with the package as the default sans, self-hosted and
  preloaded, with the system stack as fallback (#16).
- `--helia-hero-treatment` and `--helia-accent-secondary` are wired rather than
  named only: the first decides the ground `EditorialBand` paints, the second
  is the `Badge` `secondary` tone, the link-card pointer cue and `--chart-2` in
  the shadcn bridge (#23).
- Theme scopes: the composed tokens are declared on `[data-helia-theme]` and
  `.helia-theme-scope` as well as `:root`, so a wrapper can re-theme a subtree
  (#23).
- `AsciiTerminal` gains an `error` kind (#32).
- `stagger` on `Reveal`, which delays each direct child by its index times the
  fast step, and a `replay()` method on the element (#19).
- `helia-ui-serve-dist`, a static server for the built site, replacing
  `astro preview` in both Playwright configs (#2).
- JSDoc contracts on every part exported under `./astro/*`, with a generated
  props reference (#4).
- The site theme contract as generated documentation, checked by
  `scripts/site-theme-doc.mjs` (#6).
- A React/Astro cohesion page in the package docs, five pairs side by side,
  with the button pair's radius and height asserted on every docs run (#20).
- Source for every gallery example, in an expandable panel beside it (#18).
- A typeface comparison page in the package docs (#16).

### Changed

- Expressive Code is themed from the Starlight plugin, so a fenced block in any
  consumer carries the package surface, border, radius and mono ramp instead of
  Starlight's default frame (#17).
- The syntax pair moves to `github-light-high-contrast` and
  `github-dark-high-contrast`, which keep GitHub's hue assignments but clear
  contrast on the package's card surface (#33).
- The advisory tones gain `-ink` counterparts, one value per theme, so a status
  color set on text is chosen for the surface it sits on; the tones themselves
  are unchanged, because they are fills and strokes (#32).
- Every transition and animation the package ships now writes the motion
  tokens, and `check:styles` fails a duration or easing literal in a package
  sheet (#5).
- `--helia-ease-in-out` is removed; neither candidate transition needed it (#5).
- `--helia-motion-enabled` is declared on `:root` only and inherits into every
  scope, so a scoped duration cannot reach past a reduced-motion preference
  (#23).
- Roboto is served in latin and latin-ext only, rather than the nine subsets
  fontsource declares (#16).
- The `CodeTabs` and `AsciiTerminal` title bars move to the muted card surface
  the Expressive Code frames already use, and the `CardList` bullet drops a
  step at compact density (#20).
- The monorepo standardises on node 24 and the npm 11 it ships; the package
  keeps the lower `node >=22`, `npm >=10` floor, because a consumer installing
  from a git tag reads that manifest in their own tree (#22).
- The optional peers and `typescript` are declared where the package's own
  checks need them, since npm 11 does not materialise optional peers (#22).

### Fixed

- `AsciiTerminal` success and warning lines failed contrast on light paper, at
  3.20:1 and 2.77:1 against the 4.5:1 axe asks for (#32).
- The theme dials moved nothing, because every composed token sat on `:root`:
  the gallery's square, round and tinted knobs rendered three identical cards
  (#23).
- Tailwind read `display: grid;` inside a part's `<style>` block as a scanned
  candidate, shipping the bare display utilities to every visitor (#8).
- `astro preview` daemonised under agent environments and held a per-project
  lock, so smoke runs hung (#2).

### Breaking

- `--helia-hero-treatment` takes `plain`, `gradient` or `tinted`; the `band`
  and `artwork` values are gone, and the dial now draws `EditorialBand` rather
  than being a name a site reads for itself (#23).
- `CodeBlock` wraps Starlight's `Code` instead of rendering through Shiki
  directly, so it requires the `heliaStarlight` plugin to be installed. Its
  props are unchanged (#17).
- `--chart-2` in the shadcn bridge now defaults to slate, following
  `--helia-accent-secondary`, rather than standing on its own value (#23).
- `Badge` gains a `secondary` tone, which is a new value in the `tone` union
  (#23).
- `Button` gains a `danger` variant, which is a new value in the `variant`
  union (#20).
- The Astro button's height now matches the React control heights, about 46px
  at `md`, so any layout measured against the previous height shifts (#20).
- Roboto Variable is the default sans and ships with the package under OFL-1.1,
  in latin and latin-ext subsets. A site that wants its own face sets
  `--helia-font-brand`, the fallback `--helia-font-sans` resolves to; mono is
  unchanged (#16).
- Display tracking moves from -0.055em to -0.02em and is now a token, with the
  page, section and heading steps in the same proportion (#16).
- The motion tokens are the only source of duration and easing, and the reveal
  distance moves from 8px to 20px and multiplies by `--helia-motion-scale`
  (#5, #19).
- `engines` on the package is `node >=22.12.0`, `npm >=10`, a floor rather than
  a pin; the monorepo root and the docs app require node 24 and npm 11 (#22).

## What changed in 0.1.0-alpha.5

- A motion system. Three duration steps (`--helia-motion-fast`, `-base`,
  `-slow`), two easings, one per-site dial `--helia-motion-scale` that
  multiplies every duration, and three travel distances. Four named
  transitions built from those tokens and nothing else:
  `.helia-motion-surface` (the former `.helia-hover-surface`, which stays as an
  alias), `.helia-motion-lift`, `.helia-motion-reveal` and `.helia-motion-cue`.
  The carousel's glide reads the same dial. One
  `prefers-reduced-motion: reduce` block zeroes the dial and the distances, so
  there is no list of classes to keep in step.
- Card variants as modifiers on the existing parts, not new components.
  `Card` gains `tone` (`elevated`, `outlined`, `filled`, `ghost`, alongside the
  older `card`, `muted` and `paper` names), `media` (`top`, `side`,
  `background`), `density` (`compact`, `comfortable`), `accent` and `lift`.
  Each has a class for an element the component cannot produce, and they
  compose.
- `Reveal`, `StatCard` and `LinkCard` in the Astro lane. `Reveal` is the one
  part that ships script: a custom element and one `IntersectionObserver`, and
  it returns before hiding anything when the motion scale is 0, so the content
  is visible without JavaScript.
- `@ambiqai/helia-ui/site-theme.css`, the site theme contract: the nine dials a
  consuming site may set, and the statement that anything else is a package
  change. `--helia-radius-scale` and `--helia-surface-tint` are new;
  `--helia-radius-md` is `--helia-radius` after the multiplier and is what the
  recipes now read.
- A `Gallery` page in the package docs carrying every variant, every
  transition and the theme dials side by side, each labeled with the prop or
  class that produces it.

## What changed in 0.1.0-alpha.4

- `helia-ui-mkdocs-convert`, a second bin beside `helia-ui-pyref`. It is the
  mechanical MkDocs Material to Starlight MDX conversion — admonitions and
  collapsible admonitions to asides, content tabs to `Tabs`/`TabItem`,
  `:material-*:` shortcodes to `Icon`, Termynal blocks to `AsciiTerminal`,
  relative links to route form — written once for heliaAOT and now shared, so
  the next product's docs migration is a command rather than a rewrite. What it
  cannot do mechanically it reports: raw HTML, charts, and any icon name with
  no Font Awesome equivalent, which becomes a visible marker instead of a
  guess. `--sidebar` writes the MkDocs nav as a Starlight sidebar fragment.
- The Material icon table moved out of the script to
  `scripts/lib/material-icons.json`, and `--icons` merges a product's own names
  over it.
- The product-docs template gains route tests: a Playwright config, a
  dependency-free static server for the built site, and a spec that reads the
  sidebar fragment and asserts every nav route serves 200.

## What changed in 0.1.0-alpha.3

- Diagrams. A ` ```mermaid ` fence renders to an inline SVG at build time
  through `rehype-mermaid`, painted from the token set by the new
  `@ambiqai/helia-ui/mermaid.css` export. The sheet is opt-in rather than
  spliced in by the Starlight plugin, because it only means anything on a site
  that also runs the rehype plugin, and that plugin needs a headless browser at
  build time. The product-docs template is wired for it.
- `Callout` gains a `success` tone. Starlight 0.41's `Aside` takes a fixed four
  types and throws on anything else, so `success` has no `Aside` equivalent and
  the migration guide maps it to `tip` there.
- `CardHeader` takes the overline as a prop. The named slot is still supported,
  but in MDX it could not survive a title on the following line.

## Provenance

Ambiq-authored source, with React parts derived from shadcn/ui (MIT) and
carrying Ambiq modifications. The package ships source with no build step, so
the published tree is the repository tree: there is no compiled artifact whose
provenance differs from the source.

`THIRD-PARTY-NOTICES.md` records the runtime dependency tree with license
identifiers and texts, and the evidence each identifier was read from. It is
generated by `scripts/third-party-notices.mjs` v1.0.0 and verified in CI by
`npm run check:notices`. It is generated from this package's own
`package-lock.json`, which is the tree the package installs, so it is
regenerated from the package root rather than from a workspace that vendors it.

## Before publishing

Set the version, record the publishing commit above, and regenerate the notices
from the environment that builds the published artifact.
