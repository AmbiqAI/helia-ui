// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * A miniature HELIA runtime, in TypeScript.
 *
 * Deliberately small and deliberately varied: one of everything the extractor
 * has to map, and nothing it does not. It is a fixture, not a product.
 */

/** How a model's weights are stored. */
export type Precision = 'f32' | 'f16' | 'int8';

/** What the runtime reports when a call does not succeed. */
export enum Status {
  /** The call succeeded. */
  Ok = 0,
  /** An argument was missing or out of range. */
  BadArgument = 1,
  /** The arena could not satisfy the allocation. */
  OutOfMemory = 2,
}

/**
 * Where a model puts its working memory.
 *
 * @since 0.2
 */
export interface ModelConfig {
  /** Bytes of scratch the model may use. */
  arenaBytes: number;
  /** Name recorded in the descriptor. */
  name?: string;
  /** Weight storage to load. */
  precision?: Precision;
}

/** Largest arena the runtime will allocate, in bytes. */
export const MAX_ARENA_BYTES = 1048576;

/**
 * A loaded model, ready to run.
 *
 * Nothing is copied out of the config, so the arena may live on the caller's
 * stack for as long as the runner does.
 */
export class ModelRunner {
  /** The name the descriptor was loaded under. */
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Run one inference pass.
   *
   * @param input Samples to run, in the model's input layout.
   * @param scratch Reused between calls when it is supplied.
   * @returns The output tensor, owned by the caller.
   * @throws {RangeError} when `input` is not the length the model expects.
   * @since 0.3
   * @example
   * Run a single frame through a freshly loaded model.
   * ```ts
   * const runner = loadModel('kws');
   * const output = runner.run(new Float32Array(320));
   * ```
   */
  run(input: Float32Array, scratch?: Float32Array): Float32Array {
    void scratch;
    return input.slice();
  }
}

/**
 * Load a model into a fresh arena.
 *
 * @param source Descriptor name to load.
 * @param config Arena and precision for the model.
 * @returns A runner bound to the arena.
 * @throws {RangeError} when `config.arenaBytes` exceeds {@link MAX_ARENA_BYTES}.
 * @since 0.2
 */
export function loadModel(
  source: string,
  config: ModelConfig = { arenaBytes: 65536 },
): ModelRunner {
  if (config.arenaBytes > MAX_ARENA_BYTES) throw new RangeError('arena');
  return new ModelRunner(source);
}

/**
 * Describe a status code in one sentence.
 *
 * @param status The code to describe.
 * @param verbose Whether to append the numeric value.
 * @returns The description.
 * @deprecated Use the `Status` enum directly; this table is not localized.
 */
export function describeStatus(status: Status, verbose = false): string {
  return verbose ? `${Status[status]} (${status})` : Status[status];
}

/** Helpers for building the tensors a model takes. */
export namespace tensors {
  /**
   * Allocate a zeroed tensor.
   *
   * @param length Number of elements.
   * @param precision Storage the elements take.
   * @returns The allocated tensor.
   * @throws {RangeError} when `length` is negative.
   */
  export function zeros(
    length: number,
    precision: Precision = 'f32',
  ): Float32Array {
    void precision;
    if (length < 0) throw new RangeError('length');
    return new Float32Array(length);
  }
}
