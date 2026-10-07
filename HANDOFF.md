# KIT header consistency

Goal: issue #192, provide a shared Starlight header option that renders a regular product prefix and bold KIT suffix, and retain the HELIA hub link through compact desktop widths.

State: implemented on `codex/header-title-prefix` with review fixes. `regularTitlePrefix` defaults HELIA names and accepts an explicit KIT prefix. The hub link remains in the header at widths of at least 42rem, then moves to the mobile sidebar when present. Routes without a sidebar retain the header link. Package validation, docs build and 228 browser tests pass. PR #193 is open in draft. Review fixes restore the existing hero width, exercise the configured title prefix in the gallery and browser suite, and remove an obsolete breakpoint comment. The branch is not merged or released.

Decision: product sites must pin an immutable published helia-ui tag before their KIT title styling is complete. Do not pin this branch or a local package. The four KIT landing-page worktrees can be reviewed in parallel, but their shared-header dependency remains open until release.

Next: complete final PR #193 reviews and CI, resolve findings, then ask for approval. After merge and release, update heartKIT, sleepKIT, compressionKIT and physioKIT pins, rebuild and visually inspect each home page. Do not merge product PRs against an unreleased dependency.

References: AmbiqAI/helia-ui#192; `starlight/Header.astro`, `starlight/header-title.ts`, `starlight.css`, `docs/tests/header-hub.spec.ts`.

Publication: final review fixes are pushed. Fresh CI and Copilot re-reviews requested; verify the final head before approval. Product PRs remain draft pending shared helia-ui approval, release and immutable dependency pins.
