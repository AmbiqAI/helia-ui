# Standalone tooling cleanup

Goal: remove remaining Developer Hub filesystem assumptions and provide supported consumer tooling. Tracked by AmbiqAI/helia-developer-hub#30 and AmbiqAI/helia-ui#38.

Branch: codex/standalone-tooling, based on alpha.12 at 8d217e4. Generated card tables now live in the gallery reference. Props generation ignores neighboring repositories and resolves formatter plugins from its own dependencies. Discoverability has a public CLI; installed-package validation exercises valid and broken artifacts. Retired monorepo paths and stale environment guidance are removed.

Verified: package validation with 180 passing unit tests, gallery build with 42 pages, 148 passing browser tests, and a scratch tarball consumer checking 139 files and 11 commands. Isolation regression creates a neighboring design document and verifies generation/checking leave it untouched.

Next: publish reviewed changes through a PR, prepare/release alpha.13 using this repository's workflows, then update heliaCORE's tag and lockfile and verify its clean install/rendering. Existing tags remain immutable. Developer Hub's consumer dependency update belongs to its owner; do not restore subtree mirroring.
