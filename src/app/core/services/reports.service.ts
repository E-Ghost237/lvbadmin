import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { FinalRecetteChecklist, KpiCardValue, KpiSeries, OperationsSnapshot } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { mockOk, uid } from '../mock/mock-utils';
import { formatXaf } from '../utils/formatters';

export interface ExportJob {
  id: string;
  type: string;
  filtres: string;
  statut: 'EN_COURS' | 'PRET' | 'EXPIRE';
  demande_le: string;
  pret_le?: string;
  expire_le?: string;
  lignes?: number;
}

/** §14 KPI dashboards + UC-ADM-12 (exports asynchrones avec lien expirant). */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly _exports = signal<ExportJob[]>([]);
  readonly exports = this._exports.asReadonly();

  constructor(private readonly db: MockDbService) {}

  operationsSnapshot(): Observable<OperationsSnapshot> {
    const orders = this.db.orders();
    const today = new Date().toISOString().slice(0, 10);
    const createdToday = orders.filter((o) => o.cree_le.startsWith(today));
    const deliveredToday = orders.filter((o) => o.livree_le?.startsWith(today));
    const active = orders.filter((o) => ['EN_ATTENTE_AFFECTATION', 'EN_ATTENTE_MANUELLE', 'AFFECTEE', 'EN_ROUTE_RAMASSAGE', 'ARRIVE_RAMASSAGE', 'COLIS_RECUPERE', 'EN_LIVRAISON', 'ARRIVE_LIVRAISON'].includes(o.statut));
    const onTime = deliveredToday.filter((o) => o.a_lheure !== false).length;
    const ca = deliveredToday.reduce((s, o) => s + o.prix_total, 0);
    return mockOk({
      commandes_creees: createdToday.length, commandes_livrees: deliveredToday.length, commandes_en_cours: active.length,
      taux_livraison_heure: deliveredToday.length ? Math.round((onTime / deliveredToday.length) * 1000) / 10 : 0,
      chiffre_affaires: ca, panier_moyen: deliveredToday.length ? Math.round(ca / deliveredToday.length) : 0,
      livreurs_actifs: this.db.drivers().filter((d) => d.statut === 'ACTIF' && d.statut_operationnel !== 'HORS_LIGNE').length,
    });
  }

  kpiCards(dashboard: 'pilotage' | 'finance' | 'qualite' | 'technique' | 'direction'): Observable<KpiCardValue[]> {
    const orders = this.db.orders();
    const delivered = orders.filter((o) => o.statut === 'LIVREE');
    const onTime = delivered.filter((o) => o.a_lheure !== false).length;
    const cancelled = orders.filter((o) => o.statut === 'ANNULEE');
    const claims = this.db.claims();
    const txns = this.db.transactions().filter((t) => t.type === 'PAIEMENT');
    const succeeded = txns.filter((t) => t.statut === 'REUSSIE');

    const cards: Record<string, KpiCardValue[]> = {
      pilotage: [
        { id: 'KPI-100', label: 'Livraisons à l’heure', value: delivered.length ? (onTime / delivered.length) * 100 : 0, unit: '%', target: 92, alertBelow: 85 },
        { id: 'KPI-101', label: 'Commandes créées (30 j)', value: orders.length, unit: 'count' },
        { id: 'KPI-020', label: 'Taux d’annulation', value: orders.length ? (cancelled.length / orders.length) * 100 : 0, unit: '%', target: 8, alertAbove: 15 },
        { id: 'KPI-105', label: 'Affectation automatique', value: 91.4, unit: '%', target: 90, alertBelow: 70 },
        { id: 'KPI-032', label: 'Taux d’acceptation livreur', value: this.avg(this.db.drivers().map((d) => d.taux_acceptation_7j)), unit: '%', target: 65, alertBelow: 45 },
        { id: 'KPI-031', label: 'Utilisation de la flotte', value: 61.2, unit: '%', target: 65 },
      ],
      finance: [
        { id: 'KPI-013', label: 'Succès de paiement', value: succeeded.length ? (succeeded.length / txns.length) * 100 : 0, unit: '%', target: 95, alertBelow: 88 },
        { id: 'KPI-050', label: 'Écart de réconciliation', value: this.reconciliationGapPct(), unit: '%', target: 0.5, alertAbove: 1 },
        { id: 'KPI-052', label: 'Incohérences de wallet', value: 0, unit: 'count', target: 0, alertAbove: 0 },
        { id: 'KPI-106', label: 'Marge brute par course', value: delivered.length ? this.avg(delivered.map((o) => ((o.prix_total - o.remuneration_livreur) / o.prix_total) * 100)) : 0, unit: '%', target: 15, alertBelow: 8 },
        { id: 'KPI-107', label: 'Encours COD total', value: this.db.drivers().reduce((s, d) => s + d.encours_cod, 0), unit: 'XAF' },
      ],
      qualite: [
        { id: 'KPI-300', label: 'Note moyenne des livraisons', value: this.avg(this.db.drivers().map((d) => d.note_moyenne)), unit: 'count', target: 4.4, alertBelow: 4.0 },
        { id: 'KPI-301', label: 'Taux de réclamation', value: orders.length ? (claims.length / orders.length) * 100 : 0, unit: '%', target: 3, alertAbove: 6 },
        { id: 'KPI-303', label: 'Délai de résolution moyen', value: 30, unit: 'min', target: 48 * 60 },
        { id: 'KPI-038', label: 'POD complets', value: 99.2, unit: '%', target: 99, alertBelow: 95 },
      ],
      technique: [
        { id: 'KPI-200', label: 'Disponibilité API (mensuel)', value: 99.7, unit: '%', target: 99.5, alertBelow: 99 },
        { id: 'KPI-202', label: 'Taux d’erreur 5xx', value: 0.04, unit: '%', target: 0.1, alertAbove: 0.5 },
        { id: 'KPI-017', label: 'Latence p95 propagation position', value: 3.4, unit: 's', target: 5, alertAbove: 12 },
        { id: 'KPI-205', label: 'Plantages mobiles', value: 0.3, unit: '%', target: 0.5, alertAbove: 1.5 },
      ],
      direction: [
        { id: 'CA', label: 'Chiffre d’affaires (30 j)', value: delivered.reduce((s, o) => s + o.prix_total, 0), unit: 'XAF' },
        { id: 'VOL', label: 'Volume de commandes', value: orders.length, unit: 'count' },
        { id: 'MARGE', label: 'Marge nette estimée', value: delivered.reduce((s, o) => s + (o.prix_total - o.remuneration_livreur), 0), unit: 'XAF' },
        { id: 'CROISSANCE', label: 'Croissance vs. période précédente', value: 12.4, unit: '%' },
      ],
    };
    return mockOk((cards[dashboard] ?? []).map((c) => ({ ...c, formatted: c.unit === 'XAF' ? formatXaf(c.value) : undefined })));
  }

  kpiSeries(id: 'commandes_7j' | 'livraisons_heure_7j' | 'ca_30j'): Observable<KpiSeries> {
    const orders = this.db.orders();
    const days = id === 'ca_30j' ? 30 : 7;
    const points = Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      if (id === 'commandes_7j') return { label, value: orders.filter((o) => o.cree_le.startsWith(key)).length };
      if (id === 'ca_30j') return { label, value: orders.filter((o) => o.livree_le?.startsWith(key)).reduce((s, o) => s + o.prix_total, 0) };
      const delivered = orders.filter((o) => o.livree_le?.startsWith(key));
      const onTime = delivered.filter((o) => o.a_lheure !== false).length;
      return { label, value: delivered.length ? Math.round((onTime / delivered.length) * 1000) / 10 : 0 };
    });
    return mockOk({
      id, label: id === 'commandes_7j' ? 'Commandes créées' : id === 'ca_30j' ? 'Chiffre d’affaires' : 'Livraisons à l’heure',
      unit: id === 'ca_30j' ? 'XAF' : id === 'commandes_7j' ? 'count' : '%', points,
    });
  }

  finalRecetteChecklist(): Observable<FinalRecetteChecklist[]> {
    const orders = this.db.orders();
    const delivered = orders.filter((o) => o.statut === 'LIVREE');
    const onTimePct = delivered.length ? (delivered.filter((o) => o.a_lheure !== false).length / delivered.length) * 100 : 0;
    const txns = this.db.transactions().filter((t) => t.type === 'PAIEMENT');
    const succeededPct = txns.length ? (txns.filter((t) => t.statut === 'REUSSIE').length / txns.length) * 100 : 0;
    const reconGapPct = this.reconciliationGapPct();

    const rows: FinalRecetteChecklist[] = [
      { code: 'VK-01', label: 'Livraisons à l’heure', seuil: '≥ 88 %', valeur_actuelle: `${onTimePct.toFixed(1)} %`, atteint: onTimePct >= 88 },
      { code: 'VK-02', label: 'Succès de paiement', seuil: '≥ 95 %', valeur_actuelle: `${succeededPct.toFixed(1)} %`, atteint: succeededPct >= 95 },
      { code: 'VK-03', label: 'Affectation automatique', seuil: '≥ 85 %', valeur_actuelle: '91,4 %', atteint: true },
      { code: 'VK-04', label: 'Écart de réconciliation', seuil: '≤ 0,5 %', valeur_actuelle: `${reconGapPct.toFixed(2)} %`, atteint: reconGapPct <= 0.5 },
      { code: 'VK-05', label: 'Incohérences de wallet', seuil: '= 0', valeur_actuelle: '0', atteint: true },
      { code: 'VK-06', label: 'Disponibilité API', seuil: '≥ 99,5 %', valeur_actuelle: '99,7 %', atteint: true },
      { code: 'VK-07', label: 'Plantages mobiles', seuil: '≤ 0,5 %', valeur_actuelle: '0,3 %', atteint: true },
      { code: 'VK-08', label: 'POD complets', seuil: '≥ 99 %', valeur_actuelle: '99,2 %', atteint: true },
      { code: 'VK-09', label: 'Défauts ouverts S1/S2', seuil: '= 0', valeur_actuelle: '0', atteint: true },
      { code: 'VK-10', label: 'Vulnérabilités critiques/hautes', seuil: '= 0', valeur_actuelle: 'À confirmer par le test d’intrusion', atteint: false },
    ];
    return mockOk(rows);
  }

  requestExport(type: string, filtres: string): Observable<ExportJob> {
    const job: ExportJob = { id: uid('exp', Math.random), type, filtres, statut: 'EN_COURS', demande_le: new Date().toISOString() };
    this._exports.update((list) => [job, ...list]);
    setTimeout(() => {
      this._exports.update((list) => list.map((j) => (j.id === job.id
        ? { ...j, statut: 'PRET', pret_le: new Date().toISOString(), expire_le: new Date(Date.now() + 86_400_000).toISOString(), lignes: Math.floor(Math.random() * 5000) + 100 }
        : j)));
    }, 1800);
    return mockOk(job, 150);
  }

  private avg(values: number[]): number {
    if (!values.length) return 0;
    return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
  }

  private reconciliationGapPct(): number {
    const periods = this.db.reconciliationPeriods();
    if (!periods.length) return 0;
    return this.avg(periods.map((p) => p.ecart_pct));
  }
}
