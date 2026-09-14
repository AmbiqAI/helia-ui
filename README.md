# @ambiqai/helia-ui

The shared HELIA design system: tokens, primitive recipes, the Astro and React
component lanes, and the Starlight chrome overrides that Ambiq documentation
sites render through.

The package ships source. There is no build step and no compiled artefact: the
consuming site's bundler reads these files directly, so a consumer needs the
same Tailwind and Starlight majors listed under `peerDependencies`.

Documentation, with every part rendered, builds from `docs/` in this package
and publishes to https://ambiqai.github.io/helia-ui/. Build it locally with
`npm run docs:dev`.

## Install

The package is private and is not published to the npm registry, so it is
installed from a git tag in `AmbiqAI/helia-ui` rather than by version range:

```sh
npm install github:AmbiqAI/helia-ui#v0.1.0-alpha.5
```

A tag rather than a branch: the tarball npm builds from a branch changes under
the consuming lockfile whenever the branch moves. The tag is the release, and
`RELEASE.md` is its manifest.

`engines.npm` is a floor, `>=10`, not the `^10` this repository develops
against, because a git install makes this manifest a dependency manifest in
your tree: a pin here warns on npm 11 and fails outright in a project of your
own that sets `engine-strict`. Nothing about consuming this package needs npm
10 — no lockfile ships with it — so the major stays pinned only in the app
roots that commit one, and working on the package itself is held to npm 10 by
the workflow in "Working on the package" rather than by this field.

`astro` and `@astrojs/starlight` are the only required peers. Everything the
React lane needs — `react`, `react-dom`, `radix-ui`, `cmdk`, `lucide-react`,
`class-variance-authority`, `cn`, `recharts`, `sonner`,
`@tanstack/react-table` — and everything the Tailwind entry needs —
`tailwindcss`, `@tailwindcss/vite`, `@astrojs/starlight-tailwind` — is an
optional peer, so a site that only imports stylesheets installs none of it. A
site that imports from `./react/*` or `./tailwind.css` declares those itself,
at the majors listed under `peerDependencies`.
`@astrojs/starlight-tailwind` is needed only by a site that imports
`./starlight-tailwind.css`.

Only the paths in `files` travel to a consumer, and that is what applies to a
git install too: npm clones the ref and packs it with the same rules the
registry tarball uses. So `docs/`, `templates/`, the tests beside the scripts
and the lockfile stay out of a consumer's tree, and there is no `.npmignore` —
`files` is the allowlist and it takes precedence over one.

Then import the stylesheets in the site's Tailwind entry, in this order, and
add the package's parts to the site's `@source` list:

```css
@import '@ambiqai/helia-ui/tokens.css';
@import '@ambiqai/helia-ui/semantic.css';
@import '@ambiqai/helia-ui/recipes.css';
```

Then copy `@ambiqai/helia-ui/site-theme.css` into the site as
`src/styles/site-theme.css` and load it from `customCss` after those sheets.
Those nine dials — accent, radius scale, motion scale, fonts, surface tint,
hero treatment, density — are what a site may vary on its own. Anything else
is a package change.

Cards and panels never carry an accent edge or brim; accent lives in artwork,
badges, icons and type.

## Export map

| Export                     | Contents                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `./tokens.css`             | Primitive tokens for both themes, plus the mapping onto Starlight's `--sl-*` variables                   |
| `./semantic.css`           | The semantic layer: spacing, radius, type, weight, leading, ink, surfaces, tones                         |
| `./recipes.css`            | `helia-surface`, `chip`, `eyebrow`, `button`, `card`, `badge`, `media`, focus, and the named transitions |
| `./site-theme.css`         | The site theme contract: a template of the nine dials a consuming site may set, and nothing else         |
| `./starlight.css`          | Unlayered overrides for the Starlight shell: sidebar, header, search, TOC, steps, built-ins              |
| `./tailwind.css`           | The Tailwind v4 entry: layer order and the `@theme` mapping, with no Starlight dependency                |
| `./starlight-tailwind.css` | `./tailwind.css` with `@astrojs/starlight-tailwind` in front; the entry a Starlight site imports         |
| `./shadcn.css`             | The shadcn variable bridge, imported by `./tailwind.css`                                                 |
| `./astro/*`                | The publishable Astro parts, one file per part                                                           |
| `./react/*`                | The React components, one file per component                                                             |
| `./starlight`              | The Starlight plugin: component overrides and the theme's own configuration                              |

Every stylesheet is unlayered apart from what `tailwind.css` declares, because
Starlight's own rules sit in `@layer starlight.*` and unlayered rules outrank
every layer. Load `tokens.css` before `semantic.css`: the semantic layer builds
on the primitives and a name defined in `tokens.css` must not be redefined.

## The three lanes

