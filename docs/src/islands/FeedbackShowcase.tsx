// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { InfoIcon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@ambiqai/helia-ui/react/alert';
import { Button } from '@ambiqai/helia-ui/react/button';
import { Toaster } from '@ambiqai/helia-ui/react/sonner';

export default function FeedbackShowcase() {
  return (
    <div className="not-content flex flex-col gap-2">
      <Alert>
        <InfoIcon />
        <AlertTitle>Toolchain required</AlertTitle>
        <AlertDescription>
          This workflow requires the Arm GNU Toolchain and SEGGER J-Link.
        </AlertDescription>
      </Alert>
      <Alert>
        <InfoIcon />
        <AlertTitle>Results written</AlertTitle>
        <AlertDescription>
          Results are written to the selected output directory.
        </AlertDescription>
      </Alert>
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Interface may change</AlertTitle>
        <AlertDescription>
          This interface may change before the next stable release.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <OctagonXIcon />
        <AlertTitle>Probe disconnected</AlertTitle>
        <AlertDescription>
          The probe disconnected before the profile completed.
        </AlertDescription>
      </Alert>
      <div>
        <Button onClick={() => toast('Example notification triggered')}>
          Trigger notification
        </Button>
      </div>
      <Toaster />
    </div>
  );
}
