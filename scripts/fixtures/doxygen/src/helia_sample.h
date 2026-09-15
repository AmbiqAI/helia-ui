/* SPDX-License-Identifier: BSD-3-Clause */
/* Copyright (c) 2026, Ambiq */
/**
 * @file helia_sample.h
 * @brief A miniature HELIA runtime header.
 *
 * The fixture the Doxygen extractor is tested against. It is deliberately
 * small and deliberately complete: one struct, one enum, one typedef, one
 * macro and two functions, one of which writes through an out-parameter.
 */

#ifndef HELIA_SAMPLE_H
#define HELIA_SAMPLE_H

#include <stddef.h>

/**
 * @brief Largest model name the runtime will accept, in bytes.
 *
 * Fixed rather than allocated so that a name fits in the descriptor and the
 * descriptor fits in TCM.
 */
#define HELIA_MAX_NAME 32

/** @brief Opaque handle to a loaded model. */
typedef struct helia_model helia_model_t;

/**
 * @brief What a runtime call reports back.
 * @since 0.2
 */
typedef enum
{
    HELIA_OK = 0,        /**< The call succeeded. */
    HELIA_ERR_ARG = 1,   /**< A pointer argument was null or a size was zero. */
    HELIA_ERR_MEMORY = 2 /**< The arena could not satisfy the allocation. */
} helia_status_t;

/**
 * @brief Where a model puts its working memory.
 *
 * The caller owns the arena. The runtime never allocates.
 */
typedef struct
{
    void *arena;        /**< Base of the scratch arena. */
    size_t arena_bytes; /**< Size of the arena, in bytes. */
    char name[HELIA_MAX_NAME];
} helia_config_t;

/**
 * @brief Load a model into the caller's arena.
 *
 * The arena must outlive the handle. Nothing is copied out of @p config, so
 * it may live on the stack.
 *
 * @param[in] config Arena and name for the model.
 * @param[out] model Receives the handle on success, untouched on failure.
 * @return ::HELIA_OK, or ::HELIA_ERR_MEMORY when the arena is too small.
 * @since 0.2
 *
 * @code
 * helia_config_t config = { .arena = buffer, .arena_bytes = sizeof(buffer) };
 * helia_model_t *model;
 * if (helia_model_load(&config, &model) != HELIA_OK) return -1;
 * @endcode
 */
helia_status_t helia_model_load(const helia_config_t *config,
                                helia_model_t **model);

/**
 * @brief Run one inference pass.
 *
 * @param[in]     model   A handle from helia_model_load().
 * @param[in]     input   Input tensor, in the model's declared layout.
 * @param[in,out] scratch Scratch block, resized to what the pass needed.
 * @param[out]    output  Receives the output tensor.
 * @return ::HELIA_OK on success.
 * @deprecated Use helia_model_invoke() instead; this entry point ignores
 * the model's quantization parameters.
 */
helia_status_t helia_model_run(helia_model_t *model, const float *input,
                               size_t *scratch, float *output);

#endif /* HELIA_SAMPLE_H */
