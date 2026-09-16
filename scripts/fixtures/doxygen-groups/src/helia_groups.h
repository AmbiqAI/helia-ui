/* SPDX-License-Identifier: BSD-3-Clause */
/* Copyright (c) 2026, Ambiq */
/**
 * @file helia_groups.h
 * @brief Grouped kernels, named the way a C library names them.
 *
 * The fixture behind the route-casing and description-fallback assertions. One
 * group is named in mixed case, so its page proves the generator spells a
 * route the way Starlight serves it. The other carries no brief, so its page
 * proves the generator still emits a description.
 */

#ifndef HELIA_GROUPS_H
#define HELIA_GROUPS_H

#include <stddef.h>

/**
 * @defgroup NNConv Convolution
 * @brief Convolution kernels.
 * @{
 */

/**
 * @brief Convolve one input tensor.
 *
 * @param[in]  input  Input tensor.
 * @param[out] output Receives the convolved tensor.
 * @return 0 on success.
 */
int arm_nn_conv_s8(const signed char *input, signed char *output);

/** @} */

/**
 * @defgroup Gather Gather
 * @{
 */

/**
 * @brief Gather rows named by an index tensor.
 *
 * @param[in]  input  Input tensor.
 * @param[in]  index  Row indices.
 * @param[out] output Receives the gathered rows.
 * @return 0 on success.
 */
int arm_nn_gather_s8(const signed char *input, const int *index,
                     signed char *output);

/** @} */

#endif /* HELIA_GROUPS_H */
