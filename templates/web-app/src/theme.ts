// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useCallback, useEffect, useState } from 'react';

/*
 * Outside Starlight nothing sets `data-theme`, and the package's tokens flip on
 * `:root[data-theme='light']` while `@custom-variant dark` keys on
 * `[data-theme='dark']`. So the app has to own the attribute: with it missing,
 * the tokens give the dark palette but every `dark:` utility in the React layer
 * evaluates false, and the two disagree.
 *
 * That is also why 'system' resolves to a concrete value rather than clearing
 * the attribute.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'helia-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isChoice(value: string | null): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isChoice(stored) ? stored : 'system';
  } catch {
    // Storage throws rather than returning null when the browser blocks it.
    return 'system';
  }
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset['theme'] = resolveTheme(choice);
}

export interface UseThemeResult {
  choice: ThemeChoice;
  setChoice: (next: ThemeChoice) => void;
}

export function useTheme(): UseThemeResult {
  const [choice, setChoiceState] = useState<ThemeChoice>(readThemeChoice);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== 'system') return;

    // Only 'system' tracks the OS; a chosen theme must survive the OS flipping
    // at sunset.
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (): void => {
      applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  }, []);

  return { choice, setChoice };
}
