/**
 * Application error catalogue — every `ERR-xxxx` the backend registers
 * (see `app/Support/Errors/ErrorCatalog.php` and each module's service
 * provider in lvbapi), with a user-facing message in French and English.
 *
 * Messages tell the user what happened and what to do next, not the
 * internal rule name. When the backend attaches its own French `detail` at
 * the throw site it is usually more specific than these defaults —
 * `problem-message.ts` decides which one to show.
 */
export interface ErrorCodeDef {
  http: number;
  fr: string;
  en: string;
}

const e = (http: number, fr: string, en: string): ErrorCodeDef => ({ http, fr, en });

export const ERROR_CODES: Record<string, ErrorCodeDef> = {
  // --- Generic / core ---------------------------------------------------
  'ERR-4001': e(400, 'Certaines informations sont invalides ou manquantes.', 'Some information is invalid or missing.'),
  'ERR-4010': e(401, 'Votre session a expiré. Reconnectez-vous.', 'Your session has expired. Please sign in again.'),
  'ERR-4011': e(401, 'Email ou mot de passe incorrect.', 'Incorrect email or password.'),
  'ERR-4012': e(401, 'Signature de notification de paiement invalide.', 'Invalid payment notification signature.'),
  'ERR-4020': e(401, 'Code de vérification invalide.', 'Invalid verification code.'),
  'ERR-4031': e(403, 'Ce compte est suspendu ou indisponible. Contactez le support.', 'This account is suspended or unavailable. Contact support.'),
  'ERR-4032': e(403, 'Vous n’avez pas la permission d’effectuer cette action.', 'You do not have permission to perform this action.'),
  'ERR-4033': e(403, 'Ce compte est en attente de validation.', 'This account is awaiting validation.'),
  'ERR-4034': e(403, 'Fonction réservée aux partenaires validés, ou plafond d’encours dépassé.', 'Feature reserved for validated partners, or credit limit exceeded.'),
  'ERR-4038': e(403, 'Accès partenaire refusé : votre compte n’est rattaché à aucune organisation partenaire active, ou votre rôle ne permet pas cette action.', 'Partner access denied: your account is not linked to an active partner organisation, or your role does not allow this action.'),
  'ERR-4040': e(404, 'Élément introuvable — ou fonctionnalité non activée sur cet environnement.', 'Item not found — or this feature is not enabled on this environment.'),
  'ERR-4090': e(409, 'Le devis a expiré. Refaites une simulation.', 'The quote has expired. Please request a new one.'),
  'ERR-4091': e(409, 'Opération en conflit : elle a déjà été traitée ou modifiée entre-temps. Actualisez puis réessayez.', 'Conflicting operation: it was already processed or changed in the meantime. Refresh and try again.'),
  'ERR-4092': e(409, 'Cette immatriculation est déjà utilisée par un autre livreur.', 'This licence plate is already used by another driver.'),
  'ERR-4093': e(409, 'Ce livreur n’est pas éligible à cette affectation.', 'This driver is not eligible for this assignment.'),
  'ERR-4094': e(423, 'Ce numéro de téléphone est déjà associé à un compte.', 'This phone number is already linked to an account.'),
  'ERR-4095': e(400, 'Vous devez accepter les conditions générales et la politique de confidentialité.', 'You must accept the terms of use and the privacy policy.'),
  'ERR-4096': e(409, 'Ce devis a déjà été confirmé.', 'This quote has already been confirmed.'),
  'ERR-4097': e(409, 'Action impossible dans l’état actuel de cet élément. Actualisez la page puis réessayez.', 'This action is not possible in the item’s current state. Refresh the page and try again.'),
  'ERR-4098': e(409, 'Preuve de livraison indisponible.', 'Proof of delivery unavailable.'),
  'ERR-4099': e(400, 'Aucune adresse email n’est associée à ce compte : impossible d’envoyer le code.', 'No email address is linked to this account: the code cannot be sent.'),
  'ERR-4104': e(410, 'Code expiré, déjà utilisé ou introuvable. Demandez un nouveau code.', 'Code expired, already used or not found. Request a new code.'),
  'ERR-4105': e(410, 'Ce lien d’export a expiré. Relancez l’export.', 'This export link has expired. Run the export again.'),

  // --- Ordering / fulfilment / support ---------------------------------------
  'ERR-4220': e(422, 'Changement d’état interdit pour cet élément.', 'This state change is not allowed for this item.'),
  'ERR-4221': e(422, 'Adresse hors zone de couverture.', 'Address outside the coverage zone.'),
  'ERR-4222': e(422, 'Fichier d’import invalide (1 à 200 lignes, colonnes attendues, cellules texte ou nombre).', 'Invalid import file (1–200 rows, expected columns, text or number cells).'),
  'ERR-4223': e(422, 'Pièce jointe refusée (fichier malveillant ou type interdit).', 'Attachment rejected (malicious or forbidden file type).'),
  'ERR-4224': e(422, 'Cette notification critique ne peut pas être désactivée.', 'This critical notification cannot be turned off.'),
  'ERR-4225': e(422, 'Configuration de notification invalide (modèles FR et EN actifs avec les mêmes variables).', 'Invalid notification setup (active FR and EN templates with the same variables).'),
  'ERR-4226': e(422, 'Télémétrie mobile invalide.', 'Invalid mobile telemetry.'),
  'ERR-4227': e(422, 'Lot ou horodatage de positions GPS invalide.', 'Invalid GPS batch or timestamp.'),
  'ERR-4228': e(422, 'Configuration de rôle invalide (nom de 3 à 50 caractères A-Z, 0-9 ou _ ; un utilisateur interne garde au moins un rôle).', 'Invalid role setup (3–50 characters A-Z, 0-9 or _; an internal user keeps at least one role).'),
  'ERR-4229': e(422, 'Dossier partenaire invalide ou incomplet (compte client Entreprise requis, pièces ou informations manquantes).', 'Invalid or incomplete partner file (Enterprise client account required, missing documents or details).'),
  'ERR-4232': e(423, 'Plafond d’encours COD atteint.', 'COD outstanding ceiling reached.'),
  'ERR-4233': e(423, 'Compte temporairement bloqué suite à des annulations répétées.', 'Account temporarily blocked after repeated cancellations.'),
  'ERR-4234': e(403, 'Geste commercial supérieur au plafond autorisé.', 'Goodwill gesture above the allowed limit.'),
  'ERR-4235': e(403, 'Document expiré : mettez-le à jour avant de continuer.', 'Expired document: update it before continuing.'),
  'ERR-4236': e(400, 'Position GPS trop imprécise.', 'GPS position not accurate enough.'),
  'ERR-4237': e(409, 'Impossible pendant une mission en cours.', 'Not possible during an ongoing mission.'),
  'ERR-4238': e(422, 'Code de livraison invalide.', 'Invalid delivery code.'),
  'ERR-4239': e(423, 'Montant COD incomplet.', 'COD amount incomplete.'),
  'ERR-4240': e(422, 'La signature du destinataire est obligatoire.', 'The recipient’s signature is required.'),
  'ERR-4241': e(422, 'Position rejetée (fournisseur de position fictif détecté).', 'Position rejected (mock location provider detected).'),
  'ERR-4250': e(403, 'Un compte livreur actif est requis.', 'An active driver account is required.'),
  'ERR-4251': e(409, 'Capture GPS déjà enregistrée avec des données différentes.', 'GPS capture already recorded with different data.'),
  'ERR-4253': e(503, 'Calcul d’itinéraire indisponible pour le moment.', 'Route calculation temporarily unavailable.'),
  'ERR-4291': e(429, 'Trop de tentatives. Patientez quelques instants avant de réessayer.', 'Too many attempts. Please wait a moment before trying again.'),
  'ERR-4292': e(429, 'Envoi trop rapproché. Patientez 60 secondes avant de redemander un code.', 'Sent too soon. Wait 60 seconds before requesting another code.'),
  'ERR-4622': e(409, 'Le remboursement dépasserait la transaction d’origine.', 'The refund would exceed the original transaction.'),
  'ERR-4623': e(422, 'Retrait non éligible.', 'Withdrawal not eligible.'),
  'ERR-4624': e(422, 'Le montant reversé dépasse l’encours COD.', 'The remitted amount exceeds the COD outstanding.'),

  // --- Marketplace / payments / rental / booking / wallet -----------------------
  'ERR-4700': e(404, 'Offre ou catégorie introuvable.', 'Offer or category not found.'),
  'ERR-4701': e(409, 'Action de publication impossible (offre archivée ou suspendue, ou catégorie et tarif actifs requis).', 'Publication action not possible (offer archived or suspended, or an active category and rate plan are required).'),
  'ERR-4702': e(422, 'Catalogue invalide : catégorie inactive ou inconnue, ou une offre de location doit cibler un véhicule ou une catégorie de véhicule.', 'Invalid catalogue: inactive or unknown category, or a rental offer must target a vehicle or vehicle category.'),
  'ERR-4710': e(409, 'Conflit de paiement ou de remboursement (clé déjà utilisée, montant supérieur au paiement…).', 'Payment or refund conflict (key already used, amount above the payment…).'),
  'ERR-4711': e(422, 'Paiement de réservation invalide.', 'Invalid booking payment.'),
  'ERR-4712': e(404, 'Paiement de réservation introuvable.', 'Booking payment not found.'),
  'ERR-4720': e(404, 'Véhicule, chauffeur, tarif ou document introuvable.', 'Vehicle, driver, rate plan or document not found.'),
  'ERR-4721': e(409, 'Ressource indisponible ou déjà utilisée (immatriculation, téléphone ou email déjà associé à un compte, période bloquée…).', 'Resource unavailable or already used (plate, phone or email already linked to an account, blocked period…).'),
  'ERR-4722': e(422, 'Paramètres de location invalides (période, fichier, informations du chauffeur…).', 'Invalid rental parameters (period, file, driver details…).'),
  'ERR-4730': e(404, 'Réservation ou devis introuvable.', 'Booking or quote not found.'),
  'ERR-4731': e(409, 'Ressource déjà occupée ou réservation en conflit.', 'Resource already taken or booking conflict.'),
  'ERR-4732': e(422, 'Réservation ou changement d’état invalide.', 'Invalid booking or state change.'),
  'ERR-4733': e(409, 'Le devis de location a expiré.', 'The rental quote has expired.'),
  'ERR-4740': e(404, 'Ressource financière introuvable.', 'Financial resource not found.'),
  'ERR-4741': e(409, 'Conflit sur une opération financière (déjà enregistrée avec un autre montant, clé déjà utilisée…).', 'Financial operation conflict (already recorded with another amount, key already used…).'),
  'ERR-4742': e(422, 'Montant ou opération financière invalide.', 'Invalid financial amount or operation.'),
  'ERR-4743': e(403, 'Opération financière non autorisée : double contrôle requis (le vérificateur ou l’approbateur doit être différent du demandeur), compte de paiement vérifié requis, ou solde bloqué.', 'Financial operation not allowed: dual control required (the verifier or approver must differ from the requester), a verified payout account is required, or funds are blocked.'),

  // --- Infrastructure -------------------------------------------------------
  'ERR-5000': e(500, 'Une erreur inattendue est survenue. Réessayez ; si le problème persiste, communiquez la référence au support.', 'An unexpected error occurred. Try again; if it persists, give the reference to support.'),
  'ERR-5031': e(503, 'Prestataire de paiement indisponible. Réessayez dans quelques instants.', 'Payment provider unavailable. Try again shortly.'),
  'ERR-5032': e(503, 'Service de cartographie indisponible.', 'Mapping service unavailable.'),
  'ERR-5033': e(503, 'Service antivirus indisponible : le fichier n’a pas pu être contrôlé.', 'Antivirus service unavailable: the file could not be scanned.'),
  'ERR-5034': e(503, 'L’envoi d’email est indisponible pour le moment. Réessayez dans quelques instants.', 'Email delivery is unavailable right now. Try again shortly.'),
  'ERR-5035': e(503, 'Stockage des documents indisponible.', 'Document storage unavailable.'),
  'ERR-5710': e(503, 'Prestataire de paiement de location indisponible.', 'Rental payment provider unavailable.'),
};

export function describeError(code: string, locale: 'fr' | 'en' = 'fr'): string {
  const def = ERROR_CODES[code];
  if (!def) return locale === 'fr' ? 'Erreur inconnue.' : 'Unknown error.';
  return locale === 'fr' ? def.fr : def.en;
}
