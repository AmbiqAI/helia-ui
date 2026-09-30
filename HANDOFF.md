# Mobile section navigation

## Goal and scope

Implement the mobile section dropdown in shared HELIA UI and adopt it across product docs. Approved issue: https://github.com/AmbiqAI/helia-ui/issues/182.

## State

Worktree: /Users/adam.page/Ambiq/helia/helia-ui-mobile. Branch: codex/mobile-section-dropdown. Base: origin/main 3692215 (alpha.20). Primary checkout untouched. Published PR: https://github.com/AmbiqAI/helia-ui/pull/183 (implementation commit 8e34075). Release and deployment remain pending.

Shared header now exposes a native mobile section disclosure. Selecting a section navigates to its landing page; the hamburger shows only that section's pages. Desktop navigation is preserved. Keyboard, Escape, outside click, focus dismissal and desktop breakpoint closure are covered. Sites without header configuration retain sidebar section switching. Fixed two gallery section landing URLs exposed by the dropdown.

## Validation

Package validation and 271 unit tests passed. Gallery build and 215 browser tests passed. Final spacing refinement reduces narrow-header gaps and preserves the product title. Style/format checks, heartKIT build and seven browser tests pass; a focused title-clipping regression also passes. Phone screenshot confirmed section switching and a sidebar containing only Getting started pages. Screenshot: /tmp/heartkit-mobile-sections.png.

## Candidate integration

heartKIT worktree: /Users/adam.page/Ambiq/adks/heartkit-docs, issue AmbiqAI/heartkit#43. Removed local sidebar override in favor of shared behavior and updated mobile browser regression. Local node_modules uses /tmp/ambiqai-helia-ui-0.1.0-alpha.20.tgz packed from this worktree. This is an unpublished candidate, not the published alpha.20. package.json and lockfile pins remain unchanged; npm ci restores the published dependency. Preview: http://127.0.0.1:8777/heartkit/.

## Rollout and next steps

CORE, RT, AOT, HPX, EDGE, sleepKIT and heartKIT use alpha.20 or equivalent 3692215 pin. Shared release and immutable consumer pin updates remain. CORE/RT/AOT/HPX origin/main were inspected; primary checkouts can contain unrelated branches and must not be edited. Publish the approved shared UI PR, then follow the release process. Land heartKIT before updating the other documentation sites. Update and test each consumer in its own task worktree. Release, merge and deployment remain separate steps.
