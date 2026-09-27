# HELIA product consistency

## Goal and state

Issue AmbiqAI/helia-ui#177, branch codex/product-site-consistency, base335859a. Consumers: AOT#515, RT#322, CORE#572. User approved issues and local implementation. No new PR, release, or deployment yet. Prior admin merge authorization applied only to AOT#473/#514.

## Implemented

- Shared product wordmark uses regular helia and bold suffix; default hub label HELIA HUB. Neutral navigation retained.
- Landing bounds nested bands to its own inline width.
- Header and mobile-sidebar theme controls synchronize labels and selected states.
- Gallery regression tests for bounded bands and theme synchronization. Reference dropdown keyboard test uses native type-ahead, avoiding platform-dependent Home/ArrowDown behavior.
- Alpha.20 release notes prepared. Manifest version remains alpha.19 until release workflow.

## Evidence

Validation passes with271unit tests. Gallery build and semantic assertions pass. Full gallery browser suite: 214 passed. Log: /tmp/helia-consistency-browser-final.log. Installable tarball verified147files/11bins in isolated consumer. AOT122browser tests pass; RT build/type/link/reference checks pass; CORE9browser tests and API Markdown coverage pass. Actual consumer screenshots inspected desktop/mobile light/dark.

## Next

Review local diff, obtain GitHub publication approval, open shared PR. After merge, use Prepare release for alpha.20 bump PR, then Publish release only after exact main CI passes. Update all consumer manifests/locks to immutable tag and revalidate before consumer PRs. Never commit temporary tarball pins.

## Workspaces

All under /Users/adam.page/Ambiq/helia/: helia-ui-consistency, helia-aot-docs, helia-rt-consistency, helia-core-consistency. Preview ports8744/8751/8752. Primary checkouts and AOT prototype untouched. Consumer handoffs carry details. CORE DeploymentPaths nested-card Markdown omission is pre-existing and separately recorded, not repaired here.
