# Faithful Markdown renditions for MDX pages

Goal: the `.md` rendition and the llms artifacts carry what an MDX page
rendered, not the source it was written in. Issues: AmbiqAI/helia-ui#143
(`export const` bodies leaking as prose, attribute-only components rendering as
nothing), #135 (MDX comments and expressions kept), #136 (JSON-LD written into
a script body unescaped).

Worktree: /Users/adam.page/Ambiq/helia/helia-ui-issue-143
Branch: 143-rendition-fidelity, from 266f614. Not pushed, no pull request, no
version bump. The main checkout is untouched.

## What is implemented

`starlight/discoverability.ts` holds the rendition pass, and it is now four
transforms rather than two, each of them exported so the fixtures can reach it.

`stripEsm` tracks bracket depth from the opening line of a statement through
the line that closes it, so a multi-line `export const`, `export default`,
`export function` or named-import block goes whole instead of losing its first
line and publishing the rest. It runs with inline code held out, because a prop
carrying a code sample holds whole statements of someone else's JavaScript and
none of that is the page's ESM. A sentence that opens with the word "import" is
no longer mistaken for a statement: a real one ends in a quoted specifier.

`stripComments` drops `{/* ... */}` and `stripExpressions` drops the rest of
the MDX expressions. Both are gated on the file being `.mdx`, because a brace
in a plain markdown page is a character rather than syntax, and both skip
fenced code, because a page documenting MDX quotes the syntax on purpose.

`reduceTags` parses the tags into a tree instead of stripping them a line at a
time, and reduces the parts whose content is in their props: anything carrying
both a `title` and an `href` becomes `- [title](href): children`, a `Card` with
a title becomes an `h3` over its body, and an `AsciiTerminal` with an inline
literal `lines` prop becomes a fenced text block with its prompts. Everything
else still reduces to its children. A prop whose value is an expression is a
loss by design: the rendition has the source and not the page's scope.

`serializeJsonLd` escapes `<`, `>` and `&` as `\uXXXX`, and
`Discoverability.astro` serializes the graph through it.

## Consumer-visible changes

These belong in the release note.

- Renditions and `llms-full.txt` grow. A card grid that published three
  orphan sentences now publishes three links with their descriptions, and a
  terminal transcript that published nothing now publishes its lines.
- Renditions and `llms-full.txt` shrink where they carried source. MDX
  comments, MDX expressions and the body of a multi-line `export` statement
  are gone.
- A site working around the old losses should drop only the part this
  replaces. On neuralspotx that is the component-link recovery in
  `scripts/lib/render-agent-markdown.mjs`; the composer around it stays, and
  has to, because it rebuilds 94 renditions out of `cli.json` and
  `config.json` and the argument tables it draws from live in component props
  no source-based pass can read. Stacked on this branch the two produced no
  duplicate links.
- `llms.txt` line counts and byte sizes move for any page with a component on
  it. Nothing about the route list or the headings changes.
- JSON-LD is escaped. The rendered graph is unchanged for anything that parses
  it; a site diffing the built HTML will see `<` where it had `<`.
- `starlight/discoverability.ts` names five more exports: `stripComments`,
  `stripEsm`, `stripExpressions`, `reduceTags` and `serializeJsonLd`. The
  plugin entry re-exports none of them; they are reachable through
  `@ambiqai/helia-ui/starlight/discoverability.ts` the way `renderMarkdown`
  already was.
- `renderMarkdown` takes an `mdx` option, defaulting to `false` so that an
  external caller that does not pass it gets what it got before. The plugin
  passes the page's own extension.
- Semver: additive exports and a changed rendition body make this at least a
  minor pre-release bump, and it earns a release note rather than a line in
  the changelog. The version is the owner's call.

## Verified

`npm ci` in both trees, `npm run validate`, `npm run docs:build`,
`npm run docs:test`. `scripts/discoverability-rendition.test.mjs` covers each
transform over MDX fixtures, and `docs/scripts/assert-docs-build.mjs` proves
the claims on the built gallery rendition. Every page in the gallery was
rendered before and after the change and the diff read line by line: the only
removals are comments, expressions and descriptions that moved into their
card's list item.

## Decisions and gotchas

- A card title is an `h3` because `LinkCard` defaults to `h3`, not because of
  where the card sits. A generated heading does not join the page's heading
  index, which is read off the source.
- A fenced code block splits a prose run, so an element whose children hold a
  fence arrives at the tag parser with its closing tag in another run. An
  unclosed element takes the rest of the run and a stray closing tag is
  dropped, which is the degradation the line-at-a-time pass already had.
- An unbracketed multi-line assignment is still not tracked. Nothing
  distinguishes its second line from prose.
- `Callout` and the aside directives are untouched: the rendition carries the
  directive, which is what #124 settled.

## Next

Owner review of the diff, then an issue-linked pull request closing #143, #135
and #136. No release.

## Review answered

An adversarial pass blocked the first commit and is answered in the second.
`stripEsm` now requires a declaration shape before it will treat a line as a
statement, and gives the lines back when a statement never closes, so prose
that opens with `export` keeps itself and everything after it. A card title is
escaped into its link text and a target holding a bracket or a space is
enclosed, so a title cannot forge a link. The link rule fires on components
only, never on `<a>`. `closingBrace` consumes strings, the transcript fence is
sized to what it encloses, `IMPORT_WHOLE` requires a real binding, and the
`mdx` option defaults to `false`.
