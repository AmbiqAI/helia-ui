# Renditions: carry what a component was handed

Goal: a page's Markdown twin and `llms-full.txt` carry what a part rendered,
not only what its source could be read to say. Issue: AmbiqAI/helia-ui#167,
which also closes AmbiqAI/helia-ui#156.

Worktree: /Users/adam.page/Ambiq/helia/helia-ui-issue-167
Branch: 167-rendition-sidecar, off origin/main (1ffa292, the alpha.17 bump).
No version bump in the branch. The main checkout is untouched.

## What is implemented

A build-time sidecar. A part renders, beside its markup, a hidden
`<script type="text/markdown" data-helia-rendition="<kind>" data-pagefind-ignore>`
holding the Markdown that part is worth to a reader:

- `AsciiTerminal` -- the transcript as a fenced block, commands with their
  prompt, everything else as it reads. The same string the copy control uses.
- `LinkCard` -- `- [title](href): description`, the description being the line
  it was handed.
- `CardHeader href` -- `- [title](href)`, the title being its children.
- `Button href` -- `[label](href)`.

`rendition.ts` at the package root holds the escaping, the builders and
`renditionText`, which is how a part reads its own rendered children back as
text. A part reads a slot once and writes it back with `set:html` rather than
rendering it twice; `CardHeader` already did that for its other regions.

The discoverability pass reads the sidecars back out of the built HTML at
`astro:build:done`, from the `sl-markdown-content` region only, and hands them
to `renderMarkdown`. `reduceTags` takes a cursor: where the source pass reaches
one of those components it asks the cursor for what the page stated and uses it
in place of the source-derived form, at that position.

Two passes. The first counts the occurrences the source has of each kind; a
kind whose count differs from the page's is dropped before the second. Nothing
else orders a sidecar against a component, and a grid mapped over a model is
one tag in the source and ten cards on the page: splicing that in order would
file the first card's line under the wrong heading. Where they disagree the
source form stands, which loses nothing that was not already lost.

`#156` is fixed in the source pass, because it also has to hold for Starlight's
own cards, which this package does not render: `description` is read as a prop
when the children are empty, and a link-bearing `Button`, `LinkCard`, `Card` or
`CardHeader` written with no `title` prop at all takes its title from its text
children. A `title` that is an expression is still a loss, not a guess.

## Consumer-visible

These belong in the release note, and alpha.18's section in RELEASE.md carries
them. Another session adds #166's bullet to the same section.

- Renditions gain component content. A site keeping a duplicate sentence under
  a walkthrough, or a "Read more" row that exists only for the rendition, can
  drop it after moving to the tag that carries this.
- No site code is needed. The sidecar renders nothing, search skips it, and it
  is not in the JSON-LD.
- A site composing its own rendition for a generated table or catalog should
  keep doing so: a set of cards built by mapping over a model is exactly the
  shape the count guard refuses to splice.
- `CardHeader` gains `rendition`, a boolean, for a part that wraps it and
  states the whole card itself. `LinkCard` sets it false.
- Semver: additive. Renditions change content, which is the point of it.

## Verified

`npm ci` in both trees, `npm run validate` (254 unit tests), `npm run
docs:build`, `npm run docs:test` (163 Playwright tests, gallery accessibility
included).

The gallery carries a "from a model" section and an
`<AsciiTerminal lines={imported} />` example whose text lives only in
`docs/src/lib/rendition-gallery-data.ts`. `docs/scripts/assert-docs-build.mjs`
asserts the gallery rendition carries that transcript fence, the card link and
line, the header's link and the button's link, and that no sidecar markup
reaches the rendition. Those strings are not in `gallery.mdx`, so the
assertions can only pass through the sidecar.

## Gotchas

- The splice is per kind and per page. An orphan sidecar -- a part the site
  renders from its own component, a Starlight `LinkCard` the source names but
  this package never renders -- disables that kind for that page rather than
  landing on the wrong component.
- `<script>` is the carrier rather than `<template>` because a raw text element
  is read back byte for byte. `</` and `<!--` are held with a backslash and
  taken back out; nothing else is escaped.
- A sidecar sits inside the part's own root element, never as a sibling: a
  display-less element still counts for `> :last-child` and `:first-child`,
  and the mosaic and card recipes use both.
- `LinkCard`'s `hasLine` is now whether the rendered line has text rather than
  whether the slot was declared, which matches what `CardHeader` does with its
  other regions.
- `npm ci` flips six `scripts/*.mjs` to mode 755 through bin linking. Keep that
  out of commits; stage by path.

## Next

Owner sign-off on the pull request, then merge. No release cut in this branch;
`portfolio.yaml` in aitg-handbook is not touched by it.
