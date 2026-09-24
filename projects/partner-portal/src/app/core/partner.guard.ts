import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PartnerContextService } from './services/partner-context.service';

/**
 * Keeps a route to the users who can actually use it. A partner that is not
 * ACTIF yet (or a signed-in account that belongs to no partner) is sent to the
 * onboarding screen; an ACTIF partner whose role can't use the section goes
 * back to the dashboard. The API still answers 403 regardless of this guard.
 */
export const partnerGuard = (permission: string): CanActivateFn => async () => {
  const ctx = inject(PartnerContextService);
  const router = inject(Router);
  await ctx.ensureLoaded();
  if (ctx.can(permission)) return true;
  return router.createUrlTree([ctx.isActive() ? '/dashboard' : '/onboarding']);
};
