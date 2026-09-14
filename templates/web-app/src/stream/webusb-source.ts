// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import {
  ChunkEmitter,
  type ChunkListener,
  type Source,
  type SourceSupport,
} from './source';

/*
 * WebUSB transport, stubbed at the transfer loop.
 *
 * Everything above that line is what a real driver does and is left in place
 * on purpose: the filtered chooser, the configuration and interface claim, the
 * teardown order. Only `readLoop` is missing, because the packet layout is the
 * board's and there is no board here. Fill it in and nothing outside this file
 * changes.
 *
 * The shape to keep: transferIn returns a DataView of whatever the endpoint
 * had ready, which is a partial frame as often as not. Parse into a Float32Array
 * and emit once per transfer, never once per sample.
 */

/* Replace with the evaluation board's identifiers before shipping. */
const VENDOR_ID = 0x1209;
const INTERFACE_NUMBER = 0;
const IN_ENDPOINT = 1;
const TRANSFER_BYTES = 512;

export class WebUsbSource implements Source {
  readonly id = 'webusb' as const;
  readonly label = 'WebUSB';

  private readonly emitter = new ChunkEmitter();
  private device: USBDevice | undefined;
  private running = false;

  support(): SourceSupport {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return {
        supported: false,
        reason:
          'WebUSB needs a Chromium-based browser. Safari and Firefox do not implement it.',
      };
    }
    // Chromium exposes navigator.usb but rejects every call off a secure
    // origin, so an http:// deploy fails at requestDevice with a bare
    // SecurityError. Catching it here makes the cause readable.
    if (!window.isSecureContext) {
      return {
        supported: false,
        reason:
          'WebUSB needs a secure context: serve over https:// or localhost.',
      };
    }
    return { supported: true };
  }

  async connect(_sampleRate: number): Promise<void> {
    const support = this.support();
    if (!support.supported) throw new Error(support.reason);

    // Must run inside the click that called it: Chromium gates the chooser on
    // a live user activation and the activation is consumed by an await.
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: VENDOR_ID }],
    });

    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(INTERFACE_NUMBER);

    this.device = device;
    this.running = true;
    void this.readLoop();
  }

  setSampleRate(_sampleRate: number): void {
    // A real driver sends a vendor control transfer here and lets the device
    // acknowledge before reporting the new rate.
  }

  async disconnect(): Promise<void> {
    this.running = false;
    const device = this.device;
    this.device = undefined;
    if (!device) return;
    // Release before close, and swallow: the usual way to end a session is to
    // unplug the board, which leaves every call rejecting with NetworkError.
    try {
      await device.releaseInterface(INTERFACE_NUMBER);
      await device.close();
    } catch {
      /* already gone */
    }
  }

  onChunk(listener: ChunkListener): () => void {
    return this.emitter.add(listener);
  }

  private async readLoop(): Promise<void> {
    const device = this.device;
    if (!device) return;
    while (this.running) {
      const result = await device.transferIn(IN_ENDPOINT, TRANSFER_BYTES);
      if (result.status !== 'ok' || !result.data) break;
      throw new Error(
        'WebUSB transport is a stub: decode the board frame in readLoop and call emitter.emit().',
      );
    }
  }
}
