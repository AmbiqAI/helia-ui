# @ambiqai/helia-ui

The shared HELIA design system: tokens, primitive recipes, and the Starlight
chrome overrides that every Ambiq documentation site renders through.

The package ships source. There is no build step and no compiled artefact: the
consuming site's bundler reads these files directly, so a consumer needs the
same Tailwind and Starlight majors listed under `peerDependencies`.

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

Every stylesheet is unlayered apart from what `tailwind.css` declares, because
Starlight's own rules sit in `@layer starlight.*` and unlayered rules outrank
every layer. Load `tokens.css` before `semantic.css`: the semantic layer builds
on the primitives and a name defined in `tokens.css` must not be redefined.

## The Astro parts

`astro/` holds the parts: the primitives, the card family, `Badge`, `Media`, the
carousel and the named standouts. They are imported by name, without the
extension, and Astro compiles them from the package as it would from the
consuming site's own tree:

```astro
import Card from '@ambiqai/helia-ui/astro/Card';
```

A part takes its data through props and children, builds only on other files in
the package, and never reaches into the site that renders it.

`tailwind.css` deliberately carries no `@source` rules. Tailwind resolves a
`@source` glob relative to the file that declares it, so a scan list written
here would point inside `node_modules`. The consuming site declares its own
scan list in its Tailwind entry and imports this file from it. That list has to
name `astro/**/*.astro` in this package as well as the site's own tree, or a
utility class written in a part will not reach the stylesheet.

## License

Ambiq-authored code in this package is licensed under the BSD 3-Clause License;
see [LICENSE](LICENSE). [NOTICE](NOTICE) carries the attribution that travels
with the package, and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) lists
the runtime dependency tree with its licenses. Several React parts are derived
from shadcn/ui source (MIT) and carry Ambiq modifications; the notices record
that origin. [RELEASE.md](RELEASE.md) is the release manifest recording
license and provenance.
