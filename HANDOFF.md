# Muted code backgrounds

Issue: AmbiqAI/helia-ui#187. Branch: codex/muted-code-backgrounds.

Implemented per-block `tone="muted"` / `tone="default"` and site-wide `code: { tone: 'muted' }`. Existing defaults and explicit site frame overrides are preserved. Gallery and generated prop reference updated.

Verified: package validation, 271 unit checks, gallery build, all 221 browser checks. Separate site-default build verified Markdown backgrounds in both themes; screenshots inspected. Gallery config restored after that check.

Next: PR/CI review, release through RELEASE.md after approval, then update compressionKIT's immutable dependency and enable muted tone. No package release or consumer patch yet.
