// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useState } from 'react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@ambiqai/helia-ui/react/alert';
import { Badge } from '@ambiqai/helia-ui/react/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import { Label } from '@ambiqai/helia-ui/react/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ambiqai/helia-ui/react/select';

const versions = {
  '1.4': {
    label: '1.4',
    option: '1.4 — current',
    status: 'Current',
    released: 'July 2026',
    summary: 'Recommended for new heliaRT integrations.',
    boards: ['Apollo510', 'Apollo4 Plus'],
  },
  '1.3': {
    label: '1.3',
    option: '1.3 — maintenance',
    status: 'Maintenance',
    released: 'April 2026',
    summary: 'Receives critical fixes through October 2026.',
    boards: ['Apollo510', 'Apollo4 Plus'],
  },
  '2.0-beta': {
    label: '2.0 beta',
    option: '2.0 beta — preview',
    status: 'Preview',
    released: 'July 2026',
    summary: 'Evaluation release; APIs may change before stable.',
    boards: ['Apollo510'],
  },
} as const;

type VersionKey = keyof typeof versions;

export default function VersioningShowcase() {
  const [selected, setSelected] = useState<VersionKey>('1.4');
  const version = versions[selected];

  return (
    <div className="not-content flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Documentation version</CardTitle>
          <CardDescription>
            Keep the selected version visible and preserve it while navigating.
          </CardDescription>
          <div className="flex flex-col gap-2 self-end">
            <Label htmlFor="version-select">heliaRT version</Label>
            <Select
              value={selected}
              onValueChange={(value) => setSelected(value as VersionKey)}
            >
              <SelectTrigger id="version-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(versions).map(([key, entry]) => (
                  <SelectItem key={key} value={key}>
                    {entry.option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent
          data-version-detail
          className="grid gap-5 border-t border-border pt-5 md:grid-cols-2"
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">heliaRT {version.label}</h3>
              <Badge variant="outline">{version.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {version.summary}
            </p>
          </div>
          <dl className="m-0">
            <dt className="text-xs text-muted-foreground">Released</dt>
            <dd className="mt-1 mb-4 ml-0 text-sm font-semibold">
              {version.released}
            </dd>
            <dt className="text-xs text-muted-foreground">Supported boards</dt>
            <dd className="mt-2 ml-0 flex flex-wrap gap-1">
              {version.boards.map((board) => (
                <Badge key={board} variant="secondary">
                  {board}
                </Badge>
              ))}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Deprecation notice</AlertTitle>
        <AlertDescription>
          State the replacement, migration path, and support end date together.
        </AlertDescription>
      </Alert>
    </div>
  );
}
