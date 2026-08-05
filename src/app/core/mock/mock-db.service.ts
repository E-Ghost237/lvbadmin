import { Injectable, computed, signal } from '@angular/core';
import {
  AlertKind, AppNotification, AuditLogEntry, Callback, Claim, ClaimMessage, ClientUser, Driver,
  DriverKycDossier, DriverSanction, KycPiece, KycPieceType, Order, OrderHistoryEntry, ParcelType,
  PricingGrid, PromoCode, ProofOfDelivery, ReconciliationGap, ReconciliationPeriod, Role, Session,
  StaffUser, SupervisionAlert, SystemParameter, Transaction, UserActionLogEntry, WalletMovement,
  WithdrawalRequest, Zone, ACTIVE_ORDER_STATUSES, OrderStatus,
} from '../models';
import {
  CM_LAST_NAMES, DOUALA_QUARTIERS, YAOUNDE_QUARTIERS, createRng, fullName, isoAfter, isoDaysAgo, isoInMinutes,
  isoMinutesAgo, pick, pickMany, randomInt, randomPhone, uid,
} from './mock-utils';
import { computeQuote } from '../utils/pricing-engine';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../auth/rbac';

export interface MockState {
  version: number;
  staff: StaffUser[];
  clients: ClientUser[];
  drivers: Driver[];
  kycDossiers: DriverKycDossier[];
  sanctions: DriverSanction[];
  orders: Order[];
  transactions: Transaction[];
  walletMovements: WalletMovement[];
  withdrawals: WithdrawalRequest[];
  reconciliationPeriods: ReconciliationPeriod[];
  zones: Zone[];
  pricingGrids: PricingGrid[];
  promoCodes: PromoCode[];
  claims: Claim[];
  claimMessages: ClaimMessage[];
  auditLog: AuditLogEntry[];
  systemParameters: SystemParameter[];
  notifications: AppNotification[];
  sessions: Session[];
  userActionLog: UserActionLogEntry[];
  callbacks: Callback[];
  roles: Role[];
  acknowledgedAlerts: Record<string, { par: string; motif: string; le: string }>;
}

const STORAGE_KEY = 'lvb.mockdb.v1';
const SEED_VERSION = 9;

/**
 * Single in-memory (localStorage-persisted) source of truth for every mock
 * domain service. Standing in for the real PostgreSQL-backed API of §7 until
 * the backend is ready — every field name below matches the CDC dictionary
 * so the eventual `Http*Service` swap only changes the transport, not the
 * shape consumed by components.
 */
@Injectable({ providedIn: 'root' })
export class MockDbService {
  private readonly state = signal<MockState>(this.loadOrSeed());

  readonly staff = computed(() => this.state().staff);
  readonly clients = computed(() => this.state().clients);
  readonly drivers = computed(() => this.state().drivers);
  readonly kycDossiers = computed(() => this.state().kycDossiers);
  readonly sanctions = computed(() => this.state().sanctions);
  readonly orders = computed(() => this.state().orders);
  readonly transactions = computed(() => this.state().transactions);
  readonly walletMovements = computed(() => this.state().walletMovements);
  readonly withdrawals = computed(() => this.state().withdrawals);
  readonly reconciliationPeriods = computed(() => this.state().reconciliationPeriods);
  readonly zones = computed(() => this.state().zones);
  readonly pricingGrids = computed(() => this.state().pricingGrids);
  readonly promoCodes = computed(() => this.state().promoCodes);
  readonly claims = computed(() => this.state().claims);
  readonly claimMessages = computed(() => this.state().claimMessages);
  readonly auditLog = computed(() => this.state().auditLog);
  readonly systemParameters = computed(() => this.state().systemParameters);
  readonly notifications = computed(() => this.state().notifications);
  readonly sessions = computed(() => this.state().sessions);
  readonly callbacks = computed(() => this.state().callbacks);
  readonly roles = computed(() => this.state().roles);

  readonly alerts = computed<SupervisionAlert[]>(() => this.deriveAlerts());

  /** Generic transactional mutator: every mock service writes through here so persistence stays consistent. */
  mutate(fn: (draft: MockState) => MockState): void {
    const next = fn(structuredClone(this.state()));
    this.state.set(next);
    this.persist(next);
  }

  snapshot(): MockState {
    return this.state();
  }

  logAudit(entry: Omit<AuditLogEntry, 'id' | 'cree_le'>): void {
    this.mutate((s) => {
      s.auditLog.unshift({ ...entry, id: uid('aud', Math.random), cree_le: new Date().toISOString() });
      return s;
    });
  }

  resetDemoData(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    this.state.set(this.seed());
  }

