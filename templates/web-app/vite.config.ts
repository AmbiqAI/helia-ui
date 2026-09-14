// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/*
 * GitHub Pages serves a project site from `/<repo>/`, a custom domain from
 * `/`. The deploy workflow is the only place that knows which, so it passes
 * the prefix in rather than the config guessing from CI variables.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    // The streaming worker and the chart are the two heavy chunks. Keeping the
    // warning at Vite's default would hide a regression in either.
    chunkSizeWarningLimit: 700,
  },
});
