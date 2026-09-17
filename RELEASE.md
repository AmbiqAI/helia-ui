# Release manifest: @ambiqai/helia-ui

ADR-0005 requires "a release manifest carrying license and provenance, per demo
policy" but does not prescribe a filename or format, so this file records the
required facts in the package root next to LICENSE and NOTICE. It is also the
release process of record, and the notes a release is cut from are the sections
below.

This repository is the source. The package grew up as `packages/helia-ui` inside
`helia-developer-hub` and was mirrored out with `git subtree split`; that mirror
is retired and tags are no longer made by hand from another tree. Changes land
here, CI runs here, tags are cut here, and the Dev Hub is now an ordinary
consumer pinning a tag like any other site.

| Field             | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Package           | `@ambiqai/helia-ui`                                                  |
| Version           | 0.1.0-alpha.12                                                       |
| Status            | Not published. Private, consumed from the git tag `v0.1.0-alpha.12`. |
| License           | BSD-3-Clause (`LICENSE`)                                             |
| Licensing tier    | Tier 1, ADR-0005                                                     |
| Source repository | https://github.com/AmbiqAI/helia-ui                                  |
| Source path       | Repository root. Authoritative, not a mirror of anything.            |
| Source commit     | Recorded at tag time.                                                |

## Releasing

Two stages, both dispatched from the Actions tab of this repository, and neither
of them the place where the notes get written.

Write the notes first. A `## What changed in <version>` section for the version
being released lands on main through an ordinary pull request, like any other
change. Both release stages refuse a version this file has no section for.

**Prepare release** takes the version, without the leading `v`. It writes the
version into `package.json`, regenerates both lockfiles and the facts table
above, and opens a pull request. It creates no tag: the bump is reviewed like
any other diff, and nothing immutable comes out of a job before someone has read
it. It refuses a malformed version, a version already tagged, and a version with
no notes.

Lockfiles regenerate in place here, because this package is not a workspace of
anything:

```sh
npm install --package-lock-only --ignore-scripts
npm install --package-lock-only --ignore-scripts --prefix docs
```

A regenerated lockfile counts only once it has been proven installable from
scratch, `npm ci --ignore-scripts` in the package and `npm ci --ignore-scripts
--prefix docs` in the gallery, and that proof happens before the bump pull
request is opened, not after it merges. `docs/` has its own lockfile and pins
the package as `file:..`, so a version bump moves it too. Never hand-edit
either file.

**Publish release** runs after that pull request merges, from main, with the
same version. It refuses to run anywhere but main, refuses a version main's
manifest does not carry, refuses a version with no notes, refuses if CI has not
passed for that exact commit, and refuses a tag that already exists. Only then
does it create the tag and a GitHub Release whose body is this file's section
for that version. Creating the ref through the API is the refusal that holds
against two people pressing the button at once.

When the dependency tree changed, regenerate `THIRD-PARTY-NOTICES.md` with
`npm run notices` from the environment the release is cut in. `npm run validate`
fails on a stale file, so this is a gate rather than a reminder.

A tag is immutable. A release that went out wrong is superseded by the next
version, never fixed by moving `v<version>`. Consumers pin the tag:

```json
{
  "dependencies": { "@ambiqai/helia-ui": "github:AmbiqAI/helia-ui#v<version>" }
}
```

## What changed in 0.1.0-alpha.13

- Keep generated card contracts inside the package gallery; props generation no
  longer reads or rewrites a neighboring repository's design document.
- Export `helia-ui-check-discoverability` as a supported consumer command.
- Remove retired monorepo path assumptions from maintenance tooling and preserve
  token migration rules when scanning a parent checkout.
- Test props generation with a neighboring document present and exercise the
  installed discoverability command in a scratch consumer.

Refs AmbiqAI/helia-developer-hub#30 and AmbiqAI/helia-ui#38.

## What changed in 0.1.0-alpha.12

Six fixes carried over from the Dev Hub, where they were reviewed against a
product site's generated reference before this repository became the place such
changes land.

Issue references below are to `AmbiqAI/helia-ui`.

### Fixed

