# Landing polish

Goal: shared Button icon spacing, sidebar-free landing navigation, official Hero icons.
Issue: https://github.com/AmbiqAI/helia-ui/issues/196
Branch: codex/landing-polish, based on origin/main alpha.24.

Implemented: Button spacing; sidebar:false sections render no sidebar or hamburger; mobile section dropdown includes HELIA AI Developer Hub; narrow header hides duplicate Hub button; Hero eyebrowIcon URL replaces decorative dot while preserving text.

Verified: npm run validate (273 unit tests), gallery build and assertions, 230 gallery browser tests. Derived Astro prop reference regenerated. No dependency changes.

Consumers: isolated branches at /Users/adam.page/Ambiq/landing-polish/*; four KIT home TOCs disabled; six product hero marks updated. Consumer integration checks use temporary packed local package; committed pins remain immutable released tags. New shared release is needed before consumer pins and PR validation can be finalized.

Next: review shared PR, release via RELEASE.md, pin consumers, complete product rendered validation and PRs. GitHub CLI writes failed with empty/server responses; authenticated REST succeeded for issues. No merge authorized for this follow-up yet.