**`astro/` — the parts.** The primitives, the card family, `Badge`, `Media`,
the carousel and the named standouts. They are imported by name, without the
extension, and Astro compiles them from the package as it would from the
consuming site's own tree:

```astro
import Card from '@ambiqai/helia-ui/astro/Card';
```

A part takes its data through props and children, builds only on other files in
the package, and never reaches into the site that renders it.

**`react/` — the interactive components.** The shadcn-derived layer, rendered
as Astro islands. React context does not cross Astro's MDX component boundary,
so a compound component is composed in an island in the consuming site and the
island is what a page imports. The components take their data through props for
the same reason the Astro parts do.

**`starlight/` — the plugin.** The one lane that is allowed to know Starlight
exists: it installs the component overrides, the footer and the theme menu, and
wires the theme's configuration through Starlight's virtual modules.

```js
import { heliaStarlight } from '@ambiqai/helia-ui/starlight';
```

`tailwind.css` deliberately carries no `@source` rules. Tailwind resolves a
`@source` glob relative to the file that declares it, so a scan list written
here would point inside `node_modules`. The consuming site declares its own
scan list in its Tailwind entry and imports this file from it. That list has to
name `astro/**/*.astro` in this package as well as the site's own tree, or a
utility class written in a part will not reach the stylesheet:

```css
@import '@ambiqai/helia-ui/starlight-tailwind.css'; /* or tailwind.css */

@source '../content/**/*.{md,mdx}';
@source '../../node_modules/@ambiqai/helia-ui/astro/**/*.astro';
@source '../../node_modules/@ambiqai/helia-ui/starlight/**/*.astro';
```

Pointing a `@source` back into `node_modules` is the supported form and it
works: Tailwind skips `node_modules` when it detects sources automatically, not
when a path is named explicitly, so a directory, a glob and a single file all
scan. Prefer naming individual components from `react/**` rather than the whole
directory — shadcn writes long variant strings into every generated file, and
scanning the layer for components a site never renders roughly doubles the
emitted stylesheet.

## Working on the package

```sh
npm ci                 # Node from .nvmrc; npm 10, and only npm 10
npm run validate       # formatting, SPDX headers, notices, style, boundary and island checks
npm test               # the script unit tests

npm ci --prefix docs   # the docs site installs separately, once
npm run docs:dev       # the documentation site, which consumes the package through its exports
npm run docs:build
npm run docs:test      # Playwright smoke suite over the built docs site
```

`npm run docs:test` serves an existing build rather than making one, so build
first. The server behind it is `scripts/serve-dist.mjs`, shipped as the
`helia-ui-serve-dist` bin: a dependency-free static server over `dist/` under a
base path, used as the Playwright `webServer` here and in the hub. It stands in
for `astro preview`, which treats `--port` as a hint: when the port is busy it
starts on another one and reports that only on stdout, so the suite times out
waiting for `webServer.url` or, under `reuseExistingServer`, tests whatever
unrelated server holds the port. Preview instances also outlive the runner, and
newer Astro detaches outright under agent environment variables. The static
server fails loudly on a busy port instead. `astro preview` is still the right
thing for a human reading the site.

`docs/` is a consumer of this package, not a workspace of it: it reaches the
package only through the export map, so anything it cannot render is a gap in
the package rather than in the site. It has its own `package.json`, its own
lockfile and its own `npm ci`, and it depends on the package as `file:..`. The
reason it is not a workspace is that a `workspaces` field in a package manifest
travels with the package: it lands in the lockfile entry of everyone who
installs it, and it describes a directory that is not in the tarball.

`.npmrc` sets `engine-strict=true` in the package root and in `docs/` alike, so
the node range refuses to install rather than warning. `docs/` also pins
`engines.npm` to `^10`, which stops a newer npm silently rewriting its lockfile
in a dialect CI does not install from; the package root cannot carry that pin,
because its manifest is also what a consumer installs (see "Install"). Use
`npx -y npm@10 ...` here regardless if the npm on your path is newer — this
root commits a lockfile too, and nothing but the workflow protects it.

## Starting a product docs site

`templates/product-docs/` is a working Starlight site wired to this package:
the plugin, the Tailwind entry, the product accent, KaTeX and a Pages workflow.
Copy it into a product repository as `docs/` and read its README.

It is deliberately absent from `files`, so it is not in the published tarball:
it depends on this package, and a copy of it inside the package's own
node_modules would serve no one. Take it from the repository.

## License

Ambiq-authored code in this package is licensed under the BSD 3-Clause License;
see [LICENSE](LICENSE). [NOTICE](NOTICE) carries the attribution that travels
with the package, and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) lists
the runtime dependency tree with its licenses. Several React parts are derived
from shadcn/ui source (MIT) and carry Ambiq modifications; the notices record
that origin. [RELEASE.md](RELEASE.md) is the release manifest recording
license and provenance.
