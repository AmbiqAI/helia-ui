# Landing polish

Goal: shared Button icon spacing, sidebar-free landing navigation, official Hero icons.
Issue: https://github.com/AmbiqAI/helia-ui/issues/196
Branch: codex/landing-polish, based on origin/main alpha.24.

Implemented: Button spacing; sidebar:false sections render no sidebar or hamburger; mobile section dropdown includes HELIA AI Developer Hub; narrow header hides duplicate Hub button; Hero eyebrowIcon URL replaces decorative dot while preserving text.

Verified: npm run validate (275 unit tests), gallery build and assertions, 230 gallery browser tests. Derived Astro prop reference regenerated. No dependency changes.

Consumers: isolated branches at /Users/adam.page/Ambiq/landing-polish/*; four KIT home TOCs disabled; six product hero marks updated. Consumer integration checks use temporary packed local package; committed pins remain immutable released tags. New shared release is needed before consumer pins and PR validation can be finalized.

Next: review shared PR, release via RELEASE.md, pin consumers, complete product rendered validation and PRs. GitHub CLI writes failed with empty/server responses; authenticated REST succeeded for issues. No merge authorized for this follow-up yet.

PR: https://github.com/AmbiqAI/helia-ui/pull/197
Two independent reviews found and resolved headerless section navigation and false data-attribute Hub hiding. Plugin prose updated; headerless middleware regression tests added. Release notes for alpha.25 included.

Final verification: latest shared docs build and 230 browser tests pass at 77794a1. All ten consumer draft PRs are attached to this chat. Four existing KIT browser tabs refreshed. Shared CI browser job still pending at last check; consumer pins await shared publication.

User follow-up: shared dropdown Hub label shortened to HELIA AI DEV Hub with a decorative external-site arrow. Applies to all ten consumers via the shared release.
