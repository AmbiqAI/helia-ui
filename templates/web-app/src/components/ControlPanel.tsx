// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { Button } from '@ambiqai/helia-ui/react/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ambiqai/helia-ui/react/select';
import { Slider } from '@ambiqai/helia-ui/react/slider';

import type { ConnectionState } from '../connection';
import {
  SAMPLE_RATE_MAX,
  SAMPLE_RATE_MIN,
  type Source,
  type SourceId,
} from '../stream/source';

interface ControlPanelProps {
  sources: readonly Source[];
  sourceId: SourceId;
  onSourceChange: (next: SourceId) => void;
  sampleRate: number;
  onSampleRateChange: (next: number) => void;
  state: ConnectionState;
  unsupportedReason: string | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ControlPanel({
  sources,
  sourceId,
  onSourceChange,
  sampleRate,
  onSampleRateChange,
  state,
  unsupportedReason,
  onConnect,
  onDisconnect,
}: ControlPanelProps) {
  const connected = state === 'connected';
  const busy = state === 'connecting';

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Source</CardTitle>
        <CardDescription>
          Pick a transport, then start the stream.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            className="text-label font-medium text-ink-secondary"
            id="source-label"
          >
            Transport
          </label>
          <Select
            value={sourceId}
            disabled={connected || busy}
            onValueChange={(next) => {
              onSourceChange(next as SourceId);
            }}
          >
            <SelectTrigger
              aria-labelledby="source-label"
              data-testid="source-select"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unsupportedReason ? (
            <p
              className="text-caption text-destructive"
              role="status"
              data-testid="unsupported-reason"
            >
              {unsupportedReason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <label
              className="text-label font-medium text-ink-secondary"
              id="rate-label"
            >
              Sample rate
            </label>
            <span
              className="text-label tabular-nums text-ink"
              data-testid="sample-rate"
            >
              {sampleRate} Hz
            </span>
          </div>
          <Slider
            aria-labelledby="rate-label"
            value={[sampleRate]}
            min={SAMPLE_RATE_MIN}
            max={SAMPLE_RATE_MAX}
            step={10}
            onValueChange={([next]) => {
              if (next !== undefined) onSampleRateChange(next);
            }}
          />
        </div>

        <Button
          variant={connected ? 'outline' : 'default'}
          disabled={busy || unsupportedReason !== undefined}
          onClick={connected ? onDisconnect : onConnect}
          data-testid="connect-button"
          className="w-full"
        >
          {connected ? 'Disconnect' : busy ? 'Connecting…' : 'Connect'}
        </Button>
      </CardContent>
    </Card>
  );
}
