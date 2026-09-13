// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useState } from 'react';
import { ArrowRightIcon, CodeIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@ambiqai/helia-ui/react/badge';
import { Button } from '@ambiqai/helia-ui/react/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import { Checkbox } from '@ambiqai/helia-ui/react/checkbox';
import { Combobox } from '@ambiqai/helia-ui/react/combobox';
import { Input } from '@ambiqai/helia-ui/react/input';
import { Label } from '@ambiqai/helia-ui/react/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@ambiqai/helia-ui/react/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ambiqai/helia-ui/react/select';
import { Slider } from '@ambiqai/helia-ui/react/slider';
import { Toaster } from '@ambiqai/helia-ui/react/sonner';
import { Switch } from '@ambiqai/helia-ui/react/switch';
import { Tabs, TabsList, TabsTrigger } from '@ambiqai/helia-ui/react/tabs';
import { Textarea } from '@ambiqai/helia-ui/react/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ambiqai/helia-ui/react/tooltip';

const boards = [
  { value: 'apollo510', label: 'Apollo510 EVB' },
  { value: 'apollo4', label: 'Apollo4 Plus EVB' },
  { value: 'apollo3', label: 'Apollo3 Blue EVB' },
];

const models = [
  { value: 'speech-enhancement', label: 'speech_enhancement.tflite' },
  { value: 'vital-signs', label: 'vital_signs.tflite' },
  { value: 'keyword-spotting', label: 'keyword_spotting.tflite' },
];

export default function InputShowcase() {
  const [density, setDensity] = useState('comfortable');
  const [model, setModel] = useState('speech-enhancement');

  return (
    <TooltipProvider>
      <div className="not-content flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button onClick={() => toast('Primary button triggered')}>
              Primary
            </Button>
            <Button
              variant="outline"
              onClick={() => toast('Secondary button triggered')}
            >
              Secondary
            </Button>
            <Button
              variant="ghost"
              onClick={() => toast('Text button triggered')}
            >
              Text
            </Button>
            <Button
              variant="destructive"
              onClick={() => toast('Danger button triggered')}
            >
              Danger
            </Button>
            <Button disabled>Disabled</Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View source"
                  onClick={() => toast('Icon button triggered')}
                >
                  <CodeIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View source</TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              onClick={() => toast('Icon and text button triggered')}
            >
              <ArrowRightIcon />
              View docs
            </Button>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Text and selection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input id="project-name" defaultValue="apollo-voice" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target-board">Target board</Label>
              <Select defaultValue="apollo510">
                <SelectTrigger id="target-board" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.value} value={board.value}>
                      {board.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Model artifact</Label>
              {/* A combobox rather than a select: the list is searchable and
                  the file names are long enough that scanning beats scrolling. */}
              <Combobox
                aria-label="Model artifact"
                options={models}
                value={model}
                onValueChange={setModel}
                searchPlaceholder="Search models"
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="release-note">Release note</Label>
              <Textarea
                id="release-note"
                placeholder="What changed in this build"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Choice controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Deployment engine</legend>
              <RadioGroup defaultValue="rt">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="rt" id="engine-rt" />
                  <Label htmlFor="engine-rt">heliaRT</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="aot" id="engine-aot" />
                  <Label htmlFor="engine-aot">heliaAOT</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="tflm" id="engine-tflm" />
                  <Label htmlFor="engine-tflm">TFLM</Label>
                </div>
              </RadioGroup>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Measurements</legend>
              <div className="flex items-center gap-2">
                <Checkbox id="measure-performance" defaultChecked />
                <Label htmlFor="measure-performance">Performance</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="measure-memory" defaultChecked />
                <Label htmlFor="measure-memory">Memory</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="measure-power" />
                <Label htmlFor="measure-power">Power</Label>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="text-sm font-medium">Settings</legend>
              <div className="flex items-center gap-2">
                <Switch id="per-layer" defaultChecked />
                <Label htmlFor="per-layer">Include per-layer data</Label>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="arena-budget">Arena budget</Label>
                <Slider
                  id="arena-budget"
                  defaultValue={[192]}
                  min={64}
                  max={512}
                  step={8}
                />
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segmented control</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs standing in for a segmented control: the same one-of-many
                choice, and the only compound shadcn primitive that carries the
                roving focus this pattern needs. */}
            <Tabs value={density} onValueChange={setDensity}>
              <TabsList aria-label="View density">
                <TabsTrigger value="comfortable">Comfortable</TabsTrigger>
                <TabsTrigger value="compact">Compact</TabsTrigger>
                <TabsTrigger value="dense">Dense</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}
