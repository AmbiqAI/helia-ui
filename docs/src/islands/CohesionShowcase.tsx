// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The React half of the cohesion page. The Astro half is written inline in the
 * page, and the two are read as pairs, so every block here has a counterpart
 * there in the same order and with the same content.
 *
 * A fragment rather than a wrapper: the page lays the pairs out on one grid and
 * `astro-island` is `display: contents`, so these sections are the grid's own
 * items and each one can sit on the row its Astro counterpart is on.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ambiqai/helia-ui/react/accordion';
import { Badge } from '@ambiqai/helia-ui/react/badge';
import { Button } from '@ambiqai/helia-ui/react/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ambiqai/helia-ui/react/tabs';

const pane = 'cohesion-pane cohesion-pane--react not-content';

const rows = [
  {
    title: 'Ships with the package',
    body: 'Tokens, the Astro parts, the React layer and the Starlight plugin.',
  },
  {
    title: 'Ships with the consuming site',
    body: 'The scan list, the site theme, and every island that composes the React layer.',
  },
];

export default function CohesionShowcase() {
  return (
    <>
      <section className={pane} aria-label="React Button">
        <h3>React</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button data-cohesion="react-button">Primary</Button>
          <Button variant="outline">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Danger</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className={pane} aria-label="React Badge">
        <h3>React</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Neutral</Badge>
          <Badge variant="secondary">Accent</Badge>
          <Badge variant="destructive">Danger</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Small</Badge>
          <Badge variant="outline" className="px-3 py-2 text-sm">
            Medium
          </Badge>
        </div>
      </section>

      <section className={pane} aria-label="React Card">
        <h3>React</h3>
        <Card data-cohesion="react-card">
          {/* One child, so shadcn's second header row is an empty row and a gap. */}
          <CardHeader className="gap-y-0">
            <CardTitle>Consuming the package</CardTitle>
          </CardHeader>
          <CardContent>
            The React layer takes its data through props, so nothing in it knows
            what a product or a demo is.
          </CardContent>
          <CardFooter>
            <Button size="sm">Read the guide</Button>
            <Button size="sm" variant="ghost">
              Skip
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className={pane} aria-label="React Tabs">
        <h3>React</h3>
        <Tabs defaultValue="install">
          <TabsList variant="line">
            <TabsTrigger value="install">npm</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>
          <TabsContent value="install">
            <p>npm install @ambiqai/helia-ui</p>
          </TabsContent>
          <TabsContent value="import">
            <p>
              import Button from
              &apos;@ambiqai/helia-ui/astro/Button.astro&apos;
            </p>
          </TabsContent>
        </Tabs>
      </section>

      <section className={pane} aria-label="React Accordion">
        <h3>React</h3>
        <Accordion
          type="single"
          collapsible
          defaultValue="row-0"
          className="overflow-hidden rounded-xl border bg-card"
        >
          {rows.map((row, index) => (
            <AccordionItem key={row.title} value={`row-${index}`}>
              <AccordionTrigger>{row.title}</AccordionTrigger>
              <AccordionContent>{row.body}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
