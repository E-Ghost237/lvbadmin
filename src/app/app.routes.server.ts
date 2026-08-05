import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * This is an authenticated back-office SPA — session state lives in
 * localStorage and every route can be dynamic (`/orders/:id`, etc.), so
 * server prerendering doesn't apply. Client rendering keeps the Express/SSR
 * scaffold available (useful later for a real backend-driven SSR need)
 * without trying to prerender pages that require an authenticated session.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
