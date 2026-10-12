/**
 * Development build of `environment` — swapped in for `environment.ts` by the
 * `development` configuration of both apps (see `fileReplacements` in
 * angular.json). Keeps the API relative so the browser only ever talks to the
 * dev-server origin: `/v1` is proxied (see `proxy.dev.json`) to the local
 * mock (`tools/mock-api.mjs`) or to any tunnel you point the proxy at.
 *
 * Production is untouched: `ng build` uses `environment.ts` and its absolute
 * backend URL.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/v1',
};
