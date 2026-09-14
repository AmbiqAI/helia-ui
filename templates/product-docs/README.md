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
    // Replace with "^0.1.0-alpha.1" once the package is on npm.
    "@ambiqai/helia-ui": "github:AmbiqAI/helia-ui#v0.1.0-alpha.1",
  },
}
```

While developing against an unreleased change, point the same entry at a local
checkout with `"file:../../helia-ui"` and switch back to the tag before
committing.

This template's `dependencies` also carry `react`, `react-dom` and the Tailwind
packages because the package declares them as optional peers: a site that
renders React islands or imports `@ambiqai/helia-ui/tailwind.css` installs them
itself. Drop the ones the site does not use.

Then generate the lockfile the workflow expects:

```sh
npm install --package-lock-only
npm ci
```

## Change the placeholders

| Where                 | What                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `package.json`        | `name`                                                              |
| `astro.config.mjs`    | `site`, `base`, `title`, `description`, the footer and social links |
| `src/styles/site.css` | `--helia-product-accent`, the one value this site owns              |
| `src/content/docs/**` | All of it. The sample pages are shape, not copy.                    |

`base` is the repository name with a leading slash, and every link in the
content is written relative so it follows `base` without repeating it. A
root-relative link (`/install/`) will 404 in production; a relative one
(`install/`) will not.

## What is wired up

- The `heliaStarlight()` plugin: the package stylesheets in the right order,
  and the shared footer, theme menu and mobile menu.
- Tailwind v4 through `src/styles/tailwind.css`, which owns the scan list.
- KaTeX: `remark-math` and `rehype-katex` on Astro's `markdown` config, with
  `katex/dist/katex.min.css` in `customCss`. Starlight's own `markdown` option
  does not take plugins.
- `@astrojs/react`, for pages that need an island. Nothing hydrates until one
  does.

## Claims

Product status, support, maturity and performance statements are not authored
here. They come from the approved export of the handbook's `portfolio.yaml`.
Draft, then get sign-off.
