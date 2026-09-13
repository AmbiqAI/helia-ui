declare module 'virtual:helia-ui/starlight-config' {
  const config: import('./index').HeliaStarlightConfig;
  export default config;
}

/*
 * Starlight builds a `virtual:starlight/components/*` module for every
 * overridable component and its own templates import them, which is how an
 * override reaches a component it did not render itself. The declarations live
 * in a file Starlight does not list in its exports, so a consumer outside the
 * package cannot reference them; restating the three the Footer needs against
 * the public component paths keeps the import typed without reaching into
 * node_modules by path.
 */
declare module 'virtual:starlight/components/EditLink' {
  const EditLink: typeof import('@astrojs/starlight/components/EditLink.astro').default;
  export default EditLink;
}

declare module 'virtual:starlight/components/LastUpdated' {
  const LastUpdated: typeof import('@astrojs/starlight/components/LastUpdated.astro').default;
  export default LastUpdated;
}

declare module 'virtual:starlight/components/Pagination' {
  const Pagination: typeof import('@astrojs/starlight/components/Pagination.astro').default;
  export default Pagination;
}
