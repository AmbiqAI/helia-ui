// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import {
  ChunkEmitter,
  type ChunkListener,
  type Source,
  type SourceSupport,
} from './source';

/*
 * Web Bluetooth transport, stubbed at the notification handler.
 *
 * The GATT walk is real: chooser, connect, primary service, characteristic,
 * startNotifications. What is missing is the decode, because the packet layout
 * belongs to the board's firmware. Fill in `onNotification` and nothing outside
 * this file changes.
 *
 * Two constraints shape the rest of the app. A BLE notification carries at most
 * ~244 bytes, so a 250 Hz float stream arrives as many small packets a second —
 * which is why `Source` hands over chunks and the UI never sees a sample. And
 * the connection interval is negotiated by the platform, so packets arrive in
 * bursts: the chart has to be driven by the frame clock, not by arrivals.
 */

/* Replace with the board's own 128-bit UUIDs before shipping. */
const SERVICE_UUID = 'heart_rate';
const STREAM_CHARACTERISTIC_UUID = 'heart_rate_measurement';

export class BluetoothSource implements Source {
  readonly id = 'bluetooth' as const;
  readonly label = 'Web Bluetooth';

  private readonly emitter = new ChunkEmitter();
  private device: BluetoothDevice | undefined;
  private characteristic: BluetoothRemoteGATTCharacteristic | undefined;
  private readonly onNotification = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    throw new Error(
      'Web Bluetooth transport is a stub: decode the notification here and call emitter.emit().',
    );
  };

  support(): SourceSupport {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return {
        supported: false,
        reason:
          'Web Bluetooth needs a Chromium-based browser. Safari and Firefox do not implement it.',
      };
    }
    if (!window.isSecureContext) {
      return {
        supported: false,
        reason:
          'Web Bluetooth needs a secure context: serve over https:// or localhost.',
      };
    }
    return { supported: true };
  }

  async connect(_sampleRate: number): Promise<void> {
    const support = this.support();
    if (!support.supported) throw new Error(support.reason);

    // Gated on a live user activation, same as WebUSB.
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });
    const server = await device.gatt?.connect();
    if (!server) throw new Error('The device exposed no GATT server.');

    const service = await server.getPrimaryService(SERVICE_UUID);
    const characteristic = await service.getCharacteristic(
      STREAM_CHARACTERISTIC_UUID,
    );
    characteristic.addEventListener(
      'characteristicvaluechanged',
      this.onNotification,
    );
    await characteristic.startNotifications();

    this.device = device;
    this.characteristic = characteristic;
  }

  setSampleRate(_sampleRate: number): void {
    // A real driver writes the rate to a control characteristic and waits for
    // the write response before reporting the new rate.
  }

  async disconnect(): Promise<void> {
    const characteristic = this.characteristic;
    const device = this.device;
    this.characteristic = undefined;
    this.device = undefined;

    if (characteristic) {
      characteristic.removeEventListener(
        'characteristicvaluechanged',
        this.onNotification,
      );
      // Out of range is the normal way a session ends, and every GATT call
      // rejects once that happens.
      try {
        await characteristic.stopNotifications();
      } catch {
        /* already gone */
      }
    }
    device?.gatt?.disconnect();
  }

  onChunk(listener: ChunkListener): () => void {
    return this.emitter.add(listener);
  }
}
