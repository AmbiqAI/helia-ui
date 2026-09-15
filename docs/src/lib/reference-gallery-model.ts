// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * A hand-written reference model, for the gallery's Reference section.
 *
 * The section exists to answer one question: does a Python function, a C
 * function and a TypeScript function come out looking like the same reference?
 * They only do if all three arrive as the same data, so the examples render
 * from a model rather than from props typed out three ways. This file is that
 * model, checked against the package's own types.
 *
 * Every name, signature and sentence here is invented. The gallery shows the
 * parts working; a published HELIA reference is generated from source by an
 * extractor and is the only place an API contract is stated.
 */
import type { RefParam, RefSymbol } from '@ambiqai/helia-ui/reference-model';

/**
 * The props `RefSymbol` takes, picked out of a symbol.
 *
 * Spelled out rather than spread, because the model carries the body as data
 * too -- parameters, returns, examples -- and the part takes the body as a
 * slot. Which fields are header and which are body is the mapping a site
 * writes once, and this is it.
 */
export function symbolProps(symbol: RefSymbol) {
  return {
    id: symbol.id,
    name: symbol.name,
    kind: symbol.kind,
    language: symbol.language,
    signature: symbol.signature,
    summary: symbol.summary,
    source: symbol.source,
    ...(symbol.since ? { since: symbol.since } : {}),
    ...(symbol.deprecated ? { deprecated: symbol.deprecated } : {}),
  };
}

/** The table rows a `RefParams` takes, derived from a symbol's parameters. */
export function paramRows(
  symbol: RefSymbol,
): { name: string; type?: string; default: string; description: string }[] {
  const direction = (param: RefParam): string =>
    param.direction ? `Required · ${param.direction}` : 'Required';
  return symbol.params.map((param) => ({
    name: param.name,
    ...(param.type ? { type: param.type } : {}),
    default: param.default ?? direction(param),
    description: param.description,
  }));
}

const profileModel: RefSymbol = {
  id: 'helia.profiler.profile_model',
  name: 'profile_model',
  kind: 'function',
  language: 'python',
  signature: `profile_model(
    model: str | Path,
    *,
    board: str,
    timeout_s: float = 30.0,
) -> ProfileResult`,
  summary:
    'Run a model on a connected target and return a typed collection of measurements.',
  description: '',
  params: [
    {
      name: 'model',
      type: 'str | Path',
      description: 'Path to the model artifact to profile.',
    },
    {
      name: 'board',
      type: 'str',
      description: 'Target board identifier used by the active probe.',
    },
    {
      name: 'timeout_s',
      type: 'float',
      default: '30.0',
      description: 'Maximum time to wait for the target to complete.',
    },
  ],
  returns: [
    {
      type: 'ProfileResult',
      description: 'Measurements plus target metadata.',
    },
  ],
  raises: [
    { type: 'ValueError', description: 'The board identifier is not known.' },
  ],
  examples: [],
  source: { path: 'src/helia/profiler.py', line: 48 },
  since: '0.8',
  members: [],
};

const profileModelC: RefSymbol = {
  id: 'profile_model',
  name: 'profile_model',
  kind: 'function',
  language: 'c',
  signature: `profile_status_t profile_model(
    const profile_config_t *config,
    profile_result_t *result
);`,
  summary:
    'Run the same operation with caller-owned configuration and result structures.',
  description: '',
  params: [
    {
      name: 'config',
      type: 'const profile_config_t *',
      direction: 'in',
      description: 'Profiling configuration. The caller retains ownership.',
    },
    {
      name: 'result',
      type: 'profile_result_t *',
      direction: 'out',
      description: 'Receives measurements and execution metadata.',
    },
  ],
  returns: [
    {
      type: 'profile_status_t',
      description: 'PROFILE_OK, or the reason the run did not complete.',
    },
  ],
  raises: [],
  examples: [],
  source: { path: 'include/profile.h', line: 112 },
  since: '0.8',
  members: [],
};

const profileModelTs: RefSymbol = {
  id: 'profileModel',
  name: 'profileModel',
  kind: 'function',
  language: 'typescript',
  signature: `function profileModel(
  model: string | URL,
  options: ProfileOptions,
): Promise<ProfileResult>`,
  summary: 'Run the same operation from the browser client against a gateway.',
  description: '',
  params: [
    {
      name: 'model',
      type: 'string | URL',
      description: 'Where the model artifact can be fetched from.',
    },
    {
      name: 'options',
      type: 'ProfileOptions',
      default: '{}',
      description: 'Board, measurements, and the gateway to dispatch to.',
    },
  ],
  returns: [
    {
      type: 'Promise<ProfileResult>',
      description: 'Resolves once the target reports a complete run.',
    },
  ],
  raises: [
    {
      type: 'RangeError',
      description: 'The timeout is not a positive number.',
    },
  ],
  examples: [],
  source: { path: 'src/client/profile.ts', line: 31 },
  members: [],
};

/** The three symbols the Reference section renders, in page order. */
export const REFERENCE_EXAMPLES = {
  python: profileModel,
  c: profileModelC,
  typescript: profileModelTs,
};

/** The module tree behind the `RefNav` example. */
export const REFERENCE_NAV = [
  {
    label: 'helia',
    href: '#reference',
    items: [
      { label: 'profiler', href: '#reference' },
      { label: 'runtime', href: '#reference' },
    ],
  },
];
