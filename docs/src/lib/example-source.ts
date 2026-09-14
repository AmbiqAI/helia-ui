// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * Source handling for the gallery's worked examples.
 *
 * Nothing in Astro hands a component the MDX of its own slot, so an example
 * carries its source as a string. `Example.astro` renders that one string both
 * into the disclosure and into the tag list the docs suite reads back, which is
 * the drift the preview and the source would otherwise be free to develop.
 */

/**
 * Removes the indentation a template literal inherits from its call site, so an
 * example's source can be written at the depth it sits at in the MDX and still
 * render flush left. Leading and trailing blank lines go with it.
 */
export function dedent(source: string): string {
  const lines = source.replace(/\t/g, '  ').split('\n');
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;

  return lines.map((line) => line.slice(indent)).join('\n');
}

/**
 * The component tags the source opens, deduplicated and in document order. A
 * capital initial is what separates a part from an HTML element in MDX.
 */
export function exampleTags(source: string): string[] {
  const names = [...source.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map(
    (match) => match[1],
  );
  return [...new Set(names)];
}
