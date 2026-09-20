# AsciiTerminal: later instances on a page never animated

Goal: every animated `AsciiTerminal` on a page types, replays and autoplays,
not just the first. Issue: AmbiqAI/helia-ui#149. PR: AmbiqAI/helia-ui#150.

Worktree: /Users/adam.page/Ambiq/helia/helia-ui-issue-149
Branch: 149-terminal-late-children, off origin/main (1d477cc, v0.1.0-alpha.16
notes). No version bump in the branch. The main checkout is untouched.

## What is implemented

`astro/AsciiTerminal.astro` emits its behavior inline after each instance and
defines the element in the first copy, so every instance the parser reaches
after that was upgraded on its opening tag, before its lines existed.
`connectedCallback` bound nothing, set `data-ready` and never retried.

`connectedCallback` now decides how to reach the transcript and `setup()` holds
the work it used to do. Children already there: set up now. None yet and the
document still parsing: `DOMContentLoaded`, once. None yet after the parse: a
`childList` `MutationObserver` that fires when a `[data-line]` appears, for an
element a script connects empty and fills a tick later.

Readiness is an instance field and a promise rather than the `data-ready`
attribute, which a `cloneNode(true)` copies: guarding on the attribute left a
clone of a set-up terminal permanently inert.

`play()` is a method on the element. It awaits readiness before running, so a
consumer's own load listener registered before the component's can call it, and
resolves when the run ends.

## Consumer-visible

These belong in the release note.

- Second and later animated terminals on a page replay and autoplay. A site
  carrying a workaround, such as re-inserting a clone before playing, should
  drop it rather than stack it on this.
- A clone of a set-up terminal sets itself up when it is connected.
- `play()` is new on the element and is the way to start a transcript without
  the replay control. It resolves when the run ends.
- No prop, markup or styling change. The default static form still ships
  nothing, and a page with one terminal behaves as it did.
- Semver: a fix plus an additive element method. Which pre-release carries it,
  and whether it earns a release note, is the owner's call.

## Verified

`npm ci` in both trees, `npm run validate`, `npm run docs:build`,
`npm run docs:test`. `docs/tests/ascii-terminal.spec.ts` drives the transcripts
on `/code/` by caption, and was proven to fail against the unfixed component:
the second transcript reached 0 of 7 visible lines on scroll and a replay click
left `data-playing` unset. `docs/src/content/docs/code.mdx` carries two more
animated transcripts, one of them `autoplay={false}`, which is what the suite
drives.

## Gotchas

- `astro/CodeTabs.astro`, `astro/DataTable.astro` and `astro/MediaEmbed.astro`
  carry the same inline-per-instance shape and the same `data-ready` guard.
  They were not touched here, and whether they are exposed depends on whether
  their children are read at connection.
- The retry observer watches `subtree` because the lines sit two levels down.
  An element filled a node at a time could still be set up on a partial
  transcript; a script that appends the frame whole cannot.
- `npm ci` flips six `scripts/*.mjs` to mode 755 through bin linking. Keep that
  out of commits; stage by path.

## Next

Owner sign-off on #150, then merge. No release cut in this branch.
