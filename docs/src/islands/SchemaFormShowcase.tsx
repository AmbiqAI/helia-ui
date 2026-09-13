// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useMemo, useState } from 'react';

import { Badge } from '@ambiqai/helia-ui/react/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import { Input } from '@ambiqai/helia-ui/react/input';
import { Label } from '@ambiqai/helia-ui/react/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ambiqai/helia-ui/react/select';
import { Switch } from '@ambiqai/helia-ui/react/switch';

type SchemaValue = string | number | boolean;

interface SchemaProperty {
  type: 'string' | 'number' | 'boolean';
  title: string;
  description: string;
  default: SchemaValue;
  enum?: readonly string[];
}

interface ObjectSchema {
  $schema: string;
  additionalProperties: boolean;
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: readonly string[];
}

const deploymentSchema: ObjectSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  additionalProperties: false,
  type: 'object',
  required: ['model', 'engine', 'target'],
  properties: {
    model: {
      type: 'string',
      title: 'Model artifact',
      description: 'LiteRT/TFLite file to compile or profile.',
      default: 'speech_enhancement.tflite',
    },
    engine: {
      type: 'string',
      title: 'Deployment engine',
      description: 'Runtime selected for this configuration.',
      default: 'heliaAOT',
      enum: ['heliaRT', 'heliaAOT', 'TFLM reference'],
    },
    target: {
      type: 'string',
      title: 'Target board',
      description: 'Hardware target used by the build or profiling run.',
      default: 'Apollo510 EVB',
      enum: ['Apollo510 EVB', 'Apollo4 Plus EVB'],
    },
    arena_kb: {
      type: 'number',
      title: 'Arena budget (KB)',
      description: 'Optional memory constraint for an early design check.',
      default: 192,
    },
    include_per_layer: {
      type: 'boolean',
      title: 'Include per-layer measurements',
      description:
        'Retain detailed operator measurements in the result bundle.',
      default: true,
    },
  },
};

function initialValues(schema: ObjectSchema): Record<string, SchemaValue> {
  return Object.fromEntries(
    Object.entries(schema.properties).map(([key, property]) => [
      key,
      property.default,
    ]),
  );
}

export default function SchemaFormShowcase() {
  const [values, setValues] = useState(() => initialValues(deploymentSchema));

  const updateValue = (key: string, value: SchemaValue) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const serialized = useMemo(() => JSON.stringify(values, null, 2), [values]);

  return (
    <div className="not-content">
      <Card>
        <CardHeader>
          <CardTitle>Schema-driven configuration</CardTitle>
          <CardDescription>
            Render a consistent form from one typed object schema, then pass the
            resulting JSON to a CLI, API, or CI job.
          </CardDescription>
          <Badge variant="outline" className="row-span-2 self-start">
            JSON schema
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(deploymentSchema.properties).map(
              ([key, property]) => {
                const fieldId = `schema-${key}`;

                if (property.type === 'boolean') {
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 sm:col-span-2"
                    >
                      <div className="flex items-center gap-2">
                        <Switch
                          id={fieldId}
                          checked={Boolean(values[key])}
                          onCheckedChange={(checked) =>
                            updateValue(key, checked)
                          }
                        />
                        <Label htmlFor={fieldId}>{property.title}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {property.description}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={key}
                    className={
                      key === 'model'
                        ? 'flex flex-col gap-2 sm:col-span-2'
                        : 'flex flex-col gap-2'
                    }
                  >
                    <Label htmlFor={fieldId}>
                      {property.title}
                      {deploymentSchema.required.includes(key) && ' *'}
                    </Label>
                    {property.enum ? (
                      <Select
                        value={String(values[key])}
                        onValueChange={(value) => updateValue(key, value)}
                      >
                        <SelectTrigger id={fieldId} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {property.enum.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={fieldId}
                        type={property.type === 'number' ? 'number' : 'text'}
                        value={String(values[key])}
                        onChange={(event) =>
                          updateValue(
                            key,
                            property.type === 'number'
                              ? Number(event.target.value)
                              : event.target.value,
                          )
                        }
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {property.description}
                    </p>
                  </div>
                );
              },
            )}
          </div>

          <section className="self-start rounded-lg border border-border bg-muted p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Generated configuration</h4>
              <span className="text-xs text-muted-foreground">
                {deploymentSchema.required.length} required fields
              </span>
            </div>
            <pre className="mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
              {serialized}
            </pre>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
