# @ambiqai/helia-ui

The shared HELIA design system: tokens, primitive recipes, the Astro and React
component lanes, and the Starlight chrome overrides that Ambiq documentation
sites render through.

The package ships source. There is no build step and no compiled artefact: the
consuming site's bundler reads these files directly, so a consumer needs the
same Tailwind and Starlight majors listed under `peerDependencies`.

Documentation, with every part rendered, builds from `docs/` in this package
and publishes to https://ambiqai.github.io/helia-ui/ once the repository is in
place. Until then, build it locally with `npm run docs:dev`.

## Install

The package is private and is not published to the npm registry, so it is
installed from a git tag rather than by version range, once the repository it
is tagged in exists:

```sh
npm install github:AmbiqAI/helia-ui#v0.1.0-alpha.0
```

A tag rather than a branch: the tarball npm builds from a branch changes under
the consuming lockfile whenever the branch moves. The tag is the release, and
`RELEASE.md` is its manifest.

Then import the stylesheets in the site's Tailwind entry, in this order, and
add the package's parts to the site's `@source` list:

```css
@import '@ambiqai/helia-ui/tokens.css';
@import '@ambiqai/helia-ui/semantic.css';
@import '@ambiqai/helia-ui/recipes.css';
```

## Export map

| Export            | Contents                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `./tokens.css`    | Primitive tokens for both themes, plus the mapping onto Starlight's `--sl-*` variables        |
| `./semantic.css`  | The semantic layer: spacing, radius, type, weight, leading, ink, surfaces, tones              |
| `./recipes.css`   | `helia-surface`, `chip`, `eyebrow`, `button`, `card`, `badge`, `media`, focus and hover       |
| `./starlight.css` | Unlayered overrides for the Starlight shell: sidebar, header, search, TOC, steps, built-ins   |
| `./tailwind.css`  | The Tailwind v4 entry: layer order, the Starlight compat round trip, and the `@theme` mapping |
| `./shadcn.css`    | The shadcn variable bridge, imported by `./tailwind.css`                                      |
| `./astro/*`       | The publishable Astro parts, one file per part                                                |
| `./react/*`       | The React components, one file per component                                                  |
| `./starlight`     | The Starlight plugin: component overrides and the theme's own configuration                   |

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
utility class written in a part will not reach the stylesheet.

## Working on the package

```sh
npm ci            # Node from .nvmrc, npm 10 or later
npm run validate  # formatting, SPDX headers, notices, style, boundary and island checks
npm run docs:dev  # the documentation site, which consumes the package through its exports
npm run docs:build
npm run docs:test # Playwright smoke suite over the built docs site
```

`docs/` is a workspace of this package and a consumer of it: it reaches the
package only through the export map, so anything it cannot render is a gap in
the package rather than in the site.

## License

Ambiq-authored code in this package is licensed under the BSD 3-Clause License;
see [LICENSE](LICENSE). [NOTICE](NOTICE) carries the attribution that travels
with the package, and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) lists
the runtime dependency tree with its licenses. Several React parts are derived
from shadcn/ui source (MIT) and carry Ambiq modifications; the notices record
that origin. [RELEASE.md](RELEASE.md) is the release manifest recording
license and provenance.