  private persist(state: MockState): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — demo continues in-memory only */
    }
  }

  private loadOrSeed(): MockState {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as MockState;
          if (parsed.version === SEED_VERSION) return parsed;
        } catch {
          /* fall through to reseed */
        }
      }
    }
    const seeded = this.seed();
    this.persist(seeded);
    return seeded;
  }

  // ---------------------------------------------------------------------
  // Seeding
  // ---------------------------------------------------------------------

  private deriveAlerts(): SupervisionAlert[] {
    const { orders, drivers, claims, acknowledgedAlerts } = this.state();
    const alerts: SupervisionAlert[] = [];
    const now = Date.now();

    for (const o of orders) {
      if (o.statut === 'EN_ATTENTE_AFFECTATION' || o.statut === 'EN_ATTENTE_MANUELLE') {
        const minutesSince = (now - new Date(o.confirmee_le ?? o.cree_le).getTime()) / 60_000;
        if (minutesSince > 5) {
          alerts.push(this.buildAlert('SANS_AFFECTATION', o.statut === 'EN_ATTENTE_MANUELLE' ? 'CRITIQUE' : 'AVERTISSEMENT',
            `Commande ${o.numero} sans affectation`,
            `Aucun livreur affecté depuis ${Math.round(minutesSince)} min.`, o, acknowledgedAlerts));
        }
      }
      if (ACTIVE_ORDER_STATUSES.includes(o.statut) && new Date(o.echeance_promise).getTime() < now) {
        alerts.push(this.buildAlert('RETARD_SLA', 'CRITIQUE',
          `Commande ${o.numero} en retard`,
          `Échéance promise dépassée le ${new Date(o.echeance_promise).toLocaleString('fr-FR')}.`, o, acknowledgedAlerts));
      }
      if (o.statut === 'EN_ATTENTE_PAIEMENT') {
        const minutesSince = (now - new Date(o.cree_le).getTime()) / 60_000;
        if (minutesSince > 10) {
          alerts.push(this.buildAlert('PAIEMENT_EN_ATTENTE', 'AVERTISSEMENT',
            `Paiement en attente — ${o.numero}`,
            `Transaction non confirmée depuis ${Math.round(minutesSince)} min.`, o, acknowledgedAlerts));
        }
      }
      // RG-060 — écart de proximité au ramassage ou à la livraison (> 150 m).
      for (const pod of o.preuves) {
        if (pod.distance_point_reference_m > 150) {
          const id = `ecart-${o.id}-${pod.type}`;
          const ack = acknowledgedAlerts[id];
          alerts.push({
            id, type: 'ECART_PROXIMITE', gravite: 'AVERTISSEMENT',
            titre: `Écart de proximité — ${o.numero}`,
            detail: `${pod.type === 'RAMASSAGE' ? 'Ramassage' : 'Livraison'} validé(e) à ${pod.distance_point_reference_m} m du point de référence (seuil 150 m).`,
            commande_id: o.id, commande_numero: o.numero, livreur_id: o.livreur_id, livreur_nom: o.livreur_nom,
            cree_le: pod.capture_le, acquittee: !!ack, acquittee_par: ack?.par, acquittee_motif: ack?.motif, acquittee_le: ack?.le,
          });
        }
      }
    }

    // Incidents critiques ouverts — proxy via les réclamations de gravité CRITIQUE non closes.
    for (const c of claims.filter((cl) => cl.gravite === 'CRITIQUE' && cl.statut !== 'RESOLUE' && cl.statut !== 'FERMEE')) {
      const id = `incident-${c.id}`;
      const ack = acknowledgedAlerts[id];
      alerts.push({
        id, type: 'INCIDENT_CRITIQUE', gravite: 'CRITIQUE',
        titre: `Réclamation critique — ${c.numero}`,
        detail: `Commande ${c.commande_numero} — ${c.categorie.toLowerCase()}, ouverte par ${c.ouverte_par_nom}.`,
        commande_id: c.commande_id, commande_numero: c.commande_numero,
        cree_le: c.cree_le, acquittee: !!ack, acquittee_par: ack?.par, acquittee_motif: ack?.motif, acquittee_le: ack?.le,
      });
    }

    for (const d of drivers) {
      if (d.statut === 'ACTIF' && d.encours_cod >= d.plafond_cod * 0.9) {
        const id = `plafond-${d.id}`;
        const ack = acknowledgedAlerts[id];
        alerts.push({
          id, type: 'PLAFOND_COD', gravite: d.encours_cod >= d.plafond_cod ? 'CRITIQUE' : 'AVERTISSEMENT',
          titre: `${d.prenom} ${d.nom} proche du plafond COD`,
          detail: `Encours ${d.encours_cod.toLocaleString('fr-FR')} XAF / plafond ${d.plafond_cod.toLocaleString('fr-FR')} XAF.`,
          livreur_id: d.id, livreur_nom: `${d.prenom} ${d.nom}`,
          cree_le: d.modifie_le ?? d.cree_le, acquittee: !!ack,
          acquittee_par: ack?.par, acquittee_motif: ack?.motif, acquittee_le: ack?.le,
        });
      }
    }

    return alerts.sort((a, b) => (a.acquittee === b.acquittee ? 0 : a.acquittee ? 1 : -1));
  }

  private buildAlert(
    type: AlertKind, gravite: SupervisionAlert['gravite'], titre: string, detail: string,
    order: Order, acknowledged: MockState['acknowledgedAlerts'],
  ): SupervisionAlert {
    const id = `${type}-${order.id}`;
    const ack = acknowledged[id];
    return {
      id, type, gravite, titre, detail,
      commande_id: order.id, commande_numero: order.numero,
      livreur_id: order.livreur_id, livreur_nom: order.livreur_nom,
      cree_le: order.confirmee_le ?? order.cree_le,
      acquittee: !!ack, acquittee_par: ack?.par, acquittee_motif: ack?.motif, acquittee_le: ack?.le,
    };
  }

  private seed(): MockState {
    const rng = createRng(20260801);

    const zones = this.seedZones();
    const grids = this.seedPricingGrids();
    const staff = this.seedStaff();
    const clients = this.seedClients(rng);
    const { drivers, kycDossiers } = this.seedDrivers(rng);
    const orders = this.seedOrders(rng, clients, drivers, staff, grids, zones);
    const { transactions, walletMovements } = this.seedTransactionsAndWallets(rng, orders, drivers);
    const withdrawals = this.seedWithdrawals(rng, drivers);
    const reconciliationPeriods = this.seedReconciliation(rng, transactions, withdrawals);
    const promoCodes = this.seedPromoCodes();
    const { claims, claimMessages } = this.seedClaims(rng, orders, drivers);
    const auditLog = this.seedAuditLog(rng, staff);
    const systemParameters = this.seedSystemParameters();
    const notifications = this.seedNotifications(rng);
    const sessions = this.seedSessions(staff);
    const callbacks = this.seedCallbacks(rng, clients, staff, orders);
    const sanctions = this.seedSanctions(rng, drivers, staff);
    const roles: Role[] = (Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]).map((code) => ({
      code, nom: ROLE_LABELS[code], description: roleDescription(code), permissions: ROLE_PERMISSIONS[code],
    }));

    return {
      version: SEED_VERSION, staff, clients, drivers, kycDossiers, sanctions, orders, transactions,
      walletMovements, withdrawals, reconciliationPeriods, zones, pricingGrids: grids, promoCodes, claims,
      claimMessages, auditLog, systemParameters, notifications, sessions, userActionLog: [], callbacks, roles,
      acknowledgedAlerts: {},
    };
  }

  private seedZones(): Zone[] {
    const now = new Date().toISOString();
    return [
      { id: 'zone_dla_couv', nom: 'Douala — Zone de couverture', ville: 'Douala', type: 'COUVERTURE', centre: { lat: 4.0511, lng: 9.7679 }, rayon_km: 18, supplement_fixe: 0, actif: true, cree_le: now },
      { id: 'zone_yde_couv', nom: 'Yaoundé — Zone de couverture', ville: 'Yaoundé', type: 'COUVERTURE', centre: { lat: 3.8667, lng: 11.5167 }, rayon_km: 16, supplement_fixe: 0, actif: true, cree_le: now },
      { id: 'zone_dla_interdite', nom: 'Douala — Port autonome (accès restreint)', ville: 'Douala', type: 'INTERDITE', centre: { lat: 4.0435, lng: 9.6935 }, rayon_km: 1.5, supplement_fixe: 0, actif: true, cree_le: now },
      { id: 'zone_dla_majoration', nom: 'Douala — Bonabéri soir (majoration)', ville: 'Douala', type: 'MAJORATION', centre: { lat: 4.0669, lng: 9.6903 }, rayon_km: 3, supplement_fixe: 300, actif: true, cree_le: now },
      { id: 'zone_yde_difficile', nom: 'Yaoundé — Nkolbisson (zone difficile)', ville: 'Yaoundé', type: 'DIFFICILE', centre: { lat: 3.8794, lng: 11.4569 }, rayon_km: 2.5, supplement_fixe: 500, actif: true, cree_le: now },
      { id: 'zone_dla_prix_min', nom: 'Douala — Centre-ville (prix plancher)', ville: 'Douala', type: 'MAJORATION', centre: { lat: 4.05, lng: 9.7 }, rayon_km: 2, supplement_fixe: 0, prix_minimum: 1200, actif: false, cree_le: now },
    ];
  }

  private seedPricingGrids(): PricingGrid[] {
    const base = (over: Partial<PricingGrid>): PricingGrid => ({
      id: uid('grid', Math.random), version_label: 'DOUALA_2026_R1', ville: 'Douala', statut: 'ARCHIVEE',
      frais_prise_en_charge: 500, tarif_par_km: 150, tarif_par_minute: 15, prix_minimum: 1000, arrondi: 25,
      coef_urgence_express: 1.4, coef_horaire_soir: 1.15, coef_horaire_nuit: 1.3,
      supplement_poids_kg: 100, supplement_volume: 500, supplement_fragile: 300, plafond_remise: 1000,
      demande_dynamique_active: true, demande_plafond: 1.5, cree_le: isoDaysAgo(200), ...over,
    });
    return [
      base({ id: 'grid_dla_r1', version_label: 'DOUALA_2026_R1', ville: 'Douala', statut: 'ARCHIVEE', archivee_le: isoDaysAgo(120) }),
      base({ id: 'grid_dla_r2', version_label: 'DOUALA_2026_R2', ville: 'Douala', statut: 'ARCHIVEE', cree_le: isoDaysAgo(120), archivee_le: isoDaysAgo(30) }),
      base({ id: 'grid_dla_r3', version_label: 'DOUALA_2026_R3', ville: 'Douala', statut: 'ACTIVE', cree_le: isoDaysAgo(30), active_le: isoDaysAgo(30) }),
      base({ id: 'grid_yde_r1', version_label: 'YAOUNDE_2026_R1', ville: 'Yaoundé', statut: 'ACTIVE', cree_le: isoDaysAgo(45), active_le: isoDaysAgo(45) }),
      base({ id: 'grid_dla_r4_draft', version_label: 'DOUALA_2026_R4', ville: 'Douala', statut: 'BROUILLON', cree_le: isoDaysAgo(2), tarif_par_km: 165, demande_plafond: 1.5 }),
    ];
  }

  private seedStaff(): StaffUser[] {
    const now = new Date().toISOString();
    const mk = (over: Partial<StaffUser>): StaffUser => ({
      id: uid('stf', Math.random), uuid: uid('u', Math.random), kind: 'staff', langue: 'fr', statut: 'ACTIF',
      mfa_actif: true, permissions: [], cree_le: isoDaysAgo(300), derniere_connexion_le: now,
      nom: '', prenom: '', role: 'ADMINISTRATEUR', ...over,
    });
    return [
      mk({ id: 'stf_admin1', prenom: 'Estelle', nom: 'Manga', email: 'estelle.manga@lvb.cm', role: 'ADMINISTRATEUR', permissions: ROLE_PERMISSIONS.ADMINISTRATEUR }),
      mk({ id: 'stf_admin2', prenom: 'Boris', nom: 'Kenfack', email: 'boris.kenfack@lvb.cm', role: 'ADMINISTRATEUR', permissions: ROLE_PERMISSIONS.ADMINISTRATEUR }),
      mk({ id: 'stf_super1', prenom: 'Régis', nom: 'Owona', email: 'regis.owona@lvb.cm', role: 'SUPERVISEUR', permissions: ROLE_PERMISSIONS.SUPERVISEUR }),
      mk({ id: 'stf_super2', prenom: 'Line', nom: 'Fokou', email: 'line.fokou@lvb.cm', role: 'SUPERVISEUR', permissions: ROLE_PERMISSIONS.SUPERVISEUR }),
      mk({ id: 'stf_fin1', prenom: 'Cyrille', nom: 'Ateba', email: 'cyrille.ateba@lvb.cm', role: 'FINANCE', permissions: ROLE_PERMISSIONS.FINANCE }),
      mk({ id: 'stf_tel1', prenom: 'Larissa', nom: 'Mvondo', email: 'larissa.mvondo@lvb.cm', role: 'TELECONSEILLER', permissions: ROLE_PERMISSIONS.TELECONSEILLER }),
      mk({ id: 'stf_tel2', prenom: 'Judith', nom: 'Eyenga', email: 'judith.eyenga@lvb.cm', role: 'TELECONSEILLER', permissions: ROLE_PERMISSIONS.TELECONSEILLER }),
      mk({ id: 'stf_tel3', prenom: 'Franck', nom: 'Tchoua', email: 'franck.tchoua@lvb.cm', role: 'TELECONSEILLER', permissions: ROLE_PERMISSIONS.TELECONSEILLER }),
    ];
  }

  private seedClients(rng: () => number): ClientUser[] {
    const clients: ClientUser[] = [];
    for (let i = 0; i < 42; i++) {
      const { nom, prenom } = fullName(rng);
      const isEntreprise = i < 10;
      clients.push({
        id: uid('cli', rng), uuid: uid('u', rng), kind: 'client', nom, prenom,
        telephone: randomPhone(rng), langue: pick(rng, ['fr', 'fr', 'fr', 'en']), statut: 'ACTIF',
        mfa_actif: false, type_client: isEntreprise ? 'ENTREPRISE' : 'PARTICULIER',
        raison_sociale: isEntreprise ? `${pick(rng, CM_LAST_NAMES)} Distribution SARL` : undefined,
        numero_contribuable: isEntreprise ? `M${randomInt(rng, 100000000, 999999999)}` : undefined,
        partenaire_verifie: isEntreprise ? i % 4 !== 0 : true,
        encours_autorise: isEntreprise ? randomInt(rng, 50, 400) * 1000 : 0,
        solde_avoirs: pick(rng, [0, 0, 0, 500, 1200, 2500]),
        nb_commandes: randomInt(rng, 0, 120),
        note_moyenne: Math.round((3.6 + rng() * 1.4) * 10) / 10,
        cree_le: isoDaysAgo(randomInt(rng, 5, 260), rng),
        derniere_connexion_le: isoDaysAgo(randomInt(rng, 0, 15), rng),
      });
    }
    return clients;
  }

  private seedDrivers(rng: () => number): { drivers: Driver[]; kycDossiers: DriverKycDossier[] } {
    const drivers: Driver[] = [];
    const kycDossiers: DriverKycDossier[] = [];
    const total = 32;
    for (let i = 0; i < total; i++) {
      const { nom, prenom } = fullName(rng);
      const isDouala = i % 3 !== 0;
      const bbox = isDouala ? { latMin: 3.98, latMax: 4.12, lngMin: 9.65, lngMax: 9.78 } : { latMin: 3.83, latMax: 3.92, lngMin: 11.47, lngMax: 11.56 };

      let statut: Driver['statut'] = 'ACTIF';
      if (i >= total - 6 && i < total - 2) statut = 'DOSSIER_SOUMIS';
      else if (i === total - 2) statut = 'SUSPENDU_DOCUMENT';
      else if (i === total - 1) statut = 'SUSPENDU';

      const id = uid('drv', rng);
      const encoursCod = statut === 'ACTIF' ? randomInt(rng, 0, 165000) : 0;
      const driver: Driver = {
        id, utilisateur_id: uid('u', rng), matricule: `LVB-${(1000 + i).toString()}`,
        nom, prenom, telephone: randomPhone(rng),
        numero_cni: `1${randomInt(rng, 10000000, 99999999)}`,
        numero_permis: `PC${randomInt(rng, 100000, 999999)}`,
        permis_expire_le: statut === 'SUSPENDU_DOCUMENT' ? isoDaysAgo(-2) : isoDaysAgo(-randomInt(rng, 20, 500)),
        assurance_expire_le: isoDaysAgo(-randomInt(rng, 30, 400)),
        statut,
        statut_operationnel: statut === 'ACTIF' ? pick(rng, ['DISPONIBLE', 'DISPONIBLE', 'EN_MISSION', 'HORS_LIGNE', 'PAUSE'] as const) : 'HORS_LIGNE',
        position: statut === 'ACTIF' ? { lat: bbox.latMin + rng() * (bbox.latMax - bbox.latMin), lng: bbox.lngMin + rng() * (bbox.lngMax - bbox.lngMin) } : undefined,
        position_maj_le: statut === 'ACTIF' ? isoMinutesAgo(randomInt(rng, 0, 12)) : undefined,
        note_moyenne: Math.round((3.5 + rng() * 1.5) * 100) / 100,
        taux_acceptation_7j: Math.round((55 + rng() * 40) * 10) / 10,
        encours_cod: encoursCod, plafond_cod: 150000,
        commission_taux: 20,
        zone_predilection: isDouala ? 'zone_dla_couv' : 'zone_yde_couv',
        numero_versement: randomPhone(rng),
        vehicule: {
          id: uid('veh', rng), livreur_id: id, type: pick(rng, ['MOTO', 'MOTO', 'MOTO', 'TRICYCLE', 'VOITURE'] as const),
          immatriculation: `LT ${randomInt(rng, 100, 999)} ${pick(rng, ['AB', 'CD', 'EF'])}`,
          marque: pick(rng, ['Haojue', 'Sanili', 'TVS', 'Bajaj']), modele: 'DY110',
          capacite_poids_kg: 40, capacite_volume_l: 90, actif: true,
        },
        score_qualite: Math.round((60 + rng() * 40) * 10) / 10,
        courses_du_jour: statut === 'ACTIF' ? randomInt(rng, 0, 14) : 0,
        courses_total: randomInt(rng, 0, 2400),
        cree_le: isoDaysAgo(randomInt(rng, 10, 300), rng),
      };
      drivers.push(driver);

      if (statut === 'DOSSIER_SOUMIS') {
        const pieces: { type: KycPieceType; label: string }[] = [
          { type: 'CNI_RECTO', label: 'CNI (recto)' }, { type: 'CNI_VERSO', label: 'CNI (verso)' },
          { type: 'PERMIS', label: 'Permis de conduire' }, { type: 'CARTE_GRISE', label: 'Carte grise' },
          { type: 'PHOTO_VEHICULE', label: 'Photo du véhicule' }, { type: 'PHOTO_PROFIL', label: 'Photo de profil' },
          { type: 'ASSURANCE', label: 'Attestation d’assurance' }, { type: 'RIB_MOMO', label: 'Numéro Mobile Money' },
        ];
        kycDossiers.push({
          id: uid('kyc', rng), livreur_id: id, nom, prenom, telephone: driver.telephone, statut: 'DOSSIER_SOUMIS',
          soumis_le: isoDaysAgo(randomInt(rng, 0, 6), rng), cree_le: isoDaysAgo(randomInt(rng, 0, 6), rng),
          pieces: pieces.map((p, idx) => ({
            type: p.type, label: p.label, url: `/mock/kyc/${id}/${p.type.toLowerCase()}.jpg`,
            statut: idx === 2 && rng() < 0.4 ? 'REJETEE' : 'EN_ATTENTE',
            motif_rejet: idx === 2 && rng() < 0.4 ? 'Document flou, numéro de permis illisible.' : undefined,
            televerse_le: isoDaysAgo(randomInt(rng, 0, 6), rng),
          })),
        });
      }
    }
    return { drivers, kycDossiers };
  }

  private seedOrders(
    rng: () => number, clients: ClientUser[], drivers: Driver[], staff: StaffUser[],
    grids: PricingGrid[], zones: Zone[],
  ): Order[] {
    const orders: Order[] = [];
    const activeDrivers = drivers.filter((d) => d.statut === 'ACTIF');
    const teleconseillers = staff.filter((s) => s.role === 'TELECONSEILLER');

    const statusPlan: { statut: OrderStatus; weight: number }[] = [
      { statut: 'LIVREE', weight: 58 }, { statut: 'ANNULEE', weight: 14 },
      { statut: 'EN_LIVRAISON', weight: 8 }, { statut: 'AFFECTEE', weight: 6 },
      { statut: 'EN_ATTENTE_AFFECTATION', weight: 6 }, { statut: 'COLIS_RECUPERE', weight: 5 },
      { statut: 'EN_ROUTE_RAMASSAGE', weight: 5 }, { statut: 'EN_ATTENTE_MANUELLE', weight: 3 },
      { statut: 'ARRIVE_RAMASSAGE', weight: 3 }, { statut: 'ARRIVE_LIVRAISON', weight: 3 },
      { statut: 'EN_ATTENTE_PAIEMENT', weight: 4 }, { statut: 'PLANIFIEE', weight: 3 },
      { statut: 'BROUILLON', weight: 2 }, { statut: 'EXPIREE', weight: 2 },
      { statut: 'ECHEC_LIVRAISON', weight: 2 }, { statut: 'RETOUR_EXPEDITEUR', weight: 2 },
      { statut: 'RETOURNEE', weight: 2 }, { statut: 'ECHEC_RAMASSAGE', weight: 1 },
    ];
    const pool: OrderStatus[] = statusPlan.flatMap((s) => Array(s.weight).fill(s.statut));

    let seq = 1;
    for (let i = 0; i < 165; i++) {
      const statut = pick(rng, pool);
      const isDouala = rng() < 0.62;
      const grid = grids.find((g) => g.ville === (isDouala ? 'Douala' : 'Yaoundé') && g.statut === 'ACTIVE')!;
      const client = pick(rng, clients);
      const distanceKm = Math.round((1.5 + rng() * 13) * 10) / 10;
      const dureeMin = Math.round(distanceKm * 3.4 + randomInt(rng, 2, 10));
      const urgence = pick(rng, ['STANDARD', 'STANDARD', 'STANDARD', 'EXPRESS', 'PLANIFIE'] as const);
      const fragile = rng() < 0.15;
      const poids = Math.round((0.5 + rng() * 9) * 10) / 10;
      const quote = computeQuote(grid, {
        distance_km: distanceKm, duree_min: dureeMin, urgence, heure: `${randomInt(rng, 6, 22)}:00`,
        poids_kg: poids, fragile, ratio_demande: rng() < 0.15 ? 3 + rng() * 2 : rng() * 1.4,
      });

      // Recency-weighted (U^2 skews toward 0) so "today" always has a healthy sample for the
      // dashboard's daily KPIs, instead of a uniform spread that can land zero orders on a given day.
      const createdDaysAgo = statut === 'LIVREE' || statut === 'ANNULEE' || statut === 'RETOURNEE'
        ? Math.floor(rng() * rng() * 45) : randomInt(rng, 0, 2);
      const createdAt = isoDaysAgo(createdDaysAgo, rng);
      const confirmedAt = statut === 'BROUILLON' ? undefined : createdAt;
      const isActive = ACTIVE_ORDER_STATUSES.includes(statut);
      const isLateDemo = isActive && rng() < 0.12;

      const canal = pick(rng, ['APP_CLIENT', 'APP_CLIENT', 'APP_CLIENT', 'TELECONSEILLER', 'WEB'] as const);
      const agent = canal === 'TELECONSEILLER' ? pick(rng, teleconseillers) : undefined;

      const quartiers = isDouala ? DOUALA_QUARTIERS : YAOUNDE_QUARTIERS;
      const villeName = isDouala ? 'Douala' : 'Yaoundé';
      const zoneCandidate = zones.find((z) => z.ville === villeName && z.type === 'COUVERTURE');

      const driver = ['EN_ATTENTE_AFFECTATION', 'EN_ATTENTE_PAIEMENT', 'PLANIFIEE', 'BROUILLON', 'EXPIREE', 'ANNULEE', 'EN_ATTENTE_MANUELLE'].includes(statut)
        ? undefined
        : pick(rng, activeDrivers.filter((d) => (isDouala ? d.zone_predilection === 'zone_dla_couv' : d.zone_predilection === 'zone_yde_couv')));

      const numero = `LVB-${isDouala ? 'DLA' : 'YDE'}-${new Date(createdAt).toISOString().slice(2, 10).replace(/-/g, '')}-${(seq++).toString().padStart(4, '0')}`;
      const mode = pick(rng, ['MTN_MOMO', 'MTN_MOMO', 'ORANGE_MONEY', 'COD', 'COD', 'CARTE'] as const);

      const historique: OrderHistoryEntry[] = [
        { id: uid('h', rng), nouveau_statut: 'EN_ATTENTE_PAIEMENT', auteur_type: canal === 'TELECONSEILLER' ? 'AGENT' : 'CLIENT', auteur_nom: canal === 'TELECONSEILLER' ? (agent ? `${agent.prenom} ${agent.nom}` : 'Agent') : `${client.prenom} ${client.nom}`, cree_le: createdAt },
      ];
      if (confirmedAt && statut !== 'BROUILLON' && statut !== 'EN_ATTENTE_PAIEMENT') {
        historique.push({ id: uid('h', rng), ancien_statut: 'EN_ATTENTE_PAIEMENT', nouveau_statut: 'EN_ATTENTE_AFFECTATION', auteur_type: 'SYSTEME', auteur_nom: 'Système', cree_le: confirmedAt });
      }
      // Anchored to the order's own timeline (not "now") so old seeded orders don't show an
      // affectation date that lands after their delivery date.
      const affectedAt = driver ? isoAfter(confirmedAt ?? createdAt, 5, 180, rng) : undefined;
      if (driver && statut !== 'EN_ATTENTE_AFFECTATION') {
        historique.push({ id: uid('h', rng), ancien_statut: 'EN_ATTENTE_AFFECTATION', nouveau_statut: 'AFFECTEE', auteur_type: 'SYSTEME', auteur_nom: 'Moteur de dispatch', cree_le: affectedAt! });
      }
      if (statut === 'LIVREE') {
        historique.push({ id: uid('h', rng), ancien_statut: 'EN_LIVRAISON', nouveau_statut: 'LIVREE', auteur_type: 'LIVREUR', auteur_nom: driver ? `${driver.prenom} ${driver.nom}` : 'Livreur', cree_le: isoDaysAgo(Math.max(createdDaysAgo - 0.2, 0), rng) });
      }

      const preuves: ProofOfDelivery[] = statut === 'LIVREE' ? [{
        type: 'LIVRAISON', photos: ['/mock/pod/photo1.jpg'], signature_url: rng() < 0.6 ? '/mock/pod/signature.png' : undefined,
        code_valide: true, position: { lat: 4.05 + rng() * 0.05, lng: 9.7 + rng() * 0.05 },
        distance_point_reference_m: randomInt(rng, 5, 180), capture_le: isoDaysAgo(createdDaysAgo, rng), synchronise_le: isoDaysAgo(createdDaysAgo, rng),
      }] : [];

      const order: Order = {
        id: uid('ord', rng), uuid: uid('u', rng), numero, client_id: client.id, client_nom: `${client.prenom} ${client.nom}`,
        client_telephone: client.telephone!, livreur_id: driver?.id, livreur_nom: driver ? `${driver.prenom} ${driver.nom}` : undefined,
        cree_par_utilisateur_id: agent?.id, canal, statut, urgence, ville: villeName as 'Douala' | 'Yaoundé',
        adresse_depart: { point: { lat: (zoneCandidate?.centre.lat ?? 4.05) + (rng() - 0.5) * 0.06, lng: (zoneCandidate?.centre.lng ?? 9.7) + (rng() - 0.5) * 0.06 }, ville: villeName, quartier: pick(rng, quartiers), repere: 'Face à la pharmacie du carrefour', contact_nom: `${client.prenom} ${client.nom}`, contact_telephone: client.telephone! },
        adresse_arrivee: { point: { lat: (zoneCandidate?.centre.lat ?? 4.05) + (rng() - 0.5) * 0.06, lng: (zoneCandidate?.centre.lng ?? 9.7) + (rng() - 0.5) * 0.06 }, ville: villeName, quartier: pick(rng, quartiers), repere: 'Immeuble bleu, 2e étage', contact_nom: `Destinataire ${i}`, contact_telephone: randomPhone(rng) },
        destinataire_nom: `Destinataire ${i}`, destinataire_telephone: randomPhone(rng),
        colis: [{ id: uid('col', rng), reference: `${numero}-1`, type: pick(rng, ['DOCUMENT', 'PETIT', 'STANDARD', 'VOLUMINEUX', 'FRAGILE'] as ParcelType[]), poids_kg: poids, valeur_declaree: rng() < 0.3 ? randomInt(rng, 5000, 60000) : undefined, statut: statut === 'LIVREE' ? 'LIVRE' : statut === 'RETOURNEE' ? 'RETOURNE' : 'EN_ATTENTE' }],
        prix_total: quote.prix_final, commission: Math.round(quote.prix_final * 0.2), remuneration_livreur: Math.round(quote.prix_final * 0.8),
        mode_paiement: mode, montant_cod: mode === 'COD' ? quote.prix_final : 0,
        echeance_promise: isLateDemo ? isoMinutesAgo(randomInt(rng, 10, 90)) : (urgence === 'EXPRESS' ? isoInMinutes(120) : isoInMinutes(randomInt(rng, 180, 1200))),
        confirmee_le: confirmedAt, affectee_le: affectedAt,
        recuperee_le: ['COLIS_RECUPERE', 'EN_LIVRAISON', 'ARRIVE_LIVRAISON', 'LIVREE'].includes(statut) ? isoAfter(affectedAt ?? confirmedAt ?? createdAt, 5, 120, rng) : undefined,
        livree_le: statut === 'LIVREE' ? isoDaysAgo(createdDaysAgo, rng) : undefined,
        annulee_le: statut === 'ANNULEE' ? isoDaysAgo(createdDaysAgo, rng) : undefined,
        motif_annulation: statut === 'ANNULEE' ? pick(rng, ['ERREUR_ADRESSE', 'PLUS_BESOIN', 'TROP_CHER', 'LIVREUR_INJOIGNABLE'] as const) : undefined,
        frais_annulation: statut === 'ANNULEE' ? pick(rng, [0, 0, 500, 750]) : undefined,
        cle_idempotence: uid('idem', rng), a_lheure: statut === 'LIVREE' ? !isLateDemo : undefined,
        distance_m: Math.round(distanceKm * 1000), historique, preuves, a_reclamation: false,
        cree_le: createdAt, modifie_le: createdAt,
      };
      orders.push(order);
    }
    return orders;
  }

  private seedTransactionsAndWallets(rng: () => number, orders: Order[], drivers: Driver[]): { transactions: Transaction[]; walletMovements: WalletMovement[] } {
    const transactions: Transaction[] = [];
    const walletMovements: WalletMovement[] = [];
    const walletRunning = new Map<string, number>();

    for (const o of orders) {
      if (o.mode_paiement !== 'COD' && o.statut !== 'BROUILLON') {
        const failed = o.statut === 'EXPIREE' ? true : rng() < 0.04;
        transactions.push({
          id: uid('txn', rng), uuid: uid('u', rng), commande_id: o.id, commande_numero: o.numero,
          type: 'PAIEMENT', prestataire: paymentProvider(o.mode_paiement),
          reference_externe: uid('ext', rng), reference_interne: uid('int', rng),
          montant: o.prix_total, frais_prestataire: Math.round(o.prix_total * 0.015),
          statut: failed ? 'ECHOUEE' : 'REUSSIE', code_erreur_prestataire: failed ? 'INSUFFICIENT_FUNDS' : undefined,
          initiee_le: o.cree_le, confirmee_le: failed ? undefined : o.confirmee_le, cree_le: o.cree_le,
        });
      }
      if (o.livreur_id && (o.statut === 'LIVREE' || ACTIVE_ORDER_STATUSES.includes(o.statut))) {
        const running = (walletRunning.get(o.livreur_id) ?? 0) + o.remuneration_livreur;
        walletRunning.set(o.livreur_id, running);
        walletMovements.push({
          id: uid('mv', rng), wallet_id: o.livreur_id, sens: 'CREDIT', montant: o.remuneration_livreur,
          motif: 'REMUNERATION_COURSE', commande_id: o.id, commande_numero: o.numero, solde_apres: running,
          reference: uid('ref', rng), cree_le: o.livree_le ?? o.affectee_le ?? o.cree_le,
        });
      }
    }

    // A handful of orphan operator-side transactions to exercise reconciliation (UC-ADM-08).
    for (let i = 0; i < 3; i++) {
      transactions.push({
        id: uid('txn', rng), uuid: uid('u', rng), type: 'PAIEMENT', prestataire: pick(rng, ['MTN_MOMO', 'ORANGE_MONEY'] as const),
        reference_externe: uid('orphan', rng), reference_interne: uid('int', rng),
        montant: randomInt(rng, 1000, 6000), frais_prestataire: 0, statut: 'REUSSIE',
        initiee_le: isoDaysAgo(randomInt(rng, 1, 20), rng), confirmee_le: isoDaysAgo(randomInt(rng, 1, 20), rng), cree_le: isoDaysAgo(randomInt(rng, 1, 20), rng),
      });
    }

    for (const d of drivers.filter((dr) => dr.statut === 'ACTIF')) {
      const running = walletRunning.get(d.id) ?? 0;
      if (running > 6000 && rng() < 0.5) {
        const retrait = Math.round(running * 0.3 / 500) * 500;
        const after = running - retrait;
        walletRunning.set(d.id, after);
        walletMovements.push({
          id: uid('mv', rng), wallet_id: d.id, sens: 'DEBIT', montant: retrait, motif: 'RETRAIT',
          solde_apres: after, reference: uid('ref', rng), cree_le: isoDaysAgo(randomInt(rng, 1, 10), rng),
        });
      }
    }

    return { transactions, walletMovements };
  }

  private walletBalance(driverId: string, movements: WalletMovement[]): number {
    const forDriver = movements.filter((m) => m.wallet_id === driverId);
    if (!forDriver.length) return 0;
    return forDriver[forDriver.length - 1].solde_apres;
  }

  private seedWithdrawals(rng: () => number, drivers: Driver[]): WithdrawalRequest[] {
    const list: WithdrawalRequest[] = [];
    const active = drivers.filter((d) => d.statut === 'ACTIF');
    for (let i = 0; i < 9; i++) {
      const driver = pick(rng, active);
      const solde = randomInt(rng, 5000, 60000);
      list.push({
        id: uid('wd', rng), livreur_id: driver.id, livreur_nom: `${driver.prenom} ${driver.nom}`,
        montant: Math.round(solde * 0.7 / 500) * 500, solde_disponible_au_moment: solde,
        // Most requests should be cleanly approvable in the demo; only a minority breach RG (ERR-4222).
        encours_cod_au_moment: rng() < 0.25 ? solde + randomInt(rng, 2000, 15000) : Math.round(solde * (0.2 + rng() * 0.5)),
        statut: pick(rng, ['EN_ATTENTE', 'EN_ATTENTE', 'VALIDE', 'VERSE', 'REJETE'] as const),
        numero_versement: driver.numero_versement, cle_idempotence: uid('idem', rng),
        cree_le: isoDaysAgo(randomInt(rng, 0, 6), rng),
      });
    }
    return list;
  }

  private seedReconciliation(rng: () => number, transactions: Transaction[], withdrawals: WithdrawalRequest[]): ReconciliationPeriod[] {
    const periods: ReconciliationPeriod[] = [];
    const momoGaps: ReconciliationGap[] = transactions.filter((t) => !t.commande_id).map((t) => ({
      id: uid('gap', rng), domaine: 'MOBILE_MONEY', nature: 'OPERATEUR_SANS_PLATEFORME', reference: t.reference_externe ?? t.reference_interne,
      montant_operateur: t.montant, ecart: t.montant, qualifie: false,
    }));
    const totalAttendu = transactions.filter((t) => t.statut === 'REUSSIE').reduce((sum, t) => sum + t.montant, 0);
    const totalConstate = totalAttendu - momoGaps.reduce((s, g) => s + g.ecart, 0);
    periods.push({
      id: 'recon_momo_open', domaine: 'MOBILE_MONEY', periode_debut: isoDaysAgo(1), periode_fin: new Date().toISOString(),
      statut: 'OUVERTE', total_attendu: totalAttendu, total_constate: totalConstate,
      ecart_pct: totalAttendu ? Math.round((totalAttendu - totalConstate) / totalAttendu * 1000) / 10 : 0, ecarts: momoGaps,
    });
    periods.push({
      id: 'recon_momo_closed', domaine: 'MOBILE_MONEY', periode_debut: isoDaysAgo(8), periode_fin: isoDaysAgo(1),
      statut: 'CLOTUREE', total_attendu: 1284500, total_constate: 1281900, ecart_pct: 0.2,
      cloturee_le: isoDaysAgo(1), cloturee_par: 'Cyrille Ateba', ecarts: [],
    });

    const codGaps: ReconciliationGap[] = [];
    periods.push({
      id: 'recon_cod_open', domaine: 'COD', periode_debut: isoDaysAgo(1), periode_fin: new Date().toISOString(),
      statut: 'OUVERTE', total_attendu: 845000, total_constate: 838500, ecart_pct: 0.77, ecarts: codGaps,
    });

    const withdrawalGaps: ReconciliationGap[] = withdrawals.filter((w) => w.encours_cod_au_moment > w.solde_disponible_au_moment).map((w) => ({
      id: uid('gap', rng), domaine: 'RETRAITS_LIVREURS', nature: 'ECART_MONTANT', reference: w.id,
      montant_plateforme: w.montant, ecart: w.encours_cod_au_moment - w.solde_disponible_au_moment,
      entite_liee: w.livreur_nom, qualifie: false,
    }));
    periods.push({
      id: 'recon_retraits_open', domaine: 'RETRAITS_LIVREURS', periode_debut: isoDaysAgo(1), periode_fin: new Date().toISOString(),
      statut: 'OUVERTE', total_attendu: 210000, total_constate: 202000, ecart_pct: 3.8, ecarts: withdrawalGaps,
    });

    return periods;
  }

  private seedPromoCodes(): PromoCode[] {
    const now = new Date().toISOString();
    return [
      { id: 'promo_bienvenue', code: 'BIENVENUE500', description: 'Première commande — 500 XAF de réduction', plafond_remise: 500, plafond_utilisation_global: 5000, utilisations: 1284, mono_usage_par_compte: true, montant_minimum: 1000, valide_du: isoDaysAgo(90), valide_au: isoInMinutes(60 * 24 * 30), actif: true, cree_le: isoDaysAgo(90) },
      { id: 'promo_partenaire', code: 'PARTENAIRE10', description: 'Remise partenaire — 10 % plafonné à 1000 XAF', plafond_remise: 1000, plafond_utilisation_global: 2000, utilisations: 342, mono_usage_par_compte: false, valide_du: isoDaysAgo(30), valide_au: isoInMinutes(60 * 24 * 60), actif: true, cree_le: isoDaysAgo(30) },
      { id: 'promo_expired', code: 'NOEL2025', description: 'Campagne de fin d’année 2025', plafond_remise: 800, plafond_utilisation_global: 3000, utilisations: 2991, mono_usage_par_compte: true, valide_du: isoDaysAgo(120), valide_au: isoDaysAgo(30), actif: false, cree_le: isoDaysAgo(120) },
    ];
  }

  private seedClaims(rng: () => number, orders: Order[], drivers: Driver[]): { claims: Claim[]; claimMessages: ClaimMessage[] } {
    const candidates = orders.filter((o) => o.statut === 'LIVREE' || o.statut === 'ANNULEE' || o.statut === 'ECHEC_LIVRAISON');
    const claims: Claim[] = [];
    const messages: ClaimMessage[] = [];
    const categories: Claim['categorie'][] = ['RETARD', 'COLIS_ENDOMMAGE', 'COLIS_PERDU', 'COMPORTEMENT', 'FACTURATION', 'AUTRE'];
    const chosen = pickMany(rng, candidates, 14);
    chosen.forEach((order, idx) => {
      order.a_reclamation = true;
      const gravite = pick(rng, ['FAIBLE', 'MOYENNE', 'MOYENNE', 'HAUTE', 'CRITIQUE'] as const);
      const statut = pick(rng, ['OUVERTE', 'OUVERTE', 'EN_COURS', 'ESCALADEE', 'RESOLUE', 'FERMEE'] as const);
      const openedDaysAgo = randomInt(rng, 0, 10);
      const slaHours = gravite === 'CRITIQUE' ? 4 : gravite === 'HAUTE' ? 12 : 48;
      const claimId = uid('clm', rng);
      claims.push({
        id: claimId, numero: `REC-${(2000 + idx)}`, commande_id: order.id, commande_numero: order.numero,
        ouverte_par_nom: order.client_nom, ouverte_par_id: order.client_id,
        categorie: pick(rng, categories), gravite, statut,
        description: 'Le client signale un problème avec cette livraison et demande un geste commercial.',
        pieces_jointes: rng() < 0.4 ? ['/mock/claims/photo.jpg'] : [],
        assignee_a: statut !== 'OUVERTE' ? 'Régis Owona' : undefined,
        echeance_sla: new Date(new Date(isoDaysAgo(openedDaysAgo, rng)).getTime() + slaHours * 3_600_000).toISOString(),
        resolue_le: statut === 'RESOLUE' || statut === 'FERMEE' ? isoDaysAgo(Math.max(openedDaysAgo - 1, 0), rng) : undefined,
        resolution: statut === 'RESOLUE' || statut === 'FERMEE' ? 'Avoir accordé au client, dossier clos après validation.' : undefined,
        geste_commercial: statut === 'RESOLUE' || statut === 'FERMEE' ? pick(rng, [0, 500, 1000, 1500]) : undefined,
        sanction_livreur_id: gravite === 'CRITIQUE' && order.livreur_id ? order.livreur_id : undefined,
        cree_le: isoDaysAgo(openedDaysAgo, rng),
      });
      if (statut !== 'OUVERTE') {
        messages.push({ id: uid('msg', rng), claim_id: claimId, auteur: order.client_nom, auteur_role: 'Client', message: 'Bonjour, je n’ai toujours pas de nouvelles concernant ma commande.', cree_le: isoDaysAgo(openedDaysAgo, rng) });
        messages.push({ id: uid('msg', rng), claim_id: claimId, auteur: 'Régis Owona', auteur_role: 'Superviseur', message: 'Bonjour, nous avons ouvert une enquête et revenons vers vous rapidement.', cree_le: isoDaysAgo(Math.max(openedDaysAgo - 1, 0), rng) });
      }
    });
    return { claims, claimMessages: messages };
  }

  private seedAuditLog(rng: () => number, staff: StaffUser[]): AuditLogEntry[] {
    const actions = [
      { action: 'Modification de tarif', ressource: 'grille_tarifaire' }, { action: 'Modification de zone', ressource: 'zone' },
      { action: 'Affectation manuelle', ressource: 'commande' }, { action: 'Annulation par un agent', ressource: 'commande' },
      { action: 'Geste commercial', ressource: 'reclamation' }, { action: 'Validation de retrait', ressource: 'retrait' },
      { action: 'Modification de rôle', ressource: 'role' }, { action: 'Consultation de données KYC', ressource: 'dossier_livreur' },
      { action: 'Export de données', ressource: 'export' }, { action: 'Modification de paramètre système', ressource: 'parametre' },
    ];
    return Array.from({ length: 70 }, () => {
      const a = pick(rng, actions);
      const author = pick(rng, staff);
      return {
        id: uid('aud', rng), auteur_nom: `${author.prenom} ${author.nom}`, auteur_role: author.role,
        action: a.action, ressource: a.ressource, ressource_id: uid('res', rng),
        ip: `41.202.${randomInt(rng, 0, 255)}.${randomInt(rng, 0, 255)}`, appareil: pick(rng, ['Chrome / macOS', 'Chrome / Windows', 'Firefox / Windows', 'Safari / macOS']),
        cree_le: isoDaysAgo(randomInt(rng, 0, 60), rng),
      };
    }).sort((a, b) => b.cree_le.localeCompare(a.cree_le));
  }

  private seedSystemParameters(): SystemParameter[] {
    const now = new Date().toISOString();
    const mk = (o: Omit<SystemParameter, 'modifie_le' | 'modifie_par'>): SystemParameter => ({ ...o, modifie_le: now, modifie_par: 'Estelle Manga' });
    return [
      mk({ cle: 'dispatch.rayon.vague1_km', categorie: 'DISPATCH', label: 'Rayon vague 1', description: 'Rayon de recherche initial du dispatch (RG-053).', valeur: 2, type: 'NOMBRE', unite: 'km', min: 0.5, max: 10 }),
      mk({ cle: 'dispatch.rayon.vague2_km', categorie: 'DISPATCH', label: 'Rayon vague 2', description: 'Rayon élargi après 90 s sans acceptation.', valeur: 4, type: 'NOMBRE', unite: 'km', min: 1, max: 15 }),
      mk({ cle: 'dispatch.rayon.vague3_km', categorie: 'DISPATCH', label: 'Rayon vague 3', description: 'Rayon final en mode diffusion.', valeur: 7, type: 'NOMBRE', unite: 'km', min: 2, max: 25 }),
      mk({ cle: 'dispatch.delai_offre_s', categorie: 'DELAIS', label: 'Délai d’acceptation d’une offre', description: 'Temps laissé à un livreur pour accepter (RG-052).', valeur: 30, type: 'NOMBRE', unite: 's', min: 10, max: 90 }),
      mk({ cle: 'dispatch.delai_manuel_s', categorie: 'DELAIS', label: 'Bascule en attente manuelle', description: 'Délai cumulé avant bascule en EN_ATTENTE_MANUELLE.', valeur: 300, type: 'NOMBRE', unite: 's', min: 120, max: 900 }),
      mk({ cle: 'finance.plafond_cod', categorie: 'PLAFONDS', label: 'Plafond d’encours COD par livreur', description: 'RG-023.', valeur: 150000, type: 'NOMBRE', unite: 'XAF', min: 20000, max: 500000 }),
      mk({ cle: 'finance.seuil_retrait_min', categorie: 'PLAFONDS', label: 'Seuil minimum de retrait', description: 'RG-026.', valeur: 5000, type: 'NOMBRE', unite: 'XAF', min: 1000, max: 50000 }),
      mk({ cle: 'finance.commission_defaut_pct', categorie: 'PLAFONDS', label: 'Commission LVB par défaut', description: 'RG-021.', valeur: 20, type: 'NOMBRE', unite: '%', min: 0, max: 40 }),
      mk({ cle: 'sla.express_min', categorie: 'SLA', label: 'Délai promis EXPRESS', description: 'RG-070.', valeur: 120, type: 'NOMBRE', unite: 'min', min: 30, max: 240 }),
      mk({ cle: 'sla.avoir_retard_pct', categorie: 'SLA', label: 'Avoir automatique en cas de retard imputable à LVB', description: 'RG-072.', valeur: 20, type: 'NOMBRE', unite: '%', min: 0, max: 100 }),
      mk({ cle: 'sla.rayon_proximite_m', categorie: 'SLA', label: 'Rayon de contrôle de proximité', description: 'RG-060.', valeur: 150, type: 'NOMBRE', unite: 'm', min: 50, max: 500 }),
      mk({ cle: 'tarification.demande_dynamique_active', categorie: 'TARIFICATION', label: 'Tarification dynamique activée', description: 'Désactivable globalement en un clic (RG-015).', valeur: true, type: 'BOOLEEN' }),
      mk({ cle: 'tarification.plafond_coef_demande', categorie: 'TARIFICATION', label: 'Plafond du coefficient de forte demande', description: 'RG-015 — jamais dépassé, même en crise.', valeur: 1.5, type: 'NOMBRE', min: 1, max: 1.5 }),
    ];
  }

  private seedNotifications(rng: () => number): AppNotification[] {
    const items: { titre: string; message: string; type: AppNotification['type'] }[] = [
      { titre: 'Nouveau dossier livreur', message: '5 dossiers KYC en attente de validation.', type: 'INFO' },
      { titre: 'Écart de réconciliation', message: 'L’écart COD du jour dépasse le seuil de 0,5 %.', type: 'AVERTISSEMENT' },
      { titre: 'Réclamation critique', message: 'Une réclamation de gravité critique vient d’être ouverte.', type: 'ERREUR' },
      { titre: 'Grille tarifaire activée', message: 'DOUALA_2026_R3 est maintenant active.', type: 'SUCCES' },
      { titre: 'Retrait en attente', message: '3 demandes de retrait attendent une validation.', type: 'INFO' },
    ];
    return items.map((it, idx) => ({ id: uid('notif', rng), ...it, lue: idx > 2, cree_le: isoMinutesAgo(randomInt(rng, 5, 500)) }));
  }

  private seedSessions(staff: StaffUser[]): Session[] {
    const sessions: Session[] = [];
    staff.forEach((s, idx) => {
      sessions.push({ id: uid('sess', Math.random), utilisateur_id: s.id, appareil: 'Chrome / macOS', modele: 'MacBook Pro', ip: '41.202.11.4', localisation_approx: 'Douala, CM', cree_le: isoDaysAgo(1), derniere_activite_le: new Date().toISOString(), courante: true });
      if (idx % 2 === 0) {
        sessions.push({ id: uid('sess', Math.random), utilisateur_id: s.id, appareil: 'Safari / iOS', modele: 'iPhone 14', ip: '41.202.9.31', localisation_approx: 'Douala, CM', cree_le: isoDaysAgo(6), derniere_activite_le: isoDaysAgo(2), courante: false });
      }
    });
    return sessions;
  }

  private seedCallbacks(rng: () => number, clients: ClientUser[], staff: StaffUser[], orders: Order[]): Callback[] {
    const agents = staff.filter((s) => s.role === 'TELECONSEILLER');
    return Array.from({ length: 9 }, (_, i) => {
      const client = pick(rng, clients);
      const agent = pick(rng, agents);
      const order = rng() < 0.5 ? pick(rng, orders) : undefined;
      const overdue = i < 3;
      return {
        id: uid('cb', rng), client_id: client.id, client_nom: `${client.prenom} ${client.nom}`, client_telephone: client.telephone!,
        commande_id: order?.id, commande_numero: order?.numero,
        motif: pick(rng, ['Confirmer une adresse', 'Relancer le paiement', 'Suivre une réclamation', 'Rappeler pour un devis entreprise']),
        echeance: overdue ? isoMinutesAgo(randomInt(rng, 10, 240)) : isoInMinutes(randomInt(rng, 30, 2000)),
        statut: i > 6 ? 'FAIT' : 'PLANIFIE',
        agent_id: agent.id, agent_nom: `${agent.prenom} ${agent.nom}`,
        cree_le: isoDaysAgo(randomInt(rng, 0, 3), rng),
      };
    });
  }

  private seedSanctions(rng: () => number, drivers: Driver[], staff: StaffUser[]): DriverSanction[] {
    const eligible = drivers.filter((d) => d.statut === 'ACTIF' && d.score_qualite < 75);
    return pickMany(rng, eligible, Math.min(3, eligible.length)).map((d) => ({
      id: uid('sanc', rng), livreur_id: d.id, type: pick(rng, ['AVERTISSEMENT', 'SUSPENSION_TEMPORAIRE'] as const),
      motif: 'Score qualité en dessous du seuil d’alerte sur 30 jours glissants.', duree_jours: 3,
      decide_par: 'Régis Owona', cree_le: isoDaysAgo(randomInt(rng, 1, 15), rng),
      statut: pick(rng, ['PROPOSEE', 'CONFIRMEE'] as const),
    }));
  }
}

function paymentProvider(method: Order['mode_paiement']): Transaction['prestataire'] {
  if (method === 'CARTE') return 'PSP_CARTE';
  if (method === 'MTN_MOMO' || method === 'ORANGE_MONEY') return method;
  return 'INTERNE';
}

function roleDescription(code: string): string {
  switch (code) {
    case 'ADMINISTRATEUR': return 'Accès complet : référentiels, tarifs, utilisateurs, droits.';
    case 'SUPERVISEUR': return 'Pilotage opérationnel quotidien : dispatch, incidents, litiges.';
    case 'FINANCE': return 'Réconciliation, validation des retraits, suivi de la marge.';
    case 'TELECONSEILLER': return 'Prise de commande téléphonique, assistance, réclamations de niveau 1.';
    default: return '';
  }
}
