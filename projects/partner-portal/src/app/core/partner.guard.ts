import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '@lvb/ui/toast/toast.service';
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
  const toast = inject(ToastService);
  await ctx.ensureLoaded();
  if (ctx.can(permission)) return true;
  // Never redirect silently: tell the user why the page did not open.
  toast.warning('Accès non disponible', ctx.isActive() ? 'Votre rôle ne permet pas d’ouvrir cette page.' : 'Cette section s’ouvre lorsque votre compte partenaire est actif.');
  return router.createUrlTree([ctx.isActive() ? '/dashboard' : '/onboarding']);
};
