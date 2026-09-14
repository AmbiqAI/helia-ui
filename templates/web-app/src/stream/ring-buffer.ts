// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Fixed-size sample window.
 *
 * Allocation is the thing being avoided. A growing array plus `slice` would
 * allocate and copy the whole window on every chunk, which at 250 Hz is a few
 * hundred kilobytes a second of garbage and a collector pause visible as a
 * dropped frame in the trace.
 */

export class RingBuffer {
  readonly capacity: number;
  private readonly data: Float32Array;
  private next = 0;
  private filled = 0;
  private written = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity);
  }

  /** Total samples ever pushed, including those already overwritten. */
  get totalWritten(): number {
    return this.written;
  }

  /** Samples currently readable, at most `capacity`. */
  get length(): number {
    return this.filled;
  }

  push(samples: Float32Array): void {
    const { capacity, data } = this;
    this.written += samples.length;

    // A chunk longer than the window can only leave its tail, so skip the
    // prefix instead of wrapping through the buffer more than once.
    const start = Math.max(0, samples.length - capacity);
    for (let i = start; i < samples.length; i += 1) {
      data[this.next] = samples[i];
      this.next = (this.next + 1) % capacity;
    }
    this.filled = Math.min(capacity, this.filled + (samples.length - start));
  }

  clear(): void {
    this.data.fill(0);
    this.next = 0;
    this.filled = 0;
    this.written = 0;
  }

  /**
   * Reads `count` evenly spaced samples from the window into `out`, oldest
   * first, and returns how many were written.
   *
   * Decimating here rather than in the chart is what bounds render cost: the
   * number of points Recharts lays out becomes a function of the window's
   * pixel width, not of the sample rate, so 250 Hz costs the same frame as
   * 50 Hz.
   */
  readDecimated(out: Float32Array, count: number): number {
    const n = Math.min(count, out.length, this.filled);
    if (n === 0) return 0;

    const { capacity, data, filled } = this;
    const oldest = (this.next - filled + capacity) % capacity;
    const stride = filled / n;

    for (let i = 0; i < n; i += 1) {
      const offset = Math.min(filled - 1, Math.floor(i * stride));
      out[i] = data[(oldest + offset) % capacity];
    }
    return n;
  }
}
