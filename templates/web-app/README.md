# HELIA web app template

A Vite + React + TypeScript starter for a HELIA demo web app: a live signal
trace fed by a Web Worker, an app shell built from `@ambiqai/helia-ui`, and
`Source` stubs for WebUSB and Web Bluetooth. Copy it into a demo repository,
change the placeholders, and delete this README.

This is the lane the design system calls **demo web apps**. Docs and marketing
pages are static Starlight sites that ship no JavaScript; an app is a React
application and its bar is different — responsiveness under streaming, not the
absence of JavaScript. Use this template when the thing you are building talks
to hardware or moves data continuously. Use `templates/product-docs` when it
does not.

This directory is **repo-only**: it is not listed in the package's `files`, so
it is not in the published tarball. Copy it from `AmbiqAI/helia-ui` at
`templates/web-app/`.

## Copy it out

```sh
git clone --depth 1 https://github.com/AmbiqAI/helia-ui.git /tmp/helia-ui
cp -R /tmp/helia-ui/templates/web-app ./my-demo
cd my-demo
rm README.md
npm install
npm run dev
```

`.github/workflows/deploy.yml` expects to be at the repository root, so move it
up if the app is not the whole repository.

## Point it at the package

`@ambiqai/helia-ui` is not published to npm yet, so this template depends on a
git tag in the package's own repository, whose root is the package:

```jsonc
{
  "dependencies": {
    // Replace with "^0.1.0-alpha.5" once the package is on npm.
    "@ambiqai/helia-ui": "github:AmbiqAI/helia-ui#v0.1.0-alpha.5",
  },
}
```

While developing against an unreleased change, point the same entry at a packed
tarball of a local checkout (`npm pack` in the package root, then
`"file:../helia-ui-0.1.0-alpha.5.tgz"`) and switch back to the tag before
committing. A `file:` path to the directory installs as a symlink, and the
package ships `.tsx` source rather than a bundle, so TypeScript then resolves
`react` from the checkout's own tree instead of this app's and reports the whole
React layer as untyped.

The `dependencies` here also carry `react`, `radix-ui`, `recharts`, `sonner` and
the rest because the package declares them as **optional peers**: an app that
renders the React layer installs them itself. Drop the ones you do not use, and
delete the matching `@source` line in `src/styles/app.css` when you do.

## Change the placeholders

| Where                    | What                                                |
| ------------------------ | --------------------------------------------------- |
| `package.json`           | `name`, `description`                               |
| `index.html`             | `<title>` and the description meta                  |
| `src/styles/app.css`     | `--helia-product-accent`, the one value an app owns |
| `src/components/TopBar`  | The app's name                                      |
| `src/stream/*-source.ts` | The device identifiers and the transport bodies     |

## Scripts

| Command         | What it does                                       |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Vite dev server                                    |
| `npm run check` | `tsc --noEmit`                                     |
| `npm run lint`  | ESLint with type-checked typescript-eslint rules   |
| `npm run build` | Production build into `dist/`                      |
| `npm test`      | Playwright smoke test against the production build |

All four run in CI before a deploy. `npm test` builds first, so it is the slow
one; `check` and `lint` are the fast feedback loop.

## Deploy

The workflow builds on a push to `main` and publishes to GitHub Pages. Enable
Pages for the repository with **Source: GitHub Actions** first.

A project site is served from `https://<org>.github.io/<repo>/`, so the bundle's
asset URLs need that prefix. `vite.config.ts` reads it from `BASE_PATH` and the
workflow passes the repository name. A custom domain serves from the root and
wants `BASE_PATH` left unset.

Build locally the way the workflow does:

```sh
BASE_PATH=/my-demo/ npm run build && npm run preview
```

## The responsiveness rules

These are the whole point of the template. A streaming app that ignores them
feels broken on the machines the demo runs on, which are not the machine it was
written on.

1. **Generate and parse off the main thread.** The simulated signal runs in
   `src/stream/signal.worker.ts`. A real driver's packet decode belongs there
   too. The main thread has to stay free for the interface, and a sample clock
   that shares it drifts whenever React renders.
2. **Transfer, do not copy.** The worker posts `Float32Array` chunks with the
   buffer in the transfer list, so nothing is serialised.
3. **Chunks, never samples.** `Source.onChunk` hands over a packet. A per-sample
   callback puts one JavaScript call on the main thread per sample, which is
   where the frame budget goes at the top of the rate range.
4. **State updates at display rate, not sample rate.** Chunks are written
   straight into a fixed ring buffer, which is not React state and triggers
   nothing. One `requestAnimationFrame` is scheduled to publish what is there,
   and everything arriving before it fires is already in the buffer. Coalescing
   loses no samples, only pictures nobody could have seen.
5. **Decimate before the chart, not in it.** `RingBuffer.readDecimated` returns
   a fixed number of points chosen against the trace's pixel width, so render
   cost stops being a function of the sample rate.
6. **No animation on a live series.** `isAnimationActive={false}`, `dot={false}`,
   a fixed axis domain and a linear line type. Recharts will otherwise restart
   an entry animation on every data change and never finish one.

The smoke test asserts the outcome rather than the mechanism: raising the source
from 100 Hz to 250 Hz must multiply the samples received without moving the
number of chart updates per second. If someone replaces the batching with a
`setState` per chunk, the two move together and the test fails.

## How to implement a real Source

`src/stream/source.ts` is the contract, and it is the one a device driver
implements — not a simplification of one. Three methods: `connect`,
`disconnect`, `onChunk`, plus synchronous `support()` feature detection and
`setSampleRate` for retuning in place.

`src/stream/webusb-source.ts` and `src/stream/bluetooth-source.ts` are stubbed
at exactly one point each. Everything above that point is real: the filtered
chooser, the interface claim or the GATT walk, and the teardown order. What is
missing is the decode, because the packet layout belongs to the board's
firmware.

To bring up a board:

1. Put the real vendor ID, or the real service and characteristic UUIDs, at the
   top of the file.
2. Fill in `readLoop` (WebUSB) or `onNotification` (Web Bluetooth): parse the
   transfer or the notification into a `Float32Array` and call
   `this.emitter.emit({ samples, sampleRate })` once per packet.
3. Leave everything else alone. Nothing outside that file changes, including the
   chart and the hook.

Two constraints worth keeping in mind. Both APIs are Chromium-only and
secure-context-only, which is why `support()` returns a reason string and the
interface has a "not supported in this browser" state rather than a failed
connect. And both gate the device chooser on a live user activation, which an
`await` consumes — so `connect()` must be called directly from a click handler,
never after an earlier `await`.

## What the app supplies

`src/styles/app.css` imports `@ambiqai/helia-ui/tailwind.css`, not
`starlight-tailwind.css`: the `starlight-` entry is the same entry with
`@astrojs/starlight-tailwind` in front of it, and this app has no Starlight
shell. So it installs no compat package, and it supplies none of the
Starlight-owned variables the package sheets read — those carry their own
fallbacks inside the package.

The same file carries one `@source` line per React component the app uses. A
`@source` path into `node_modules` works in every form, so that list is a size
choice rather than a workaround: `react/*.tsx` would scan the whole layer, and
shadcn writes long variant strings into every generated file. Add a line when
you first import a component, and delete it when the last import goes.

## Claims

Product status, support, maturity and performance statements are not authored
here. They come from the approved export of the handbook's `portfolio.yaml`.
Draft, then get sign-off. The sample copy in this template is shape, not copy.
