// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The chrome and the palette the three charting candidates are judged in.
 *
 * Every panel on the comparison page is the same card, the same height and the
 * same colours, so what is left to compare is the library. Not an island
 * itself: the three candidate islands import it.
 */
import { useEffect, useState, type ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';

import type { ChartFraming } from '../lib/chart-data';

/*
 * Two accents and a neutral for the series, the inks for text, the hairline
 * for gridlines. Three series is the ceiling on purpose: a fourth hue turns a
 * chart into a legend the reader has to hold in their head.
 */
const TOKENS = {
  seriesA: '--helia-accent-cyan',
  seriesB: '--helia-accent-blue',
  seriesC: '--helia-accent-slate',
  ink: '--helia-ink-primary',
  inkMuted: '--helia-ink-muted',
  grid: '--helia-hairline',
  font: '--helia-font-sans',
} as const;

export type ChartPalette = Record<keyof typeof TOKENS, string>;

/*
 * Before the first effect the palette is the custom properties themselves, so
 * the server render and the first client render agree and a chart that can
 * take a `var()` is already in the right colours. Observable Plot cannot take
 * one, which is why `resolved` is part of the contract rather than an
 * implementation detail.
 */
const REFERENCED = Object.fromEntries(
  Object.entries(TOKENS).map(([key, property]) => [key, `var(${property})`]),
) as ChartPalette;

function read(): ChartPalette {
  const computed = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, property]) => [
      key,
      computed.getPropertyValue(property).trim() || `var(${property})`,
    ]),
  ) as ChartPalette;
}

export function useChartPalette(): {
  palette: ChartPalette;
  resolved: boolean;
} {
  const [palette, setPalette] = useState<ChartPalette>(REFERENCED);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const apply = () => {
      setPalette(read());
      setResolved(true);
    };
    apply();
    /* The theme switch flips `data-theme` on the root and the tokens under it
       hold different values, not different names, so a chart holding resolved
       colours has to be told to read them again. */
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return { palette, resolved };
}

/** The row a candidate's three charts sit in. */
export function CandidateRow({
  library,
  children,
}: {
  library: string;
  children: ReactNode;
}) {
  return (
    <div
      data-chart-library={library}
      className="not-content grid gap-3 lg:grid-cols-3"
    >
      {children}
    </div>
  );
}

/**
 * One chart, framed. The subtitle carries what is plotted against what, which
 * is why none of the candidates label an axis.
 */
export function ChartPanel({
  framing,
  children,
}: {
  framing: ChartFraming;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{framing.title}</CardTitle>
        <CardDescription>{framing.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div data-chart-candidate="" className="h-60 w-full">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
