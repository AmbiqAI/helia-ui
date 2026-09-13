// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { cn } from 'cn';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-subtle', className)}
      {...props}
    />
  );
}

export { Skeleton };
