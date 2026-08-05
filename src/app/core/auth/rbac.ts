import { PermissionCode, StaffRoleCode } from '../models';

/**
 * UC-ADM-03 — rôles paramétrables, permissions granulaires par ressource et
 * action, principe du moindre privilège. This is the single source of truth
 * consumed by the permission guard, the `*appHasPermission` directive and the
 * role-permission matrix editor (so the editor and the enforcement share data).
 */
export const ALL_PERMISSIONS: PermissionCode[] = [
  'order.read', 'order.assign', 'order.reassign', 'order.cancel',
  'driver.read', 'driver.validate', 'driver.sanction', 'driver.write',
  'user.read', 'user.suspend', 'user.write',
  'role.read', 'role.write',
  'partner.validate',
  'tarif.read', 'tarif.modifier',
  'zone.read', 'zone.write',
  'finance.reconciliation.read', 'finance.reconciliation.write',
  'wallet.read', 'wallet.valider_retrait',
  'claim.read', 'claim.arbitrate', 'claim.write',
  'report.read', 'report.export',
  'settings.read', 'settings.write',
  'audit.read',
  'teleconseiller.order.create', 'teleconseiller.callback.write',
];

export const ROLE_PERMISSIONS: Record<StaffRoleCode, PermissionCode[]> = {
  ADMINISTRATEUR: [...ALL_PERMISSIONS],
  SUPERVISEUR: [
    'order.read', 'order.assign', 'order.reassign', 'order.cancel',
    'driver.read', 'driver.sanction',
    'user.read',
    'claim.read', 'claim.arbitrate', 'claim.write',
    'report.read',
    'zone.read', 'tarif.read',
    'wallet.read',
  ],
  FINANCE: [
    'order.read',
    'driver.read',
    'wallet.read', 'wallet.valider_retrait',
    'finance.reconciliation.read', 'finance.reconciliation.write',
    'claim.read',
    'report.read', 'report.export',
    'audit.read',
    'user.read',
  ],
  TELECONSEILLER: [
    'order.read', 'order.reassign',
    'teleconseiller.order.create', 'teleconseiller.callback.write',
    'claim.read', 'claim.write',
    'driver.read',
    'user.read',
  ],
};

export const ROLE_LABELS: Record<StaffRoleCode, string> = {
  ADMINISTRATEUR: 'Administrateur',
  SUPERVISEUR: 'Superviseur Opérations',
  FINANCE: 'Responsable Financier',
  TELECONSEILLER: 'Téléconseiller',
};

export function permissionsForRole(role: StaffRoleCode): PermissionCode[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(userPermissions: string[], required: PermissionCode | PermissionCode[]): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(userPermissions: string[], required: PermissionCode[]): boolean {
  return required.some((p) => userPermissions.includes(p));
}
