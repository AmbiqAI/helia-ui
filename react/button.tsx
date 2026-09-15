// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill border border-transparent py-0 font-semibold whitespace-nowrap transition-colors leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1em]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/82',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/82',
        outline:
          'border-border bg-transparent text-foreground hover:bg-subtle hover:text-subtle-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-subtle hover:text-subtle-foreground',
        ghost: 'text-foreground hover:bg-subtle hover:text-subtle-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-(--helia-control-md) px-5 text-base has-[>svg]:px-4',
        xs: 'h-6 gap-1 rounded-pill px-2 text-xs has-[>svg]:px-1.5',
        sm: 'min-h-(--helia-control-sm) gap-1.5 rounded-pill px-4 text-sm has-[>svg]:px-3',
        lg: 'min-h-(--helia-control-lg) rounded-pill px-6 text-base has-[>svg]:px-5',
        icon: 'size-(--helia-control-md)',
        'icon-xs': 'size-6 rounded-pill',
        'icon-sm': 'size-(--helia-control-sm)',
        'icon-lg': 'size-(--helia-control-lg)',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
