import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionCode } from '../models';
import { AuthService } from './auth.service';

/**
 * UC-ADM-03 acceptance criterion: "Un utilisateur sans la permission
 * order.cancel reçoit un 403 même en appelant l'API directement." — the same
 * check is enforced here at the route level so a direct URL visit is refused
 * exactly like a direct API call would be, never relying on hidden UI alone.
 */
export function permissionGuard(required: PermissionCode | PermissionCode[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    if (auth.hasPermission(required)) return true;
    return router.createUrlTree(['/403']);
  };
}
