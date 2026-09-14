# helia-ui docs site

The package's own documentation site. It consumes `@ambiqai/helia-ui` through
the export map and the Starlight plugin, exactly as an unrelated site would, so
anything this site cannot get from the package is a package gap.

```bash
npx -y npm@10 ci            # from the repository root; this is a workspace
npx -y npm@10 run dev       # from here
npx -y npm@10 run build     # build, then assert the output
npx -y npm@10 test          # Playwright, against the built site
```

Restart the dev server after any change to a `package.json` in the workspace.
Vite resolves the export map once at startup, so a new or renamed export is
invisible to a running server and fails as a missing module until it restarts.

Diagram pages render Mermaid at build through Playwright's
chromium-headless-shell. Use the existing browser cache; do not run
`npx playwright install`.
