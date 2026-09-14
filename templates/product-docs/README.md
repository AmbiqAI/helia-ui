# HELIA product docs template

A minimal Starlight site wired to `@ambiqai/helia-ui`. Copy it into a product
repository as `docs/`, change the placeholders, and delete this README.

This directory is **repo-only**: it is not listed in the package's `files`, so
it is not in the published tarball. Copy it from `AmbiqAI/helia-ui` at
`templates/product-docs/`.

The package's own documentation, with every part rendered, is at
https://ambiqai.github.io/helia-ui/.

## Copy it out

```sh
git clone --depth 1 https://github.com/AmbiqAI/helia-ui.git /tmp/helia-ui
cp -R /tmp/helia-ui/templates/product-docs ./docs
cd docs
rm README.md
```

Move `.github/workflows/docs.yml` up to the repository root's `.github/`
directory; it expects the site at `docs/` and reads `docs/.nvmrc`.

## Point it at the package

`@ambiqai/helia-ui` is not published to npm yet, so this template depends on a
git tag in the package's own repository, whose root is the package:

```jsonc
{
  "dependencies": {
    // Replace with "^0.1.0-alpha.5" once the package is on npm.
    "@ambiqai/helia-ui": "github:AmbiqAI/helia-ui#v0.1.0-alpha.5",
  },
}
```

While developing against an unreleased change, point the same entry at a local
checkout with `"file:../../helia-ui"` and switch back to the tag before
committing.

This template's `dependencies` also carry `react`, `react-dom` and the Tailwind
packages because the package declares them as optional peers: a site that
renders React islands or imports one of the package's Tailwind entries installs
them itself. `@astrojs/starlight-tailwind` is there because this is a Starlight
site and `src/styles/tailwind.css` imports
`@ambiqai/helia-ui/starlight-tailwind.css`; an app without the Starlight shell
imports `@ambiqai/helia-ui/tailwind.css` and drops it. Drop the ones the site
does not use.

Then generate the lockfile the workflow expects:

```sh
npm install --package-lock-only
npm ci
```

## Change the placeholders

| Where                  | What                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `package.json`         | `name`                                                              |
| `astro.config.mjs`     | `site`, `base`, `title`, `description`, the footer and social links |
| `playwright.config.ts` | `base`, to match `astro.config.mjs`                                 |
| `tests/routes.spec.ts` | `BASE`, to match `astro.config.mjs`                                 |
| `src/styles/site.css`  | `--helia-product-accent`, the one value this site owns              |
| `src/content/docs/**`  | All of it. The sample pages are shape, not copy.                    |

`base` is the repository name with a leading slash, and every link in the
content is written relative so it follows `base` without repeating it. A
root-relative link (`/install/`) will 404 in production; a relative one
(`install/`) will not.

## What is wired up

- The `heliaStarlight()` plugin: the package stylesheets in the right order,
  and the shared footer, theme menu and mobile menu.
- Tailwind v4 through `src/styles/tailwind.css`, which owns the scan list. A
  `@source` may point back into `node_modules` — an explicit path is not subject
  to the ignore rules automatic detection applies — so the package's own parts
  are scanned from there. Name individual `react/**` components rather than the
  directory: shadcn writes long variant strings into every generated file.
- KaTeX: `remark-math` and `rehype-katex` on Astro's `markdown` config, with
  `katex/dist/katex.min.css` in `customCss`. Starlight's own `markdown` option
  does not take plugins.
- `@astrojs/react`, for pages that need an island. Nothing hydrates until one
  does.

## Bringing MkDocs content across

`helia-ui-mkdocs-convert` does the mechanical part — admonitions, content tabs,
`:material-*:` icons, Termynal blocks, relative links, front matter — and prints
what needs a human:

```sh
npx helia-ui-mkdocs-convert --docs ../docs --out src/content/docs \
  --base /PRODUCT-REPO-NAME --public public \
  --sidebar src/generated/docs-sidebar.json
```

Spread the sidebar fragment into `sidebar` in `astro.config.mjs`. The options,
the full list of rewrites and the hand-pass list are in the package's
["Migrating from MkDocs"](https://ambiqai.github.io/helia-ui/migrating-from-mkdocs/)
guide.

## Route tests

`npm test` runs Playwright against the built site: `tests/routes.spec.ts` reads
the sidebar fragment above and asserts every nav route returns 200, falling
back to this template's own pages until there is a fragment.

Build first — the test server serves `dist/` and will not build for you:

```sh
npm run build
npm test
```

`scripts/serve-dist.mjs` is that server: dependency-free, and used instead of
`astro preview` because preview can detach from the test runner and fail the
suite before any test reports. The browser is Playwright's headless shell, so
CI needs `npx playwright install chromium-headless-shell` once.

## Claims

Product status, support, maturity and performance statements are not authored
here. They come from the approved export of the handbook's `portfolio.yaml`.
Draft, then get sign-off.
