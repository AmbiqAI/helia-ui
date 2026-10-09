// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq

export function regularTitlePrefix(
  title: string,
  configuredPrefix?: string,
): string {
  const prefix =
    configuredPrefix ?? (/^helia(?=[A-Z])/.test(title) ? 'helia' : '');
  if (prefix && (!title.startsWith(prefix) || prefix.length === title.length)) {
    throw new Error(
      'header.titleRegularPrefix must be a proper prefix of header.title',
    );
  }
  return prefix;
}
