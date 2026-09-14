// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The contract between the app shell and whatever is producing samples.
 *
 * This is the interface a real evaluation-board driver implements, not a
 * simplification of one. The three methods are the whole of what the UI is
 * allowed to know: it can start a transport, stop it, and subscribe to chunks.
 * Everything device-specific — descriptors, GATT characteristics, packet
 * framing, reconnection — stays behind `connect`, so swapping the simulated
 * source for a board changes one line in App.tsx and nothing else.
 *
 * Chunks, not samples: a USB bulk transfer or a BLE notification arrives as a
 * packet of tens to hundreds of samples. A per-sample callback would put one
 * JavaScript call on the main thread per sample and lose the frame budget at
 * the top of the supported rate range.
 */

export type SourceId = 'simulated' | 'webusb' | 'bluetooth';

export interface StreamChunk {
  /**
   * Sample values, oldest first, in the signal's own units. Ownership passes
   * to the listener: the producer must not retain or reuse the buffer, because
   * a transferable arriving from a worker is already detached on its side.
   */
  samples: Float32Array;
  /** Samples per second this chunk was produced at. */
  sampleRate: number;
}

export type ChunkListener = (chunk: StreamChunk) => void;

/**
 * Why a source cannot run here, phrased for a developer looking at the screen.
 * WebUSB and Web Bluetooth are Chromium-only and secure-context-only, so "it
 * did not connect" and "this browser cannot connect" are different states and
 * the UI has to tell them apart.
 */
export interface SourceSupport {
  supported: boolean;
  reason?: string;
}

export interface Source {
  readonly id: SourceId;
  readonly label: string;

  /** Synchronous feature detection. Never prompts, never touches the device. */
  support(): SourceSupport;

  /**
   * Acquire the transport and start streaming. Rejects with a message fit for
   * a toast. A user-gesture-gated chooser (`requestDevice`) belongs here, so
   * this must be called from a click handler.
   */
  connect(sampleRate: number): Promise<void>;

  /**
   * Retune while connected. Real hardware takes a control transfer or a GATT
   * write; the simulated source re-times its generator. Ignored when idle.
   */
  setSampleRate(sampleRate: number): void;

  /** Release the transport. Safe to call when already disconnected. */
  disconnect(): Promise<void>;

  /** Subscribe. Returns the unsubscribe function. */
  onChunk(listener: ChunkListener): () => void;
}

/** Shared subscriber bookkeeping, so each source only implements its transport. */
export class ChunkEmitter {
  private readonly listeners = new Set<ChunkListener>();

  add(listener: ChunkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(chunk: StreamChunk): void {
    for (const listener of this.listeners) listener(chunk);
  }
}

export const SAMPLE_RATE_MIN = 50;
export const SAMPLE_RATE_MAX = 250;

export function clampSampleRate(rate: number): number {
  return Math.min(SAMPLE_RATE_MAX, Math.max(SAMPLE_RATE_MIN, Math.round(rate)));
}
