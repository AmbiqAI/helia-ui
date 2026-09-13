'use client';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDownUpIcon } from 'lucide-react';

import { Button } from './button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

/*
 * shadcn ships Data Table as a documentation recipe: TanStack Table driving the
 * Table primitives. It is written out here for the same reason as Combobox --
 * the recipe is a component, not a snippet to paste per use site.
 *
 * Sorting and pagination are opt-in so a static comparison table pays for
 * neither.
 */

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  caption?: string;
  pageSize?: number;
  sortable?: boolean;
}

function DataTable<TData, TValue>({
  columns,
  data,
  caption,
  pageSize,
  sortable = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable
      ? { getSortedRowModel: getSortedRowModel(), onSortingChange: setSorting }
      : {}),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    state: sortable ? { sorting } : undefined,
    initialState: pageSize
      ? { pagination: { pageIndex: 0, pageSize } }
      : undefined,
  });

  return (
    <div className="flex flex-col gap-3">
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const content = header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    );
                return (
                  <TableHead key={header.id}>
                    {sortable && header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {content}
                        <ArrowDownUpIcon />
                      </Button>
                    ) : (
                      content
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No rows.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pageSize && table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export { DataTable, type ColumnDef };
