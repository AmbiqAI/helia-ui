// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useState } from 'react';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@ambiqai/helia-ui/react/breadcrumb';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@ambiqai/helia-ui/react/pagination';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ambiqai/helia-ui/react/tabs';

const pages = [1, 2, 3, 4, 5];

export default function NavigationShowcase() {
  const [page, setPage] = useState(1);

  return (
    <div className="not-content flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Breadcrumbs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/helia-ui/ecosystem/">
                  Platform
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/helia-ui/products/core/">
                  Products
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>heliaAOT</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* A long trail collapses in the middle: the first and last two
              segments are the ones that orient a reader. */}
          <Breadcrumb aria-label="Long breadcrumb">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/helia-ui/ecosystem/">
                  Platform
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbEllipsis />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/helia-ui/products/aot/">
                  heliaAOT
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Memory planning</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            {/* Eight triggers overflow a phone width, so the list scrolls
                rather than overhanging its container. */}
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="quickstart">Quickstart</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="reference">Reference</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-sm">
              What the product is and when to reach for it.
            </TabsContent>
            <TabsContent value="quickstart" className="text-sm">
              The shortest path from install to a running model.
            </TabsContent>
            <TabsContent value="examples" className="text-sm">
              Worked examples against representative hardware.
            </TabsContent>
            <TabsContent value="reference" className="text-sm">
              Generated API surface and configuration keys.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagination</CardTitle>
        </CardHeader>
        <CardContent>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setPage((current) => Math.max(1, current - 1));
                  }}
                />
              </PaginationItem>
              {pages.map((item) => (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === page}
                    onClick={(event) => {
                      event.preventDefault();
                      setPage(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setPage((current) => Math.min(pages.length, current + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>
    </div>
  );
}
