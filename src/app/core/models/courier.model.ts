/** `POST /v1/admin/drivers` and `POST /v1/partner/couriers` — same body; `password`/`roles`/`statut` are prohibited by the backend. */
export interface CreateCourierRequest {
  telephone: string;
  email: string;
  nom: string;
  prenom?: string | null;
  langue?: 'fr' | 'en';
}

/** Courier (livreur) account as returned by the courier endpoints — never contains secrets. */
export interface CourierAccount {
  uuid: string;
  telephone: string;
  email: string | null;
  nom: string;
  prenom: string | null;
  langue: string;
  photo_url: string | null;
  statut: string;
  statut_operationnel: string;
  matricule: string;
  role: 'LIVREUR';
  roles: string[];
  origine: 'LVB' | 'PARTENAIRE';
}
