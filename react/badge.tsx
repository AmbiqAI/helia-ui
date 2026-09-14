// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill border border-transparent px-2 py-1 text-[length:var(--helia-text-label)] leading-none font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-[1em]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/82',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/82',
        destructive:
          'bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/82',
        outline:
          'border-border text-foreground [a&]:hover:bg-subtle [a&]:hover:text-subtle-foreground',
        ghost: '[a&]:hover:bg-subtle [a&]:hover:text-subtle-foreground',
        link: 'text-primary underline-offset-4 [a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
