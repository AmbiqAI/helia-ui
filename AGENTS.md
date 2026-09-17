# Agent guidance for helia-ui

`@ambiqai/helia-ui` is the shared HELIA design system: tokens, CSS layers, Astro
parts, a Starlight plugin, React islands, and the reference extractors the
product sites generate their API docs with.

**This repository is authoritative.** The package used to live at
`packages/helia-ui` in `helia-developer-hub` and be mirrored out with
`git subtree split`. That is retired. Changes land here, CI runs here, tags are
cut here, and the Dev Hub is now an ordinary consumer alongside heliaCORE and
every other product site. If you arrived from a consuming site because a part
was wrong or missing, the fix belongs here and reaches your site through a new
tag, not through a patched copy in your tree.

## Layout

| Path                   | What it is                                             |
| ---------------------- | ------------------------------------------------------ |
| `astro/`, `starlight/` | Astro parts and the Starlight theme plugin             |
| `react/`               | shadcn-derived components, the `/react` export         |
| `*.css`                | Tokens and layers, in order: tokens, semantic, recipes |
| `scripts/`             | The reference extractors, the checks, the unit tests   |
| `docs/`                | The gallery site, a standalone project (see below)     |
| `templates/`           | Starting points a new product site is copied from      |

The package ships source with no build step, so the published tree is the
repository tree. `files` in `package.json` decides what a consumer receives; a
helper left out of it is present for you and missing for them, which CI's
installable-package job exists to catch.

## Environment

Node 24 and the npm 11 it ships, everywhere. `.nvmrc` carries the major,
`packageManager` records the exact npm, and `engine-strict=true` in `.npmrc`
makes `engines` a refusal rather than a warning, both here and in a consumer's
tree that installs this package.

`docs/` has its own `package.json` and its own lockfile and is deliberately not
a workspace of the package. A `workspaces` field here would follow the package
into a consumer's dependency tree. So the two install separately, each lockfile
has to stand on its own, and every command below says which tree it runs in.

Never hand-edit a lockfile. Regenerate with
`npm install --package-lock-only --ignore-scripts` in the tree that changed,
then prove it with `npm ci --ignore-scripts` before you open the pull request.

## Running things

```sh
npm ci                       # package
npm ci --prefix docs         # gallery, separate lockfile
npm run validate             # formatting, SPDX, spelling, styles, boundaries, islands
npm test                     # the shared unit suite
npm run docs:build           # gallery build, includes the discoverability assertions
npm run docs:test            # gallery routes, interactions, accessibility
npm run docs:dev             # gallery dev server
```

`npm run validate`, `npm test`, `npm run docs:build` and `npm run docs:test` all
run in CI on every pull request, together with a job that packs the tarball,
installs it outside the repository and proves the `files` set and the `bin`
entries. Run them before you ask for review rather than after CI says so.

Playwright's browsers are already cached on this machine. Never run
`npx playwright install` locally and never run a headed browser; the smoke suite
is headless.

## Releasing

Two dispatched stages, both described in `RELEASE.md`, which is the process of
record: a reviewed version bump that opens a pull request and never tags, then a
publication stage that refuses anything but main, a version the manifest does
not carry, a commit CI has not passed, or a tag that already exists.

Consumers pin an immutable tag, never a branch:

```json
{
  "dependencies": { "@ambiqai/helia-ui": "github:AmbiqAI/helia-ui#v<version>" }
}
```

A tag is never moved or deleted. A bad release is superseded by the next one.

## Making a change

- Compose from the parts that exist before adding one. A part earns its place by
  being needed by more than one site; site-specific composition belongs in the
  site, built on the tokens.
- A new part comes with a gallery page showing every variant, labeled with the
  prop or class that produces it, and a test in `docs/tests/` if it has
  behavior.
- Extractor changes come with a case in the matching `scripts/*.test.mjs`.
- Never a colored brim or side rule on a card or panel. It has been rejected
  twice.

## House rules

These hold in every AITG repository.

- American English. A spelling check in `validate` enforces it.
- Comment the why, never the what. A comment that restates the code, narrates a
  change, or talks to the reviewer gets deleted instead of written. Deferred
  work is `TODO(#123): <one line>`, never a bare TODO.
- No attribution, co-author, "Generated with", or sign-off lines anywhere in
  commits, pull requests, issues or release notes.
- Stage files explicitly by path. Never `git commit -a`: it has swept a
  rewritten lockfile into a commit before.
- Do not invent product status, performance numbers or support claims. Those
  come from the approved portfolio export, and drafting one is a request for
  approval rather than a statement.
