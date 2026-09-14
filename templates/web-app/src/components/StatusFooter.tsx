// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import type { StreamSnapshot } from '../stream/use-stream';

interface StatusFooterProps {
  snapshot: StreamSnapshot;
  sampleRate: number;
  sourceLabel: string;
}

/*
 * The counters are rendered as attributes as well as text because they are the
 * assertion the smoke test makes: samples must climb with the sample rate while
 * frames stays at display rate. Reading them from the DOM is how the test shows
 * the rAF batching is live rather than assumed.
 */
export function StatusFooter({
  snapshot,
  sampleRate,
  sourceLabel,
}: StatusFooterProps) {
  return (
    <footer
      className="flex flex-wrap items-center gap-4 border-t border-hairline bg-surface-paper px-4 py-2 text-meta text-ink-muted"
      data-testid="stream-stats"
      data-samples={snapshot.samples}
      data-chunks={snapshot.chunks}
      data-frames={snapshot.frames}
    >
      <span>{sourceLabel}</span>
      <span className="tabular-nums">{sampleRate} Hz requested</span>
      <span className="tabular-nums">{snapshot.samples} samples</span>
      <span className="tabular-nums">{snapshot.chunks} chunks</span>
      <span className="tabular-nums">{snapshot.frames} frames drawn</span>
    </footer>
  );
}
