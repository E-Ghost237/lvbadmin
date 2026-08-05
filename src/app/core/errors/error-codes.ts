/** Application error catalogue mirrored from CDC §9.1.2 (extended for admin-only cases). */
export interface ErrorCodeDef {
  http: number;
  fr: string;
  en: string;
}

export const ERROR_CODES: Record<string, ErrorCodeDef> = {
  'ERR-4001': { http: 400, fr: 'Requête malformée.', en: 'Malformed request.' },
  'ERR-4010': { http: 401, fr: 'Session expirée ou jeton invalide.', en: 'Session expired or invalid token.' },
  'ERR-4020': { http: 401, fr: 'Code de second facteur invalide.', en: 'Invalid second-factor code.' },
  'ERR-4031': { http: 403, fr: 'Ce compte est suspendu.', en: 'This account is suspended.' },
  'ERR-4032': { http: 403, fr: 'Permission insuffisante pour cette action.', en: 'Insufficient permission for this action.' },
  'ERR-4090': { http: 409, fr: 'Le devis a expiré.', en: 'Quote has expired.' },
  'ERR-4091': { http: 409, fr: 'Commande déjà affectée.', en: 'Order already assigned.' },
  'ERR-4092': { http: 409, fr: 'Immatriculation déjà utilisée.', en: 'Plate already registered.' },
  'ERR-4093': { http: 409, fr: 'Livreur non éligible.', en: 'Driver not eligible.' },
  'ERR-4104': { http: 410, fr: 'Code OTP expiré.', en: 'OTP code expired.' },
  'ERR-4220': { http: 422, fr: 'Transition d’état interdite.', en: 'Forbidden state transition.' },
  'ERR-4221': { http: 422, fr: 'Adresse hors zone de couverture.', en: 'Address outside coverage zone.' },
  'ERR-4222': { http: 422, fr: 'Retrait refusé : encours COD supérieur au solde disponible.', en: 'Withdrawal refused: COD balance exceeds available balance.' },
  'ERR-4232': { http: 423, fr: 'Plafond d’encours COD atteint.', en: 'COD balance cap reached.' },
  'ERR-4291': { http: 429, fr: 'Trop de tentatives. Réessayez plus tard.', en: 'Too many attempts. Try again later.' },
  'ERR-5031': { http: 503, fr: 'Prestataire de paiement indisponible.', en: 'Payment provider unavailable.' },
  'ERR-5032': { http: 503, fr: 'Service de cartographie indisponible.', en: 'Mapping service unavailable.' },
  'ERR-5000': { http: 500, fr: 'Une erreur inattendue est survenue.', en: 'An unexpected error occurred.' },
};

export function describeError(code: string, locale: 'fr' | 'en' = 'fr'): string {
  const def = ERROR_CODES[code];
  if (!def) return locale === 'fr' ? 'Erreur inconnue.' : 'Unknown error.';
  return locale === 'fr' ? def.fr : def.en;
}
