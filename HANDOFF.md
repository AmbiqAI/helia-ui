# Markdown asides as callouts

Goal: `heliaStarlight` renders Starlight's `:::note`, `:::tip`, `:::caution`
and `:::danger` asides as the package `Callout`, in `.md` and `.mdx` alike,
with no code on the consuming site. Issue: AmbiqAI/helia-ui#124.

Worktree: /Users/adam.page/Ambiq/helia/helia-ui-issue-124
Branch: 124-markdown-callouts, from 95eb9f1 (v0.1.0-alpha.14). Not pushed, no
pull request, no version bump. The main checkout is untouched.

## What is implemented

The callout recipe moved out of `Callout.astro`'s scoped `<style>` into
`recipes.css` under the same class names, so markup produced outside the
component is styled by it. `callout-tones.ts` holds the tone table -- the icon
each tone draws and the geometry the SVG is built from -- and both the
component and the transform build their markup from it, which is what keeps
the two renderings identical.

`starlight/markdown-callouts.ts` rewrites the aside after Starlight has built
it, so there is an element tree to work on rather than a directive to re-parse
and one transform covers both file types. The title is read back off
Starlight's own title node rather than from a table of defaults here, which
keeps a directive label, an unlabeled default, and a translated default all
correct, and the aside's `aria-label` is carried across. An aside inside a
`not-content` region is left alone, an aside inside an MDX JSX wrapper is
reached, and a rewritten aside no longer matches, so the pass is idempotent.
`markdownCallouts: false` opts out.

Astro 7 ships two markdown processors and the transform is registered on
whichever one the site configured: a Satteri hast plugin on
`processor.options.hastPlugins`, a rehype plugin on
`processor.options.rehypePlugins`, and a named warning if it is neither. This
is not optional. Satteri is the default and does not run `rehypePlugins`, so
registering through Astro's deprecated `markdown.rehypePlugins` option would
work only on a site that already sets that option, and would earn every other
site a deprecation warning for nothing. The two shapes differ in more than the
list: under Satteri the aside icon is a raw HTML node in `.md` and a
`set:html` fragment in `.mdx`, and the classes arrive as `class` rather than
`className`. Both are covered by fixtures.

The Markdown renditions and `llms.txt` are unaffected by design: they are built
from the authored source, never from the rendered page. Asserted both as a unit
test over `renderMarkdown` and against the built site.

## Consumer-visible changes

These belong in the release note.

- Markdown asides render as `Callout` by default. `markdownCallouts: false`
  restores Starlight's own asides.
- The callout CSS is global, in `recipes.css`, rather than scoped to the
  component. A site that overrode it through the scoped class no longer can.
- `Callout` carries `aria-label` equal to its title, and no longer sets
  `role`. `critical` used to set `role="alert"`; build-time content must not
  announce itself, and without an explicit role the implicit `complementary`
  landmark stands, the way Starlight's asides do.
- The callout icon is built from FontAwesome's path data rather than its
  renderer, so the SVG no longer carries `svg-inline--fa`, `fa-*`,
  `role="img"` or `data-icon`, and `fill` sits on the `svg` rather than the
  `path`. A site selecting `.helia-callout .svg-inline--fa` stops matching.
- A site that overrode the callout rules through Astro's scoped class has lost
  that override, now that the recipe is global in `recipes.css`. The class
  names are unchanged, so the override moves to a plain selector.
- New published file and export, `@ambiqai/helia-ui/callout-tones`.
- A `Callout` with a tone that is not a real tone now falls back to `note`
  whole, class included, instead of drawing the note icon under an unmatched
  class.

## Verified

`npm ci` in both trees, full `npm run validate`, `npm run docs:build`,
`npm run docs:test`, and `npm pack --dry-run`. The Satteri path is proved on a
stock consumer: the neuralspotx astro-site, installed from a packed tarball
with no `rehypePlugins` in its config, renders its `:::note` asides as
callouts in `.md` and `.mdx`, with no `starlight-aside` left and no Astro
deprecation warning. The unified path is proved by this repository's own
gallery, which sets `rehypePlugins` for mermaid. One aside's before/after HTML
was captured by building once with `markdownCallouts: false`, which also proves
the opt-out.

## Decisions and gotchas

- Only Starlight's four directive names have a markdown spelling. The other
  six tones stay with the component; there is no directive for them.
- `docs/src/content/docs/templates/web-apps.mdx` passed `tone="caution"`,
  which is not a callout tone. It rendered as an untinted note before.
  Corrected to `warning`; `resolveTone` falls back for a consumer's content,
  and `check:callout-tones` fails the build for this repository's own pages
  and the templates it ships.
- `CalloutTone` moved out of `Callout.astro` into `callout-tones.ts`, so the
  props generator now follows a relative type-alias import one hop and inlines
  it when it is a union of literals. `SymbolKind` and `ReferenceLanguage`,
  which are computed from a value, stay names; `ChartKind` and `SparklineKind`
  gained their members.
- The gallery build prints an Astro deprecation warning about
  `markdown.rehypePlugins`. That is the gallery's own mermaid entry in
  `docs/astro.config.mjs`, not this plugin, and it predates this branch.

## Next

Owner review of the diff, then an issue-linked pull request. No release.
