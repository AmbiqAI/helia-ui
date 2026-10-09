# Contributing

Use Node 24 and npm 11.19.0, as recorded in `.nvmrc` and `packageManager`.
Install both dependency trees:

```sh
npm ci
npm ci --prefix docs
```

Enable the tracked hooks explicitly:

```sh
git config --local core.hooksPath .githooks
```

This setting applies to all worktrees of this repository. Hooks are not installed
by package installation and do not change a consumer's Git configuration.

The pre-commit hook checks staged formatting, whitespace and JavaScript syntax.
It reads the index, so partially staged files are checked as they will be
committed. The commit-msg hook requires conventional commit subjects and rejects
attribution trailers. The pre-push hook runs package validation and the React and
gallery type checks. Install both trees before pushing. CI remains authoritative
because local hooks can be bypassed.

Before requesting review, run:

```sh
npm run validate
npm run typecheck
npm run docs:check
npm run docs:build
npm run docs:test
```

Keep component data and product copy in consuming sites. Shared components own
presentation and reusable behavior; reference extractors own language-specific
parsing; the reference model and renderer own the output contract. Changes to
these boundaries need an issue and focused regression coverage.

Comments should explain a constraint, invariant or tradeoff. Remove migration
history and prose that restates the code. Preserve public API documentation,
units, error behavior and non-obvious compatibility constraints. Deferred work
must name its issue with `TODO(#123)`.

Regenerate lockfiles with the pinned npm and prove both with fresh installs.
Do not edit generated reference metadata or notice files by hand. Follow
[RELEASE.md](RELEASE.md) for publication; a merge is not a package release.
