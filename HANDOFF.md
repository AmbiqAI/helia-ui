# helia-ui maintainability pass

Goal: improve architecture, CI/CD, hooks, organization and comment quality. Focused local tooling pass tracks AmbiqAI/helia-ui#38; wider refactor tracks #204.

Worktree: /Users/adam.page/Ambiq/helia/helia-ui-maintainability. Branch: codex/helia-ui-maintainability. Base: a4b774b5f48dfc769aff1e90fcf65bd0d7c7b5c4. Other checkouts and preview ports preserved.

Implemented locally: explicit-install tracked hooks with staged formatting/syntax checks, conventional commit checks and pre-push validation; regression coverage for partial staging. React/gallery type dependencies and actual type checks; corrected dataset/test types. Root Astro/Zod aligned with gallery. CI gate, timeouts, pinned npm, duplicate unit execution removed. Release-prepare explicitly dispatches CI because GITHUB_TOKEN PRs do not trigger ordinary PR workflows. Targeted comment cleanup and CONTRIBUTING.md.

Verified: fresh root/gallery installs; 277 unit tests; React and gallery types (zero gallery diagnostics); gallery build; 232 browser tests; isolated packed consumer (150 files, 11 bins); workflow YAML/shell syntax and CI gate failure handling. Latest evidence: /tmp/ui-hardening-final-validation.log, /tmp/ui-hardening-final-gallery.log, /tmp/ui-hardening-build.log, /tmp/ui-hardening-browser.log. No GitHub workflow execution for these changes yet. User approved publishing this PR and follow-up issue.

Findings: main ruleset requires one review but no CI checks, stale approvals not dismissed, unresolved threads allowed; workflow defaults allow writes/PR approvals. No remote settings changed. Discoverability module mixes source parsing, reduction, reconciliation, artifacts and integration. Preserve public contracts and byte-identical artifacts when splitting. Shared Astro type coverage is still incomplete.

Reviewable report and follow-up issue draft: docs/maintenance-audit.md. Follow-up issue published: https://github.com/AmbiqAI/helia-ui/issues/204. Next: publish hardening PR under #38. Then verify GitHub CI, propose enabling required CI gate after a successful run, and carry out small architecture changes with regression coverage. No merge or release authorized in this scope.

Runtime: Node 24.12.0 and npm 11.19.0; cached pinned npm at /Users/adam.page/.npm/_npx/81d468605400e209/node_modules/.bin. Node's bundled npm is older. Hooks not enabled because local Git hook configuration is shared across worktrees. Gallery install changes executable modes of root bin files; those install side effects were restored. Do not hand-edit lockfiles.
