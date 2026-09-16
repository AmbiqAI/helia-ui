// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * A hand-written reference model, a group config and a manifest overlay, for
 * the symbol index on the Data display page.
 *
 * The index is the one part whose behavior only shows up at scale: a search
 * box over four rows proves nothing. So the model here is a kernel library in
 * miniature -- several families, the data type in the name, two headers, and
 * two symbols the overlay covers -- which is enough to exercise every control
 * the part renders and small enough to read.
 *
 * Every name, signature and sentence is invented. A published HELIA reference
 * is generated from source by an extractor and is the only place an API
 * contract is stated.
 */
import type {
  ReferenceModel,
  RefSymbol,
} from '@ambiqai/helia-ui/reference-model';
import type {
  RefIndexGroup,
  RefIndexOverlay,
} from '@ambiqai/helia-ui/ref-index-model';

const kernel = (
  name: string,
  summary: string,
  header = 'nn_functions.h',
): RefSymbol => ({
  id: name,
  name,
  kind: 'function',
  language: 'c',
  signature: `status_t ${name}(const ctx_t *ctx, const dims_t *dims, void *out);`,
  summary,
  description: '',
  params: [],
  returns: [],
  raises: [],
  examples: [],
  source: { path: `Include/${header}`, line: 1 },
  members: [],
});

/** The families, in the order the index offers them. */
export const INDEX_GROUPS: RefIndexGroup[] = [
  {
    id: 'convolution',
    label: 'Convolution',
    patterns: ['^ex_convolve', '^ex_depthwise'],
  },
  { id: 'activation', label: 'Activation', patterns: ['^ex_relu', '^ex_tanh'] },
  {
    id: 'pooling',
    label: 'Pooling',
    patterns: ['^ex_avgpool', '^ex_maxpool'],
  },
];

/**
 * The manifest the index reads when a product repository publishes one.
 *
 * Two symbols out of fourteen, on purpose: a row with contract fields opens,
 * a row without them has no control to open, and both shapes are on the page.
 */
export const INDEX_OVERLAY: RefIndexOverlay = {
  symbols: {
    ex_convolve_s8: {
      facets: { paths: ['helium', 'dsp', 'scalar'] },
      prerequisites: [
        'Size the scratch buffer with ex_convolve_s8_get_buffer_size.',
        'Pass an input aligned to four bytes.',
      ],
      bufferSize: 'ex_convolve_s8_get_buffer_size(dims)',
      tolerances: 'Bit-exact against the scalar path.',
    },
    ex_convolve_f16: {
      facets: { paths: ['helium', 'scalar'] },
      bufferSize: 'ex_convolve_f16_get_buffer_size(dims)',
      notes: 'Falls back to the scalar path where half precision is absent.',
    },
  },
};

export const INDEX_MODEL: ReferenceModel = {
  name: 'exampleNN',
  language: 'c',
  modules: [
    {
      path: 'exampleNN',
      name: 'exampleNN',
      summary: 'An invented kernel library.',
      description: '',
      submodules: [],
      symbols: [
        kernel('ex_convolve_s8', 'Quantized 2D convolution.'),
        kernel('ex_convolve_s16', 'Wide quantized 2D convolution.'),
        kernel('ex_convolve_f16', 'Half precision 2D convolution.'),
        kernel('ex_convolve_f32', 'Single precision 2D convolution.'),
        kernel('ex_depthwise_s8', 'Quantized depthwise convolution.'),
        kernel('ex_depthwise_s4', 'Four-bit depthwise convolution.'),
        kernel('ex_relu_s8', 'Rectified linear unit.'),
        kernel('ex_relu_f32', 'Rectified linear unit, single precision.'),
        kernel('ex_tanh_s16', 'Hyperbolic tangent.'),
        kernel('ex_avgpool_s8', 'Average pooling.'),
        kernel('ex_maxpool_s8', 'Max pooling.'),
        kernel('ex_softmax_s8', 'Softmax over the last axis.', 'nn_support.h'),
        kernel('ex_quantize_f32', 'Float to fixed point.', 'nn_support.h'),
        kernel('ex_dequantize_s8', 'Fixed point to float.', 'nn_support.h'),
      ],
    },
  ],
};
