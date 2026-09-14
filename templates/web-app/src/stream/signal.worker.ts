// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Simulated signal generator.
 *
 * It runs off the main thread for the same reason a real driver's parsing
 * does: the generator's timer must not compete with React's render work, or
 * the sample clock drifts under load and the demo looks like the device is
 * stuttering when it is the page that is busy.
 *
 * Samples are produced against a monotonic sample counter, not against the
 * timer's actual firing times, so a late tick emits the samples it owed rather
 * than dropping them. That keeps the observed rate equal to the requested rate
 * even when the worker is descheduled.
 */

/*
 * `self` is typed as a Window here: the DOM and WebWorker lib files cannot both
 * be in scope without duplicate-identifier errors, and the app needs DOM. This
 * names the two members the worker actually uses.
 */
interface WorkerScope {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorkerCommand>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

export interface WorkerStart {
  type: 'start';
  sampleRate: number;
}

export interface WorkerRate {
  type: 'rate';
  sampleRate: number;
}

export interface WorkerStop {
  type: 'stop';
}

export type WorkerCommand = WorkerStart | WorkerRate | WorkerStop;

export interface WorkerChunk {
  type: 'chunk';
  samples: Float32Array;
  sampleRate: number;
}

/*
 * One post per frame at display rate. Smaller chunks would raise the message
 * count without giving the chart anything extra to draw; larger ones would
 * make the trace visibly step.
 */
const CHUNK_INTERVAL_MS = 16;

/* A PPG pulse is a fundamental plus a dicrotic-notch harmonic, not a sine. */
const PULSE_HZ = 1.15;
const HARMONIC_GAIN = 0.35;
const RESPIRATION_HZ = 0.22;
const RESPIRATION_GAIN = 0.12;
const NOISE_GAIN = 0.05;

let timer: ReturnType<typeof setInterval> | undefined;
let sampleRate = 100;
let phase = 0;
let emitted = 0;
let startedAt = 0;

function sampleAt(t: number): number {
  const pulse =
    Math.sin(2 * Math.PI * PULSE_HZ * t) +
    HARMONIC_GAIN * Math.sin(4 * Math.PI * PULSE_HZ * t + 0.9);
  const respiration =
    RESPIRATION_GAIN * Math.sin(2 * Math.PI * RESPIRATION_HZ * t);
  const noise = NOISE_GAIN * (Math.random() * 2 - 1);
  return pulse + respiration + noise;
}

function tick(): void {
  const elapsed = (performance.now() - startedAt) / 1000;
  const owed = Math.floor(elapsed * sampleRate) - emitted;
  if (owed <= 0) return;

  const samples = new Float32Array(owed);
  const step = 1 / sampleRate;
  for (let i = 0; i < owed; i += 1) {
    samples[i] = sampleAt(phase);
    phase += step;
  }
  emitted += owed;

  const message: WorkerChunk = { type: 'chunk', samples, sampleRate };
  // Transferred, not copied: at 250 Hz this is a kilobyte every frame and the
  // main thread is the only reader.
  ctx.postMessage(message, [samples.buffer]);
}

function stop(): void {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
}

function start(rate: number): void {
  stop();
  sampleRate = rate;
  phase = 0;
  emitted = 0;
  startedAt = performance.now();
  timer = setInterval(tick, CHUNK_INTERVAL_MS);
}

ctx.addEventListener('message', (event) => {
  const command = event.data;
  switch (command.type) {
    case 'start':
      start(command.sampleRate);
      break;
    case 'rate':
      // Rebasing the counters rather than restarting keeps the waveform phase
      // continuous, so retuning does not look like a dropped connection.
      emitted = 0;
      startedAt = performance.now();
      sampleRate = command.sampleRate;
      break;
    case 'stop':
      stop();
      break;
  }
});
