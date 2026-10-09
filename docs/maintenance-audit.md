# Maintainability audit

Baseline: `a4b774b5f48dfc769aff1e90fcf65bd0d7c7b5c4`. Tracking: [#38](https://github.com/AmbiqAI/helia-ui/issues/38).

## Architecture

The package/gallery split is intentional and useful. Shared components, tokens,
reference models and language extractors have distinct directories. Boundary,
package-install, rendition and browser checks protect important contracts.
Product copy belongs in consumers. Preserve that separation.

The largest concentration of responsibilities is `starlight/discoverability.ts`:
source parsing, rendition reduction, sidecar reconciliation, route/artifact
construction and build integration share one module. Extract these responsibilities
in small, behavior-preserving changes, retaining the public exports and proving
byte-identical artifacts against the existing rendition fixtures. Do not split
files merely to reduce line counts. The language extractors also warrant a
function-level review before any restructuring.

## Local improvements under #38

- Tracked pre-commit, commit-msg and pre-push hooks; installation is explicit.
- Staged-source formatting and syntax checks, with partial-staging regression coverage.
- React and gallery type checks, including their declaration/checker dependencies.
- Gallery dataset types and browser-test element types corrected without runtime changes.
- Root Astro and Zod resolutions aligned with the gallery to avoid incompatible
  schema types across the linked-package boundary.
- One CI gate covering package, gallery and installable-package jobs.
- Pinned npm, bounded CI jobs and removal of duplicate unit-test execution.
- Explicit CI dispatch for release-bump branches opened by GITHUB_TOKEN.
- Conventional release-bump and future dependency commit subjects.
- Targeted comment corrections and contributor guidance. API contracts and
  non-obvious compatibility explanations remain intact.

These are local changes until a reviewed PR lands. Workflow changes have not
been exercised on GitHub yet. The gallery type checker does not constitute
complete independent type coverage of every shared Astro component.

## GitHub settings proposal

The [active main ruleset](https://github.com/AmbiqAI/helia-ui/rules/24806866) requires one approval but no CI status checks. It permits
stale approvals and unresolved review threads. Proposed settings after the CI
change lands and has a successful run:

1. Require `CI gate` with GitHub Actions as the expected source.
2. Dismiss approvals when the reviewed diff changes and require review-thread resolution.
3. Use squash merges so the reviewed conventional PR title drives release history.
4. Keep any administrator bypass explicit rather than treating it as the normal path.

Workflow defaults allow writes and pull-request approvals. Each checked-in
workflow already narrows its permissions. Set the repository default to read-only
and disable workflow-generated PR approvals unless an approved workflow needs them.
No settings were changed during this audit.

## Architecture follow-up

Tracking: [#204](https://github.com/AmbiqAI/helia-ui/issues/204), Harden shared architecture, release controls and repository maintenance

- Split discoverability responsibilities while preserving public APIs and
  byte-stable rendition output; add independent shared-Astro type coverage.
- Audit shipped helpers for import-time process/filesystem side effects and keep
  pure transformation code separate from CLI adapters.
- Pin external actions by commit SHA and configure Dependabot to maintain them.
- Add secret scanning and workflow linting with regression checks for release guards.
- Decide on tag rules or immutable-release enforcement; the release workflow's
  refusal to overwrite tags is not server-enforced immutability.
- Review comment accuracy alongside touched code. Preserve licenses, contracts,
  units and rationale; remove narration, duplicate explanations and migration history.
- Define measured package and browser-byte budgets before enforcing them.

Acceptance: fresh installs, package validation, complete type checks, packed-package
verification, unchanged generated artifacts, gallery/browser/accessibility checks,
and verified GitHub merge/release gates. Keep dependency-major migrations separate.

The follow-up issue is published; the structural refactor remains planned.

## Local validation

Fresh root and gallery installs passed with npm 11.19.0. Package validation passed
277 unit tests. React and gallery type checks passed; the gallery reported zero
errors, warnings or hints. The gallery build and all 232 browser tests passed.
A tarball installed into an isolated consumer passed export, relative-import and
CLI verification (150 shipped files and 11 commands). Workflow YAML and shell
syntax checks passed; gate checks rejected failed, canceled and skipped jobs.
GitHub workflow execution and settings enforcement remain unverified until publication.
