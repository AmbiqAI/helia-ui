// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq

/**
 * 'error' is kept apart from 'disconnected' because a failed chooser and a
 * clean stop look the same to the transport but not to the person watching.
 */
export type ConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'error';
