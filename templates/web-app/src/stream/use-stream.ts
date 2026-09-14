// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useCallback, useEffect, useRef, useState } from 'react';

import { RingBuffer } from './ring-buffer';
import { SAMPLE_RATE_MAX, type Source } from './source';

/*
 * The whole responsiveness argument lives in this file.
 *
 * Two clocks are in play and they must not be joined. The sample clock runs at
 * 50-250 Hz in the worker or on the wire; the display clock runs at whatever
 * the monitor does. Calling setState per chunk joins them, and React then
 * renders faster than the screen can show, so the extra renders are pure cost:
 * at 250 Hz with 16 ms packets that is a reconciliation and a Recharts layout
 * per packet, on the same thread that has to stay free for the toggle and the
 * slider.
 *
 * So chunks are written straight into a ring buffer, which is not React state
 * and triggers nothing, and exactly one requestAnimationFrame is scheduled to
 * publish what is there. Everything that lands before the frame fires is
 * already in the buffer, so coalescing loses no samples — only intermediate
 * pictures nobody could have seen. Raising the sample rate then costs more
 * memcpy and no extra renders, which is the property that makes the app feel
 * the same at 250 Hz as at 50 Hz.
 */

/** Seconds of signal held. Also the chart's x-axis span. */
export const WINDOW_SECONDS = 4;

/**
 * Points handed to the chart per frame. Chosen against the chart's pixel width
 * rather than the sample rate: more points than the trace has pixels costs
 * layout time and draws nothing new.
 */
export const MAX_POINTS = 240;

export interface StreamPoint {
  /** Seconds relative to now, so the newest sample sits at 0. */
  t: number;
  value: number;
}

export interface StreamSnapshot {
  points: StreamPoint[];
  /** Samples received since the last reset. */
  samples: number;
  /** Chunks received since the last reset. */
  chunks: number;
  /** Frames published since the last reset. Never exceeds the display rate. */
  frames: number;
}

const EMPTY: StreamSnapshot = { points: [], samples: 0, chunks: 0, frames: 0 };

export interface UseStreamResult {
  snapshot: StreamSnapshot;
  reset: () => void;
}

export function useStream(source: Source, sampleRate: number): UseStreamResult {
  // Sized for the fastest rate the app offers, so retuning never reallocates.
  const [ring] = useState(
    () => new RingBuffer(WINDOW_SECONDS * SAMPLE_RATE_MAX),
  );
  const [scratch] = useState(() => new Float32Array(MAX_POINTS));
  // A ref, not state: these change on every chunk and every frame, and nothing
  // renders from them directly — the published snapshot carries their values.
  const countersRef = useRef({ chunks: 0, frames: 0, frameId: 0 });
  const [snapshot, setSnapshot] = useState<StreamSnapshot>(EMPTY);

  const reset = useCallback(() => {
    ring.clear();
    const counters = countersRef.current;
    counters.chunks = 0;
    counters.frames = 0;
    setSnapshot(EMPTY);
  }, [ring]);

  useEffect(() => {
    const counters = countersRef.current;

    const publish = (): void => {
      counters.frameId = 0;
      counters.frames += 1;

      const count = ring.readDecimated(scratch, MAX_POINTS);
      const span = ring.length / sampleRate;
      const points = new Array<StreamPoint>(count);
      for (let i = 0; i < count; i += 1) {
        // Oldest at -span, newest at 0, so the trace scrolls left without the
        // axis domain having to move.
        const t = count > 1 ? (i / (count - 1)) * span - span : 0;
        points[i] = { t, value: scratch[i] };
      }

      setSnapshot({
        points,
        samples: ring.totalWritten,
        chunks: counters.chunks,
        frames: counters.frames,
      });
    };

    const unsubscribe = source.onChunk((chunk) => {
      ring.push(chunk.samples);
      counters.chunks += 1;
      // One frame in flight at a time. A burst of BLE notifications between two
      // frames therefore costs one publish, not one per notification.
      if (counters.frameId === 0) {
        counters.frameId = requestAnimationFrame(publish);
      }
    });

    return () => {
      unsubscribe();
      if (counters.frameId !== 0) {
        cancelAnimationFrame(counters.frameId);
        counters.frameId = 0;
      }
    };
  }, [source, sampleRate, ring, scratch]);

  return { snapshot, reset };
}
