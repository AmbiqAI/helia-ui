// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The one dataset behind every candidate on the charting comparison page.
 *
 * The libraries differ in how they take data, not in what they are given: a
 * difference between two panels on that page has to be the library's, so the
 * series live here and no island restates a number. Each chart also carries
 * its own title and subtitle, because the framing is part of what is being
 * compared and all three have to say the same thing.
 *
 * The series are synthetic. Nothing here is a measurement of any part.
 */

export interface ChartFraming {
  /** Shown as the panel title. */
  title: string;
  /** Shown under it, and says what is plotted against what, so no axis is titled. */
  subtitle: string;
}

export interface LatencyPoint {
  /** Input length, in tokens. */
  inputLength: number;
  /** Milliseconds per inference. */
  heliaRT: number;
  heliaAOT: number;
}

export interface EnergyPoint {
  /** Deployment target class. */
  target: string;
  /** Microjoules per inference. */
  heliaRT: number;
  baseline: number;
}

export type PrecisionFamily = 'int8' | 'fp16';

export interface AccuracyPoint {
  /** Model size, in megabytes. */
  sizeMb: number;
  /** Top-1 accuracy, in percent. */
  accuracy: number;
  precision: PrecisionFamily;
}

export const latencyFraming: ChartFraming = {
  title: 'Inference latency',
  subtitle: 'Milliseconds per inference against input length, in tokens',
};

export const energyFraming: ChartFraming = {
  title: 'Energy per inference',
  subtitle: 'Microjoules per inference against deployment target',
};

export const accuracyFraming: ChartFraming = {
  title: 'Accuracy against model size',
  subtitle: 'Top-1 accuracy, in percent, against model size in megabytes',
};

export const latencySeries: LatencyPoint[] = [
  { inputLength: 32, heliaRT: 2.1, heliaAOT: 1.8 },
  { inputLength: 64, heliaRT: 3.4, heliaAOT: 2.9 },
  { inputLength: 128, heliaRT: 5.2, heliaAOT: 4.4 },
  { inputLength: 256, heliaRT: 9.6, heliaAOT: 8.1 },
  { inputLength: 384, heliaRT: 14.1, heliaAOT: 11.9 },
  { inputLength: 512, heliaRT: 18.7, heliaAOT: 15.6 },
];

export const energySeries: EnergyPoint[] = [
  { target: 'Wearable', heliaRT: 182, baseline: 241 },
  { target: 'Hearable', heliaRT: 96, baseline: 138 },
  { target: 'Sensor', heliaRT: 54, baseline: 79 },
];

export const accuracySeries: AccuracyPoint[] = [
  { sizeMb: 0.6, accuracy: 88.1, precision: 'int8' },
  { sizeMb: 1.2, accuracy: 90.4, precision: 'int8' },
  { sizeMb: 2.4, accuracy: 92.0, precision: 'int8' },
  { sizeMb: 4.8, accuracy: 93.1, precision: 'int8' },
  { sizeMb: 9.1, accuracy: 93.8, precision: 'int8' },
  { sizeMb: 1.2, accuracy: 88.9, precision: 'fp16' },
  { sizeMb: 2.4, accuracy: 91.2, precision: 'fp16' },
  { sizeMb: 4.7, accuracy: 92.7, precision: 'fp16' },
  { sizeMb: 9.3, accuracy: 93.9, precision: 'fp16' },
  { sizeMb: 18.2, accuracy: 94.4, precision: 'fp16' },
];

/** Series names, so a legend reads the same in all three panels. */
export const seriesLabels = {
  heliaRT: 'heliaRT',
  heliaAOT: 'heliaAOT',
  baseline: 'Reference',
  int8: 'int8',
  fp16: 'fp16',
} as const;

/*
 * The same two comparisons in long format -- one row per point, with the
 * series name on the row. `Chart` and Observable Plot both take that shape,
 * and deriving it here is what keeps the palette blocks and the Plot island
 * from restating a number between them.
 */
export const latencyLong = latencySeries.flatMap((point) => [
  {
    inputLength: point.inputLength,
    latency: point.heliaRT,
    runtime: seriesLabels.heliaRT,
  },
  {
    inputLength: point.inputLength,
    latency: point.heliaAOT,
    runtime: seriesLabels.heliaAOT,
  },
]);

export const energyLong = energySeries.flatMap((point) => [
  {
    target: point.target,
    energy: point.heliaRT,
    runtime: seriesLabels.heliaRT,
  },
  {
    target: point.target,
    energy: point.baseline,
    runtime: seriesLabels.baseline,
  },
]);
