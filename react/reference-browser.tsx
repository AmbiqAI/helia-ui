'use client';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useEffect, useMemo, useState } from 'react';
import type { RefIndexFacet, RefIndexRow } from '../ref-index-model';

export interface ReferenceBrowserProps {
  rows: readonly RefIndexRow[];
  filters?: readonly RefIndexFacet[];
  label: string;
  nameLabel?: string;
  itemsLabel?: string;
  placeholder?: string;
  pageSize?: number;
}
const noFilters: readonly RefIndexFacet[] = [];

export function ReferenceBrowser({
  rows,
  filters = noFilters,
  label,
  nameLabel = 'Name',
  itemsLabel = 'entries',
  placeholder = 'Name or description',
  pageSize = 25,
}: ReferenceBrowserProps) {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  useEffect(() => setReady(true), []);
  const size =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) || 1 : 25;
  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter(
        (row) =>
          Object.entries(selected).every(
            ([id, value]) =>
              !value ||
              (row.facets[id]?.includes(value) ??
                (id === 'group' && row.group === value)),
          ) &&
          words.every((word) =>
            [
              row.name,
              row.summary,
              row.group,
              ...Object.values(row.facets).flat(),
            ]
              .join(' ')
              .toLowerCase()
              .includes(word),
          ),
      )
      .sort((a, b) =>
        sort === 'reverse'
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name),
      );
  }, [rows, query, selected, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pages - 1);
  // Keep the complete reference in server HTML and in pages without JavaScript.
  const visible = ready
    ? filtered.slice(currentPage * size, (currentPage + 1) * size)
    : filtered;
  const active = Boolean(query || Object.values(selected).some(Boolean));
  const reset = () => {
    setQuery('');
    setSelected({});
    setPage(0);
  };
  return (
    <section
      className="helia-reference-browser"
      aria-label={label}
      data-ready={ready}
    >
      <div className="helia-reference-controls" hidden={!ready}>
        <label className="helia-reference-search">
          {label}
          <input
            type="search"
            aria-label={label}
            value={query}
            placeholder={placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
        {filters.map((filter) => (
          <label key={filter.id}>
            {filter.label}
            <select
              aria-label={filter.label}
              value={selected[filter.id] ?? ''}
              onChange={(event) => {
                setSelected({ ...selected, [filter.id]: event.target.value });
                setPage(0);
              }}
            >
              <option value="">All</option>
              {filter.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Sort by
          <select
            aria-label="Sort by"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(0);
            }}
          >
            <option value="name">Name: A–Z</option>
            <option value="reverse">Name: Z–A</option>
          </select>
        </label>
      </div>
      <div className="helia-reference-results">
        <p role="status">
          {filtered.length} of {rows.length} {itemsLabel}
          {ready &&
            filtered.length > 0 &&
            ` · Showing ${currentPage * size + 1}–${Math.min((currentPage + 1) * size, filtered.length)}`}
        </p>
        {active && (
          <button type="button" onClick={reset} hidden={!ready}>
            Clear filters
          </button>
        )}
      </div>
      {visible.length ? (
        <div className="helia-reference-table">
          <table>
            <caption className="helia-reference-caption">{label}</caption>
            <thead>
              <tr>
                <th scope="col">{nameLabel}</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <a href={row.href}>{row.name}</a>
                    <small>{row.group}</small>
                  </th>
                  <td>{row.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="helia-reference-empty">
          <p>No matching {itemsLabel}.</p>
          <button type="button" onClick={reset} hidden={!ready}>
            Clear filters
          </button>
        </div>
      )}
      <nav
        className="helia-reference-pagination"
        aria-label={`${label} pages`}
        hidden={!ready || pages < 2}
      >
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous
        </button>
        <span>
          Page {currentPage + 1} of {pages}
        </span>
        <button
          type="button"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
