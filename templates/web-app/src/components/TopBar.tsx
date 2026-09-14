// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { Badge } from '@ambiqai/helia-ui/react/badge';

import type { ThemeChoice } from '../theme';
import type { ConnectionState } from '../connection';
import { ThemeToggle } from './ThemeToggle';

/*
 * Badge has no semantic tones — the package leaves "what Connected looks like"
 * to the consumer on purpose — so the mapping is the app's.
 */
const TONE: Record<
  ConnectionState,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  disconnected: 'outline',
  connecting: 'secondary',
  connected: 'default',
  error: 'destructive',
};

const LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Streaming',
  error: 'Error',
};

interface TopBarProps {
  state: ConnectionState;
  themeChoice: ThemeChoice;
  onThemeChange: (next: ThemeChoice) => void;
}

export function TopBar({ state, themeChoice, onThemeChange }: TopBarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-hairline bg-surface-paper px-4 py-3">
      <h1 className="text-card-title font-semibold text-ink">Signal monitor</h1>
      <Badge
        variant={TONE[state]}
        data-testid="connection-badge"
        data-state={state}
      >
        {LABEL[state]}
      </Badge>
      <div className="ml-auto">
        <ThemeToggle choice={themeChoice} onChange={onThemeChange} />
      </div>
    </header>
  );
}
