// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ambiqai/helia-ui/react/select';

import type { ThemeChoice } from '../theme';

interface ThemeToggleProps {
  choice: ThemeChoice;
  onChange: (next: ThemeChoice) => void;
}

export function ThemeToggle({ choice, onChange }: ThemeToggleProps) {
  return (
    <Select
      value={choice}
      onValueChange={(next) => {
        onChange(next as ThemeChoice);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Theme"
        data-testid="theme-select"
        className="w-[7.5rem]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">System</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  );
}
