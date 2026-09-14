// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import {
  ChunkEmitter,
  type ChunkListener,
  type Source,
  type SourceSupport,
} from './source';
import type { WorkerChunk, WorkerCommand } from './signal.worker';

/*
 * The reference implementation of `Source`. A board driver has the same shape:
 * a transport that is opened on connect, a listener set, and a teardown that
 * leaves nothing running.
 */
export class SimulatedSource implements Source {
  readonly id = 'simulated' as const;
  readonly label = 'Simulated';

  private readonly emitter = new ChunkEmitter();
  private worker: Worker | undefined;

  support(): SourceSupport {
    return { supported: true };
  }

  connect(sampleRate: number): Promise<void> {
    this.worker?.terminate();

    // `new URL(..., import.meta.url)` is the form Vite recognises statically,
    // so the worker is emitted as its own chunk and the base path is applied.
    // A string specifier would be left alone and 404 under a Pages prefix.
    const worker = new Worker(new URL('./signal.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<WorkerChunk>) => {
      this.emitter.emit({
        samples: event.data.samples,
        sampleRate: event.data.sampleRate,
      });
    });
    this.post(worker, { type: 'start', sampleRate });
    this.worker = worker;
    return Promise.resolve();
  }

  setSampleRate(sampleRate: number): void {
    if (!this.worker) return;
    this.post(this.worker, { type: 'rate', sampleRate });
  }

  disconnect(): Promise<void> {
    if (this.worker) {
      this.post(this.worker, { type: 'stop' });
      this.worker.terminate();
      this.worker = undefined;
    }
    return Promise.resolve();
  }

  onChunk(listener: ChunkListener): () => void {
    return this.emitter.add(listener);
  }

  private post(worker: Worker, command: WorkerCommand): void {
    worker.postMessage(command);
  }
}
