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

Every stylesheet is unlayered apart from what `tailwind.css` declares, because
Starlight's own rules sit in `@layer starlight.*` and unlayered rules outrank
every layer. Load `tokens.css` before `semantic.css`: the semantic layer builds
on the primitives and a name defined in `tokens.css` must not be redefined.

`tailwind.css` deliberately carries no `@source` rules. Tailwind resolves a
`@source` glob relative to the file that declares it, so a scan list written
here would point inside `node_modules`. The consuming site declares its own
scan list in its Tailwind entry and imports this file from it.
