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
component is styled by it. `callout-tones.ts` holds the tone table -- icon,
role, and the SVG geometry -- and both the component and the transform build
their markup from it, which is what keeps the two renderings identical.

`starlight/markdown-callouts.ts` is a rehype plugin. Starlight turns a
directive into `<aside class="starlight-aside ...">` during the remark pass,
so by rehype there is an element tree to rewrite and one transform covers both
file types. The title is read back off Starlight's own title node rather than
from a table of defaults here, which keeps a directive label, an unlabeled
default, and a translated default all correct. An aside inside a `not-content`
region is left alone, and a rewritten aside no longer matches, so the pass is
idempotent. The plugin installs it through an added Astro integration, because
`markdown` is Astro's config rather than Starlight's; Astro concatenates
arrays on `updateConfig`, so a site's own rehype plugins still run.
`markdownCallouts: false` opts out.

The Markdown renditions and `llms.txt` are unaffected by design: they are built
from the authored source, never from the rendered page. Asserted both as a unit
test over `renderMarkdown` and against the built site.

## Verified

`npm ci` in both trees, full `npm run validate` (197 unit tests), and
`npm run docs:build` (42 pages, docs assertions pass). One aside's before/after
HTML was captured by building once with `markdownCallouts: false`, which also
proves the opt-out.

## Decisions and gotchas

- Only Starlight's four directive names have a markdown spelling. The other
  six tones stay with the component; there is no directive for them.
- `docs/src/content/docs/templates/web-apps.mdx` passed `tone="caution"`,
  which is not a callout tone. It rendered as an untinted note before and
  threw once the tone table became a lookup. Corrected to `warning`, and
  `calloutDefinition` now falls back to `note` so an unchecked MDX string
  cannot take a build down.
- `CalloutTone` moved out of `Callout.astro`, so the generated props reference
  shows the alias name instead of the nine members, the way `ReferenceLanguage`
  already does. The Callouts page it links to still lists every tone.
- The rewritten aside drops Starlight's `aria-label`, matching `Callout.astro`,
  which carries no accessible name either. Giving the component one is a
  separate question.

## Next

Owner review of the diff, then an issue-linked pull request. No release.
