# Release manifest: @ambiqai/helia-ui

ADR-0005 requires "a release manifest carrying license and provenance, per demo
policy" but does not prescribe a filename or format, so this file records the
required facts in the package root next to LICENSE and NOTICE.

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Package           | `@ambiqai/helia-ui`                                                         |
| Version           | 0.1.0-alpha.5                                                               |
| Status            | Not published. Private, consumed from the git tag `v0.1.0-alpha.5`.         |
| License           | BSD-3-Clause (`LICENSE`)                                                    |
| Licensing tier    | Tier 1, ADR-0005                                                            |
| Source repository | https://github.com/AmbiqAI/helia-ui                                         |
| Source path       | Repository root, mirrored from `packages/helia-ui` in `helia-developer-hub` |
| Source commit     | Recorded at tag time.                                                       |

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
  transition and the theme dials side by side, each labelled with the prop or
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
the published tree is the repository tree: there is no compiled artefact whose
provenance differs from the source.

`THIRD-PARTY-NOTICES.md` records the runtime dependency tree with license
identifiers and texts, and the evidence each identifier was read from. It is
generated by `scripts/third-party-notices.mjs` v1.0.0 and verified in CI by
`npm run check:notices`. It is generated from this package's own
`package-lock.json`, which is the tree the package installs, so it is
regenerated from the package root rather than from a workspace that vendors it.

## Before publishing

Set the version, record the publishing commit above, and regenerate the notices
from the environment that builds the published artefact.
