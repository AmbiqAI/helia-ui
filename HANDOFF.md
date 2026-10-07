# Official Ambiq logo rollout

Goal: issue #189, official blue or black in light mode, official white in dark mode. Default shared footer to blue. User approved implementation and product PRs; merges/releases not yet authorized for this work.

State: implementation complete on codex/official-ambiq-logo from alpha.22. Validation: 271 unit tests, gallery build and 221 browser tests pass; rendered footer screenshots inspected in both themes. Supplied blue/white SVGs copied from approved local artwork; only viewBox whitespace trimmed. Implement shared option, gallery and browser tests, then PR. Consumer PRs must pin a published immutable release, not a branch or nonexistent tag.

Next: validate, open shared PR, release after approval, roll out to product sites. Audit custom/MkDocs sites separately. Preserve other active worktrees.

Inventory: 11 Astro consumers (the nine listed product sites plus Developer Hub and estimator); soundKIT and physioKIT use MkDocs. Consumer rollout awaits merged shared implementation and an immutable release tag.