- A titled code frame keeps the separator beneath it. The active tab drew its
  own ground over the bar it sits in, which erased the rule the frame is closed
  with; it now draws on that bar rather than across it (#67).
- The hub link in the product bar uses the shared external-link icon in the
  desktop header and in the mobile menu, so one glyph answers for both and the
  menu does not say something quieter than the bar (#67).
- An inline link's underline clears the descenders of the letters above it, so
  a link whose text has a `g` or a `p` in it is still legible (#67).
- A long reference name wraps instead of widening the page. A generated symbol
  is as long as its declaration makes it, and one of them was setting the
  scroll width of every page on a phone (#59).
- A multiline C or C++ signature separates its arguments without leaving a
  comma after the last one (#59).
- A C parameter shows the direction its documentation states rather than a
  default that reads as pointer nullability, which is a different claim than
  the one the source makes (#59).

## What changed in 0.1.0-alpha.11

The fourth release out of the heliaCORE reference migration: the parts that make
an accent cheap to spend in small amounts, the line that links a product site
back to the Dev Hub, and a section whose landing page is read from the bar above
it rather than from a pane beside it.

Issue references below are to `AmbiqAI/helia-ui`.

### Added

- `Stack`, the chain of labeled layers a product page opens with, one of them
  the page's own, folding to two columns below 62rem; and `Bars`, the comparison
  a heading needs and a chart is too heavy for, labeled tracks against one scale
  with an axis under them and every row text as well as a bar. Alongside them
  `Card` and `LinkCard` take `tone="ink"`, the ground the contrast hero uses,
  pinned dark in both themes with the inks and the accent re-derived against it,
  so a tile dropped into a light page does not carry a light-page accent onto a
  dark ground and the edge goes with the fill rather than becoming a brim; code
  frames on it join the on-dark scope the band and the background-media card
  share. `BigNumber` takes `accent`, which colors the unit and nothing else. The
  design system document states the accent budget, how much of each a page may
  spend, since a page that puts its accent only in the hero reads as a colored
  banner over a gray document and one that puts it everywhere has no accent at
  all (#99).
- `header.hub`, one line at the end of the product bar: muted text with the
  family's name in the product accent and a glyph that says the link leaves the
  site, so the product sites read as one family rather than as sites standing
  alone. Below the collapse point the bar has no room for it and the menu
  carries it at the end, which is where the sections go (#98).
- `sidebar: false` on an entry of the `sections` list, for the section whose
  landing page is read from the bar: no pane on its routes and no column
  reserved for one, whatever `sidebar: 'always'` says about the template. Below
  the bar's collapse point the sections have nowhere else to be, so the menu
  button's pane becomes the list of every section, each expandable to its pages
  with the current one open; the wide-screen pane stays the current section
  alone (#97).

### Changed

- The product accent's unaccented fallback is mixed one step further toward the
  ink the theme adapts to in the navigation bar. The accent is mixed for a
  card's ground at body sizes, and at the bar's size on the canvas the slate an
  unaccented site falls back to does not clear AA in the dark theme (#98).
- A `Stack` marks its accented layer with a rule along its block start and a
  tint of the accent behind it. Both are a colored edge on a surface, which is
  open for the owner's ruling (#100).

### Fixed

- A card header draws its mark, its metadata line and its actions only when it
  is given content for them. Astro binds a slot name where the caller is
  compiled rather than where its branch runs, so a `LinkCard` with no icon left
  `Astro.slots.has('icon')` true and the header drew an empty tonal disc above
  the eyebrow, and the same pattern on `meta` left an empty metadata line.
  `CardHeader` renders each optional region once and treats whitespace as
  absent, which fixes every caller rather than the one part (#101).

## What changed in 0.1.0-alpha.10

The third release out of the heliaCORE reference migration: the navigation a
product site of several sections needs, a searchable index over a generated
reference, and the chart options a benchmark page asks for.

Issue references below are to `AmbiqAI/helia-ui`.

### Added

- The plugin option `sections`, one list that drives both the top bar and the
  sidebar. Each section is a link in the bar, and a page inside a section reads
  that section's pages as the whole sidebar, under the section's name. The bar
  is derived from the list unless the site writes `header.links`, which stays
  the way out for a bar carrying something that is not a section. The entries
  stay Starlight's to resolve: the plugin appends one top-level group per
  section to the sidebar config, so `autogenerate`, slugs, labels and badges
  behave as they do anywhere else. Longest prefix decides which section a path
  is in, a section at the site base is the landing page alone, and a page in no
  section keeps the sidebar the site declared (#95).
- `RefIndex`, the searchable symbol index a generated reference of any size
  needs: search, a chip per facet value, a count, and a table whose names link
  to the anchor on the module page. The `ref-index-model` export is the row
  schema and `buildRefIndex`, a pure projection of `reference-model` over
  pluggable facet extractors, with an overlay keyed by symbol name for what a
  declaration cannot state, so the index ships before the manifest behind it
  does. `react/ref-index` is the island, and the part builds the rows at build
  and passes them as props, so no model and no fetch reach the browser. This is
  the first part to mount the React layer, which `check:islands` forbade
  outright; the rule now states the shape it was protecting, a `client:`
  directive and no children, so that nothing is composed or serialized across
  the boundary, and it fails everything else (#96, superseding #75).
- `orientation: 'horizontal'` on a chart spec, for categories whose names are
  too long to label under a vertical bar. The categories move to the y axis
  with the gridlines, and the left margin is taken from the longest label
  rather than from the density step. The data contract does not turn with the
  drawing: `x` still names the categories and `y` the measure, and only bars
  turn (#80).
- A `scale` on the value axis, `log` or `linear`, with either end of the domain
  fixed when the author wants it. A log axis ticks at 1, 2 and 5 through each
  decade and thins to the decades past ten ticks. Given a value at or below
  zero it draws linear and says which axis and why in the build log, since a
  log axis drops such a row silently. Bars anchor on the bottom of the axis
  whenever the floor is raised (#81).
- Bars in a group run in the order the series list names them, which is the
  order the legend reads, so a series list written in any order other than
  alphabetical no longer labels the chart against its own bars (#82).
- `axis` titles on either axis, with the margins paying for them rather than
  the plot area; `valueLabels`, which writes each bar's value at its end
  through the spec's number format and drops the set when the bands are too
  small to hold it; and `referenceLines`, a dashed rule in the chart ink, named
  once in the first band and carried on a series of its own so switching a
  series off does not take the rule with it (#83).

### Fixed

- The items of `CardGrid`, `ChartGroup`, `Masonry` and `Mosaic` keep level
  inside markdown content. Starlight steps every non-first child of its markdown
  container down by 1rem, which left the first card of a row in place and sat
  the rest 16px lower, and dropped the timeline rail and items below their own
  label. The block-start margin of a direct child is zeroed for all four and for
  the timeline group's three columns, unlayered so it stands in front of a page
  sheet that layers its rhythm (#94).

## What changed in 0.1.0-alpha.9

The second release out of the heliaCORE reference migration, and the one that
gives a product site its front door: a hero, an identity color the site sets
from the plugin rather than from a stylesheet, and the top bar, sidebar and
page title a landing page needs.

Issue references below are to `AmbiqAI/helia-ui`.

### Added

- `Hero`, in a `plain` and a `contrast` ground, the latter pinned dark in both
  themes. The headline is the default slot rather than a prop, so the word that
  carries the product accent is marked in the markup with `<em>`, and a
  `summary` slot takes a lede that needs bold or inline code (#68, #90).
- The plugin option `accent: '<product-id>'`. The per-product source colors move
  out of the hub's stylesheet into the package's semantic layer, where the
  accent is derived by mixing toward `--helia-ink-adaptive` at
  `--helia-product-accent-mix`, so only the amount moves with the theme; an
  unknown id fails the build. heliaCORE's source is a warm gold, `#a8762b`
  against the hub's former `#a36421`, dark enough to clear 4.5:1 on light paper
  and light enough to clear it on the dark canvas after the mix. The hub keeps
  its `product-*` classes and reads the package's tokens and mix dial through
  them, so its derivation is no longer a second copy (#69).
- The plugin option `header`, the product top bar: the site name as text at the
  left, its sections beside it, search and the theme menu at the end. A link is
  current by path prefix, `match` names a different prefix, a link to the site
  root is current on the root alone, and below 62rem the links give way to the
  button that opens the sidebar (#84).
- The plugin option `sidebar: 'always'`, which keeps the sidebar on a splash
  landing page. A route middleware sets the route's own flag, so the page shell,
  the frame and the layout widths all follow it and neither template is forked
  (#85).
- The plugin option `shell.pageTitle` and the `heliaFrontmatterSchema` fragment
  a site extends `docsSchema` with, so a page whose content opens with a `Hero`
  sets `helia: { pageTitle: false }` and drops Starlight's own heading instead
  of naming itself twice and shipping two h1s. The heading gives way to a bare
  `_top` anchor, which is what the skip link and the table of contents point at
  (#89).

### Changed

- Starlight's previous/next pagination is one compact row rather than two
  bordered cards the width of the column: links at the outer edges, an eyebrow
  over a body-sized title, the arrow on the title's line, and a stack under the
  narrow breakpoint. The rules are complete rather than corrective, so a site
  rendering its own `Pagination` gets the same look (#87).
- A `Band` inner carries the content pad as padding, with the cap raised by the
  same amount, so text keeps the reading margin once the reading frame is the
  viewport and the measure is unchanged where the band is wide enough to reach
  it (#86).
- The docs site adopts `header` and `sidebar: 'always'`, which makes it the
  fixture for both: its social link moves into the bar's own links, and it
  carries a splash landing page.

### Fixed

- The header's menu button drives Starlight's own menu state, setting
  `data-mobile-menu-expanded` where Starlight's button sets it, so a click
  between 50rem and 62rem opens the pane instead of locking the page against a
  pane of no width. The listeners are delegated and bound once per document, so
  a view transition leaves them bound (#88).
- A fenced code block inside a surface the package pins dark renders dark. One
  unlayered scope restates the frame, the code surface and the syntax token
  index from the dark theme, and pins the editor tab title, the terminal title
  bar and the inline buttons to the same inverted ink, since Expressive Code
  colors that chrome from its own settings rather than from `codeForeground`
  (#91).

## What changed in 0.1.0-alpha.8

The first fix release out of the heliaCORE reference migration, which ran the
Doxygen generator against a real library for the first time. Three defects that
run found are fixed; nothing else in the catalog moves.

Issue references below are to `AmbiqAI/helia-ui`.

### Added

- `scripts/fixtures/doxygen-groups`, real Doxygen output for a header with
  mixed-case groups, and the renderer and extractor tests that read it (#72).

### Fixed

- Generated reference routes are slugged the way Starlight slugs a content id,
  so the module pages, the JSON artifacts, `llms.txt` and the sidebar fragment
  all name the same URL. A group such as `NNConv` was linked at a route no host
  serves; on a case-sensitive filesystem every such link 404s (#72).
- Every generated module page carries a description, mechanical and worded per
  language when the source has no summary, so a library that does not brief
  each group still passes the plugin's discoverability check (#73).
- `llms.txt` resolves an `autogenerate` sidebar group to the group's own label
  instead of filing its pages under "Other pages" (#70).

## What changed in 0.1.0-alpha.7

This range starts at the tree tagged `v0.1.0-alpha.6` and is the Gate 1 catalog
build-out: the package ships 44 parts under `./astro/*`, against 28 in
0.1.0-alpha.6. Three props are renamed with no alias, so a consumer moving off
0.1.0-alpha.6 edits call sites: `overline` is `eyebrow` on
`CardHeader` and `LinkCard`, slot and all; `scale` on `BigNumber` is `step`;
and `externalUrl` on `MediaEmbed` is `href`.

Issue references below are to `AmbiqAI/helia-ui`.

### Added

- `Band`, `CardGrid`, `Masonry` and `Mosaic`, the parts that arrange a page
  rather than fill one: one density hook between them, and `CardGrid` is the
  `Reveal` itself under `stagger`, because the cascade runs on a reveal's
  direct children (#44, #36).
- `Chart` and `ChartGroup` draw with Observable Plot at build time and ship the
  result as inline SVG, so a page of charts carries no chart JavaScript (#45).
- A categorical chart palette: `--helia-chart-1` through `-6` stand on their
  own values instead of aliasing the advisory tones, and every step clears 3:1
  against the card surface it is drawn on (#49).
- `ChartInteractive` on Apache ECharts, taking the same data contract as the
  Plot parts and adding zoom, tooltip, brush and an `onSelect` callback;
  `echarts` joins as an optional peer (#50).
- `BigNumber` and `Sparkline`: the figure with no card around it, on tabular
  figures so a row lines up on the digit, and one series through the same
  Plot-at-build path `Chart` takes (#55).
- `IconTile`, `IconRow` and `SplitPanel`, with the tile and the card header's
  disc on one recipe so a tile lines up with a disc (#25 to #27).
- A Foundations page that walks the token system, with the color reference
  generated from the tokens themselves in both themes, contrast computed rather
  than transcribed, and checked as `check:foundations` (#43).
- `reference-model.ts`, the one shape every extractor produces, and five parts
  that render it: `RefSymbol`, `RefParams`, `RefSection`, `RefMembers` and
  `RefNav` (#59).
- `helia-ui-doxyref` and `helia-ui-tsref` beside `helia-ui-pyref`, so C, C++,
  TypeScript and Python references go through one model and one renderer rather
  than four designs that drift (#59).
- A reference run publishes what its pages are a view of: `reference.json`
  whole and per module, plus `llms.txt` and `llms-full.txt`, sorted and without
  a timestamp so it diffs (#59).
- Search and agent discoverability from the Starlight plugin: Open Graph,
  JSON-LD and a markdown rendition per page, and `llms.txt`, `llms-full.txt`,
  `content-index.json` and a `robots.txt` site-wide, read back off the built
  output by `check:discoverability` (#62).
- `--helia-tracking-caps` and `--helia-tracking-wordmark`, the two tracking
  steps that are roles rather than sizes, read by the eyebrow, the badge, the
  timeline label, the table head and the section eyebrow (#34).
- `LinkCard` forwards an `icon` slot and a `meta` prop through to `CardHeader`
  (#46).
- `check:peers`, which walks each page's chunk graph and fails when two chunks
  in one closure carry a peer's marker, or when the two lockfiles disagree on a
  peer's version (#54).
- `check:spelling`, which scans markdown, MDX, Astro, TypeScript, CSS and
  `.mjs` for the British forms as whole words, in both validate chains (#37).
- `check:styles` covers `line-height`, `letter-spacing`, `z-index`, `opacity`
  and the four offsets as well as motion, and `semantic.css` gains three layer
  steps and two opacity steps, since stacking and fade had no scale to point at
  (#60).
- The card family tables in the design system document are generated from the
  same reading the parts reference uses, and `check:astro-props` fails the
  build when they drift (#60).
- `SectionHeader` takes `titleAs`, a `class` and the rest props of a
  `<header>`, so a section that is not the page's second level can say so and a
  layout can reach the element (#60).
- `BadgeTone`, exported from `Badge`: the one advisory tone vocabulary, which
  `StatCard` and `BigNumber` take as well (#60).

### Changed

- The package docs describe what an option is and what it is for, in the
  present tense, rather than what it replaced (#37).
- The prose a reader meets is on the American forms throughout: content,
  comments, JSDoc, UI strings, sidebar labels and the strings the generators
  write. Identifiers, custom property names, routes and file names are
  untouched, so no link or import moves (#37).
- `SectionHeader` and the carousel's next control draw their arrow through
  `.helia-motion-cue`, so the package no longer depends on a rule a consuming
  site's own stylesheet defines (#35).
- One chart lane: `--chart-1` through `--chart-5` in the shadcn bridge alias
  `--helia-chart-1` through `--helia-chart-5`, so Recharts, Plot and ECharts
  draw the same series in the same color on one page, and the second accent
  feeds no chart (#60).
- `engines` on the package is `node >=24`, `npm >=11`, matching the monorepo
  root and the docs app: nothing has been exercised on the older pair, and the
  README, the guidance and the package `.npmrc` said otherwise (#60).
- `SectionHeader` draws its label with the `Eyebrow` part instead of a copy of
  it, so the label takes the muted ink and the label step the other three
  titled parts take, rather than the accent and the caption step (#60).
- The label above a title is `eyebrow` on every part that takes one:
  `CardHeader` and `LinkCard` rename `overline`, and `CardHeader`'s named slot
  renames with it. There is no alias; the primitive is the `Eyebrow` part, and
  a vocabulary with two words for it is two words to look up (#60).
- `scale` on `BigNumber` is `step`. The values and the default are unchanged.
  It names an absolute rung of the type ladder, which is what the part's own
  `--helia-big-number-step` hook already called it, where `scale` on
  `CardHeader` is a two-position switch off that card's own title step (#60).
- `deltaTone` on `BigNumber` is the `BadgeTone` union `StatCard` already took.
  `positive` and `negative` are gone: they map onto `success` and `danger`, and
  the other five tones now reach the unframed figure too (#60).
- `externalUrl` on `MediaEmbed` is `href`, the name every other link prop in
  the package takes (#60).
- `EditorialBand` composes the `.helia-band` recipe for its geometry and
  rhythm, so the two kinds of band on one page sit on the same measure and the
  same vertical step. Its ground, its treatment queries and its bleed cap are
  unchanged (#60).
- `EditorialBand` drops the `subtle` tone. It painted the same ground as
  `paper` and was a second name for it (#60).
- `titleAs` on `IconRow` drops `p`, so every part that titles itself takes `h2`
  to `h4` (#60).
- The list reset in the restated preflight names the generated parts that are a
  list rather than reaching `[data-slot] *`; the control reset still takes the
  subtree (#60).
- The caution ink takes a value per theme, `#a85c1f` on light and `#cd7b33` on
  dark, and the docs now fail on any contrast row below 4.5 rather than
  publishing the number and leaving a reader to notice it (#47).
- The docs app's optional peers take the package's ranges rather than exact
  pins, so the package tree and the site tree resolve one copy of each browser
  peer (#54).

### Fixed

- The code frame's title tab painted its inline-start corner outside the
  frame's curve, because the tab is the frame header's first child and nothing
  clips it. The tab now takes the frame radius (#41).
- The band reserved its inline gutter on the painted tones only, so a plain
  hero and a painted one started their content on different lines. Geometry now
  sits on the band unconditionally and the treatments change the ground alone
  (#42).
- `Band` and `EditorialBand` carried their ground past the main pane, so on a
  page with a table of contents the muted and contrast grounds painted across
  that column. Both cap the carry with `--helia-band-bleed-end`, which the
  Starlight layout zeroes once the contents column is reserved (#51).
- Seven defects on the React layer, six of them one root cause: `tailwind.css`
  loads Tailwind's theme and utilities but not its preflight, so the UA's own
  widget styling showed through wherever a generated class string was silent.
  The preflight's form-control and list resets are restated in the bridge,
  scoped to `[data-slot]` (#52).
- The hover surface stands on its own `--helia-surface-hover` token and
  `--popover` on the card surface, so a select row highlights under the pointer
  instead of resolving to the ground it is drawn on (#52).
- The Recharts cards rendered empty: the island mounted only after an
  `IntersectionObserver` fired, and the frame took its shape from a utility
  class, so a chart that mounted before the sheet applied measured zero. The
  chart mounts immediately and the frame carries `--chart-aspect` and
  `--chart-min-height` on the element (#53).
- Standalone, the docs site and the package resolved two copies of `recharts`
  and `lucide-react`, so a provider from one copy faced a consumer from the
  other and the frame came up empty with no error (#53, #54).
- A page sheet carrying its rhythm on `* + *` exempts the first child of the
  DOM, so the margin it left on the rest sat against a column break and started
  the middle and right masonry columns lower than the left (#56).
- The inline icon was an inline-flex box carrying its vertical-align on the
  SVG, where the property has no effect on a flex item, so at 16px body text
  the glyph's center sat 2.5px above the center of the words beside it. The box
  is inline-block with the offset on the box, and `text` draws a glyph and its
  word as one unit with a token gap (#57).
- `CardList`, `Band` and `EditorialBand` emitted a modifier class for the
  default value of `marker` and `tone`, which no sheet defined (#60).
- The row of figures sets `--helia-big-number-gap` rather than writing `gap` at
  the same weight as the part's own rule (#60).
- `components.json` pointed `utils` at `@/react/utils`, an alias that resolves
  only inside this package, so `shadcn add` wrote an import no consumer could
  resolve. It is rewritten to the `cn` peer, and `check:shadcn-align` fails a
  rewrite that matches nothing (#60).
- `react/chart.tsx` named `.dark` as the dark selector, which nothing in this
  package sets, so a Recharts series kept its light color through a theme flip;
  `react/chart-interactive.tsx` read two custom properties that do not exist
  (#60).
- The exports map omitted `./chart-plot-spec` and `./chart-echarts-theme`, both
  already shipped in `files`, so neither was reachable from outside the package
  (#60).

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
- `--helia-hero-treatment` and `--helia-accent-secondary` are wired rather
  than named only: the first decides the ground `EditorialBand` paints, the
  second is the `Badge` `secondary` tone and the link-card pointer cue (#23).
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
- `--helia-hero-treatment` takes `plain`, `gradient` or `tinted`; the `band`
  and `artwork` values are gone, and the dial now draws `EditorialBand` rather
  than being a name a site reads for itself (#23).
- `CodeBlock` wraps Starlight's `Code` instead of rendering through Shiki
  directly, so it requires the `heliaStarlight` plugin to be installed. Its
  props are unchanged (#17).
- `--chart-2` in the shadcn bridge follows `--helia-accent-secondary` rather
  than standing on its own value (#23). 0.1.0-alpha.7 takes this back: the
  bridge's chart set aliases the package's, and the second accent feeds no
  chart (#49, #60).
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
