// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { Button } from '@ambiqai/helia-ui/react/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import { Progress } from '@ambiqai/helia-ui/react/progress';
import { Skeleton } from '@ambiqai/helia-ui/react/skeleton';

export default function StateShowcase() {
  return (
    <div className="not-content grid gap-3 md:grid-cols-3">
      <Card aria-label="Loading content">
        <CardHeader>
          <CardDescription>Loading</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
          <Progress value={62} className="mt-2" />
        </CardContent>
      </Card>

      <Card className="justify-center text-center">
        <CardHeader>
          <CardTitle>No profiles yet</CardTitle>
          <CardDescription>
            Run a model on hardware to create the first result.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm">
            Profile a model
          </Button>
        </CardContent>
      </Card>

      <Card className="justify-center text-center">
        <CardHeader>
          <CardTitle>Unable to load results</CardTitle>
          <CardDescription>
            Check the connection and try the request again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
