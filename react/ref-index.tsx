'use client';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq

import * as React from 'react';
import { cn } from 'cn';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

import { Input } from './input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import type { RefIndexFacet, RefIndexRow } from '../ref-index-model';

/*
 * The searchable index over a generated reference: one row per symbol, a
 * search box, a chip per facet value, and a link into the page that documents
 * the symbol.
 *
 * Every row is in the document from the first paint and filtering only hides
 * rows, which is what makes the control a filter rather than a search: the
 * count is the answer, and it is there before the island hydrates because the
 * build renders the same markup.
 *
 * Rows arrive built -- `buildRefIndex` runs at build, in the Astro part -- so
 * this holds no model, no fetch and no schema. A six hundred row index is a
 * list, not a dataset, so it is not virtualized; what it does instead is
 * compute the search text once and keep the filtered slice under `useMemo`,
 * which is where a re-filter on every keystroke otherwise costs a frame.
 *
 * The composition is the table primitives rather than `DataTable`: the rows
 * carry links and an expandable detail row, and the filtering is this
 * component's own, so TanStack would be a second row model over the first.
 */

interface RefIndexProps {
  /** The rows, already built and sorted. */
  rows: readonly RefIndexRow[];
  /** The filter controls, in the order they are offered. */
  facets?: readonly RefIndexFacet[];
  /** The table's caption and the accessible name of the search box. Required. */
  label: string;
  /** Placeholder for the search box. */
  placeholder?: string;
  /** What the table says when every row is filtered out. */
  emptyMessage?: string;
  /**
   * Height of the scroll frame the rows sit in, as a CSS length.
   *
   * The frame is why filtering moves nothing below the table: the page's own
   * layout is the same whether one row matches or six hundred do.
   */
  height?: string;
  className?: string;
}

/* A stable empty default: a fresh array on every render would defeat the memo
   on the row, which is the one thing keeping a six hundred row table cheap to
   expand. */
const NO_FACETS: readonly RefIndexFacet[] = [];

/** The label a detail disclosure announces, since the visible control is an icon. */
const detailLabel = (name: string): string => `Details for ${name}`;

const searchText = (row: RefIndexRow): string =>
  [row.name, row.summary, row.module, ...Object.values(row.facets).flat()]
    .join(' ')
    .toLowerCase();

const matchesFacets = (
  row: RefIndexRow,
  selected: Record<string, readonly string[]>,
): boolean => {
  for (const [id, values] of Object.entries(selected)) {
    if (values.length === 0) continue;
    const own = row.facets[id];
    if (!own || !values.some((value) => own.includes(value))) return false;
  }
  return true;
};

