// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Toaster } from '@ambiqai/helia-ui/react/sonner';

import type { ConnectionState } from './connection';
import { ControlPanel } from './components/ControlPanel';
import { SignalChart } from './components/SignalChart';
import { StatusFooter } from './components/StatusFooter';
import { TopBar } from './components/TopBar';
import { BluetoothSource } from './stream/bluetooth-source';
import { SimulatedSource } from './stream/simulated-source';
import { WebUsbSource } from './stream/webusb-source';
import { clampSampleRate, type SourceId } from './stream/source';
import { useStream } from './stream/use-stream';
import { useTheme } from './theme';

const DEFAULT_SAMPLE_RATE = 100;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const { choice, setChoice } = useTheme();

  // Built once and kept: a source owns a worker or a USB handle, so rebuilding
  // it on a render would leak the transport it was holding.
  const sources = useMemo(
    () => [new SimulatedSource(), new WebUsbSource(), new BluetoothSource()],
    [],
  );

  const [sourceId, setSourceId] = useState<SourceId>('simulated');
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);
  const [state, setState] = useState<ConnectionState>('disconnected');

  const source =
    sources.find((candidate) => candidate.id === sourceId) ?? sources[0];
  const { snapshot, reset } = useStream(source, sampleRate);

  const support = source.support();

  const connect = useCallback(() => {
    setState('connecting');
    reset();
    source
      .connect(sampleRate)
      .then(() => {
        setState('connected');
        toast.success(`${source.label} connected`, {
          description: `Streaming at ${String(sampleRate)} Hz.`,
        });
      })
      .catch((error: unknown) => {
        setState('error');
        toast.error(`${source.label} did not connect`, {
          description: messageOf(error),
        });
      });
  }, [source, sampleRate, reset]);

  const disconnect = useCallback(() => {
    source
      .disconnect()
      .catch(() => {
        /* the transport is gone either way; the UI must still settle */
      })
      .finally(() => {
        setState('disconnected');
        reset();
        toast(`${source.label} disconnected`);
      });
  }, [source, reset]);

  const changeSource = useCallback(
    (next: SourceId) => {
      void source.disconnect();
      setState('disconnected');
      reset();
      setSourceId(next);
    },
    [source, reset],
  );

  const changeSampleRate = useCallback(
    (next: number) => {
      const rate = clampSampleRate(next);
      setSampleRate(rate);
      // Retuning invalidates the window's time base, so the held samples would
      // be plotted against the wrong span until they scrolled out.
      source.setSampleRate(rate);
      reset();
    },
    [source, reset],
  );

  useEffect(() => {
    return () => {
      void source.disconnect();
    };
  }, [source]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-canvas text-ink">
      <TopBar state={state} themeChoice={choice} onThemeChange={setChoice} />

      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[20rem_1fr]">
        <ControlPanel
          sources={sources}
          sourceId={sourceId}
          onSourceChange={changeSource}
          sampleRate={sampleRate}
          onSampleRateChange={changeSampleRate}
          state={state}
          unsupportedReason={support.supported ? undefined : support.reason}
          onConnect={connect}
          onDisconnect={disconnect}
        />

        <section
          className="min-h-[24rem] rounded-lg border border-hairline bg-surface-card p-4"
          data-testid="chart-panel"
        >
          <SignalChart points={snapshot.points} />
        </section>
      </main>

      <StatusFooter
        snapshot={snapshot}
        sampleRate={sampleRate}
        sourceLabel={source.label}
      />
      <Toaster />
    </div>
  );
}
