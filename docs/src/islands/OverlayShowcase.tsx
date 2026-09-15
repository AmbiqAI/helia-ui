// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useEffect, useState } from 'react';
import { InfoIcon } from 'lucide-react';

import { Button } from '@ambiqai/helia-ui/react/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@ambiqai/helia-ui/react/command';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ambiqai/helia-ui/react/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ambiqai/helia-ui/react/dropdown-menu';
import { Label } from '@ambiqai/helia-ui/react/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@ambiqai/helia-ui/react/popover';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@ambiqai/helia-ui/react/sheet';
import { Switch } from '@ambiqai/helia-ui/react/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ambiqai/helia-ui/react/tooltip';

const products = ['heliaAOT', 'heliaRT', 'heliaEDGE', 'heliaCORE'];

export default function OverlayShowcase() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <div className="not-content rounded-xl border border-border p-4">
        <h3 className="text-lg font-semibold">Overlay triggers</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the lightest overlay that gives the task enough room.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Tooltip example">
                <InfoIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Shows a short, non-essential label</TooltipContent>
          </Tooltip>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <h4 className="text-sm font-semibold">Target memory</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Peak tensor arena usage is measured after model initialization.
              </p>
            </PopoverContent>
          </Popover>

          {/*
           * The trigger is a DialogTrigger rather than a Button driving
           * controlled state: Radix restores focus to the element it opened
           * from, and with controlled state there is no such element, so
           * Escape drops focus to the body.
           */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate deployment bundle?</DialogTitle>
                <DialogDescription>
                  This replaces the generated files in the selected output
                  directory.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Generate</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button>Open side sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Build settings</SheetTitle>
                <SheetDescription>
                  The sheet keeps the page behind it in view, so a longer
                  supporting task does not lose its context.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                <div>
                  <h4 className="text-sm font-semibold">Deployment engine</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    heliaRT with Apollo510-optimized kernels.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="sheet-manifest" defaultChecked />
                  <Label htmlFor="sheet-manifest">Write a manifest</Label>
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button>Apply settings</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Copy configuration</DropdownMenuItem>
              <DropdownMenuItem>Export results</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">
                Discard run
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={() => setPaletteOpen(true)}>
            Open command palette
          </Button>
        </div>

        {/* The package's own palette wrapper rather than a dialog with a
            command inside it: the wrapper is what carries the close button's
            inset for a surface that has no content padding of its own. */}
        <CommandDialog
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          title="Command palette"
          description="Search the product list by name."
        >
          <CommandInput placeholder="Search products" />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup heading="Products">
              {products.map((product) => (
                <CommandItem
                  key={product}
                  onSelect={() => setPaletteOpen(false)}
                >
                  {product}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </TooltipProvider>
  );
}
