# HELIA product docs template

A minimal Starlight site wired to `@ambiqai/helia-ui`. Copy it into a product
repository as `docs/`, change the placeholders, and delete this README.

This directory is **repo-only**: it is not listed in the package's `files`, so
it is not in the published tarball. Copy it from
`AmbiqAI/helia-developer-hub` at `packages/helia-ui/templates/product-docs/`.

## Copy it out

```sh
git clone --depth 1 https://github.com/AmbiqAI/helia-developer-hub.git /tmp/hub
cp -R /tmp/hub/packages/helia-ui/templates/product-docs ./docs
cd docs
rm README.md
```

Move `.github/workflows/docs.yml` up to the repository root's `.github/`
directory; it expects the site at `docs/` and reads `docs/.nvmrc`.

## Point it at the package

`@ambiqai/helia-ui` is not published to npm yet. Until it is, depend on the git
tag rather than the version range this template ships with:

```jsonc
{
  "dependencies": {
    // Replace with "^0.1.0-alpha.0" once the package is on npm.
    "@ambiqai/helia-ui": "github:AmbiqAI/helia-developer-hub#helia-ui-v0.1.0-alpha.0",
  },
}
```

A git dependency installs the whole repository, so the package's `files` list
does not apply and the path stays `node_modules/@ambiqai/helia-ui` only if the
tag points at a tree whose root is the package. If it does not, use a local
`file:` path while developing and switch to the registry when it exists.

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