function FacetChips({
  facet,
  selected,
  onToggle,
}: {
  facet: RefIndexFacet;
  selected: readonly string[];
  onToggle: (facetId: string, value: string) => void;
}) {
  return (
    <div
      data-slot="ref-index-facet"
      role="group"
      aria-label={facet.label}
      className="flex flex-wrap items-baseline gap-2"
    >
      <span className="text-label text-muted-foreground uppercase">
        {facet.label}
      </span>
      {facet.values.map((value) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            data-slot="ref-index-chip"
            aria-pressed={active}
            onClick={() => onToggle(facet.id, value)}
            className={cn(
              'inline-flex min-h-(--helia-control-sm) items-center rounded-pill border px-3 text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-foreground hover:bg-subtle hover:text-subtle-foreground',
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

const RefIndexRowView = React.memo(function RefIndexRowView({
  row,
  facets,
  expanded,
  onToggleDetail,
}: {
  row: RefIndexRow;
  facets: readonly RefIndexFacet[];
  expanded: boolean;
  onToggleDetail: (id: string) => void;
}) {
  const detailId = `${row.id}-detail`;
  const contract = row.contract;

  return (
    <>
      <TableRow data-slot="ref-index-row">
        <TableCell className="align-top font-medium whitespace-nowrap">
          <span className="flex items-center gap-1">
            {contract ? (
              <button
                type="button"
                data-slot="ref-index-detail-toggle"
                aria-expanded={expanded}
                aria-controls={detailId}
                aria-label={detailLabel(row.name)}
                onClick={() => onToggleDetail(row.id)}
                className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {expanded ? (
                  <ChevronDownIcon className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" />
                )}
              </button>
            ) : (
              <span className="size-5" aria-hidden="true" />
            )}
            <a
              href={row.href}
              className="font-mono text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {row.name}
            </a>
          </span>
        </TableCell>
        <TableCell className="align-top text-muted-foreground">
          {row.summary}
        </TableCell>
        {facets.map((facet) => (
          <TableCell key={facet.id} className="align-top whitespace-nowrap">
            {(row.facets[facet.id] ?? []).join(', ')}
          </TableCell>
        ))}
      </TableRow>
      {contract && expanded && (
        <TableRow data-slot="ref-index-detail" id={detailId}>
          <TableCell colSpan={facets.length + 2} className="bg-muted/40">
            <dl className="grid gap-2 text-sm md:grid-cols-[10rem_1fr]">
              {contract.prerequisites && contract.prerequisites.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Prerequisites</dt>
                  <dd>
                    <ul className="list-disc pl-4">
                      {contract.prerequisites.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              )}
              {contract.bufferSize && (
                <>
                  <dt className="text-muted-foreground">Buffer size</dt>
                  <dd className="font-mono">{contract.bufferSize}</dd>
                </>
              )}
              {contract.tolerances && (
                <>
                  <dt className="text-muted-foreground">Tolerances</dt>
                  <dd>{contract.tolerances}</dd>
                </>
              )}
              {contract.notes && (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd>{contract.notes}</dd>
                </>
              )}
            </dl>
          </TableCell>
        </TableRow>
      )}
    </>
  );
});

function RefIndex({
  rows,
  facets = NO_FACETS,
  label,
  placeholder = 'Filter by name',
  emptyMessage = 'No symbols match these filters.',
  height = '32rem',
  className,
}: RefIndexProps) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = React.useState<readonly string[]>([]);

  /* The list stays responsive while the input stays immediate: React renders
     the keystroke first and the filtered table behind it. */
  const deferredQuery = React.useDeferredValue(query);

  const haystack = React.useMemo(() => rows.map(searchText), [rows]);

  const visible = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const active = Object.values(selected).some((values) => values.length > 0);
    if (!needle && !active) return rows;
    return rows.filter(
      (row, index) =>
        (!needle || haystack[index].includes(needle)) &&
        matchesFacets(row, selected),
    );
  }, [rows, haystack, deferredQuery, selected]);

  const onToggleFacet = React.useCallback((facetId: string, value: string) => {
    setSelected((current) => {
      const values = current[facetId] ?? [];
      return {
        ...current,
        [facetId]: values.includes(value)
          ? values.filter((entry) => entry !== value)
          : [...values, value],
      };
    });
  }, []);

  const onToggleDetail = React.useCallback((id: string) => {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const filtered =
    query.trim().length > 0 ||
    Object.values(selected).some((values) => values.length > 0);

  return (
    <div
      data-slot="ref-index"
      className={cn('not-content flex flex-col gap-4', className)}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="sr-only">{label}</span>
          <Input
            data-slot="ref-index-search"
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {facets.map((facet) => (
          <FacetChips
            key={facet.id}
            facet={facet}
            selected={selected[facet.id] ?? []}
            onToggle={onToggleFacet}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p
          data-slot="ref-index-count"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {visible.length} of {rows.length} symbols
        </p>
        {filtered && (
          <button
            type="button"
            data-slot="ref-index-clear"
            onClick={() => {
              setQuery('');
              setSelected({});
            }}
            className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-y-auto rounded-md border" style={{ height }}>
        <Table>
          <TableCaption className="sr-only">{label}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-background">
                Symbol
              </TableHead>
              <TableHead className="sticky top-0 bg-background">
                Summary
              </TableHead>
              {facets.map((facet) => (
                <TableHead
                  key={facet.id}
                  className="sticky top-0 bg-background"
                >
                  {facet.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length > 0 ? (
              visible.map((row) => (
                <RefIndexRowView
                  key={row.id}
                  row={row}
                  facets={facets}
                  expanded={expanded.includes(row.id)}
                  onToggleDetail={onToggleDetail}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={facets.length + 2}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export { RefIndex, type RefIndexProps };
