import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FinanceService } from '../../../core/services/finance.service';
import { WithdrawalsService } from '../../../core/services/withdrawals.service';
import {
  DriverWallet, ProblemDetails, ReconciliationDomain, ReconciliationGap, ReconciliationPeriod, WithdrawalRequest,
  WithdrawalStatus,
} from '../../../core/models';
import { formatDateTime, formatPercent, formatXaf } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, ColumnDef, ConfirmService, DataTableComponent, EmptyStateComponent,
  ModalComponent, StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
} from '../../../shared/ui';

const DOMAIN_LABELS: Record<ReconciliationDomain, string> = {
  MOBILE_MONEY: 'Mobile Money', COD: 'Paiement à la livraison (COD)', RETRAITS_LIVREURS: 'Retraits livreurs',
};
const GAP_LABELS: Record<ReconciliationGap['nature'], string> = {
  PLATEFORME_SANS_OPERATEUR: 'Transaction plateforme sans correspondance opérateur',
  OPERATEUR_SANS_PLATEFORME: 'Paiement orphelin (opérateur sans commande)',
  ECART_MONTANT: 'Écart de montant', DOUBLON_SUSPECTE: 'Doublon suspecté',
};

@Component({
  selector: 'app-finance-page',
  imports: [DataTableComponent, TableCellDefDirective, StatusBadgeComponent, TabsComponent, EmptyStateComponent, BreadcrumbsComponent, ModalComponent, AlertBannerComponent],
  templateUrl: './finance-page.component.html',
})
export class FinancePageComponent {
  private readonly financeService = inject(FinanceService);
  private readonly withdrawalsService = inject(WithdrawalsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly domainLabels = DOMAIN_LABELS;
  protected readonly gapLabels = GAP_LABELS;
  protected readonly domains: ReconciliationDomain[] = ['MOBILE_MONEY', 'COD', 'RETRAITS_LIVREURS'];

  protected readonly tabs: TabDef[] = [
    { id: 'reconciliation', label: 'Réconciliation' }, { id: 'withdrawals', label: 'Retraits' }, { id: 'wallets', label: 'Portefeuilles' },
  ];
  protected readonly activeTab = signal('reconciliation');

  // --- Réconciliation -------------------------------------------------------
  protected readonly domain = signal<ReconciliationDomain>('MOBILE_MONEY');
  protected readonly periods = signal<ReconciliationPeriod[]>([]);
  protected readonly loadingPeriods = signal(true);
  protected readonly selectedPeriod = signal<ReconciliationPeriod | null>(null);
  protected readonly closingPeriod = signal(false);

  protected readonly pendingGapsCount = computed(() => this.selectedPeriod()?.ecarts.filter((g) => !g.qualifie).length ?? 0);

  // --- Retraits -------------------------------------------------------------
  protected readonly withdrawals = signal<WithdrawalRequest[]>([]);
  protected readonly loadingWithdrawals = signal(true);
  protected readonly withdrawalFilter = signal<WithdrawalStatus | 'TOUS'>('EN_ATTENTE');
  protected readonly withdrawalColumns: ColumnDef<WithdrawalRequest>[] = [
    { key: 'livreur_nom', label: 'Livreur' },
    { key: 'montant', label: 'Montant', align: 'right', cell: (w) => formatXaf(w.montant) },
    { key: 'solde_disponible_au_moment', label: 'Solde disponible', align: 'right', cell: (w) => formatXaf(w.solde_disponible_au_moment) },
    { key: 'encours_cod_au_moment', label: 'Encours COD', align: 'right', cell: (w) => formatXaf(w.encours_cod_au_moment) },
    { key: 'statut', label: 'Statut' },
    { key: 'cree_le', label: 'Demandé le', cell: (w) => formatDateTime(w.cree_le) },
  ];

  protected readonly rejectTarget = signal<WithdrawalRequest | null>(null);
  protected readonly rejectMotif = signal('');

  // --- Portefeuilles ----------------------------------------------------------
  protected readonly wallets = signal<DriverWallet[]>([]);
  protected readonly loadingWallets = signal(true);
  protected readonly coherenceOk = signal(true);
  protected readonly selectedWallet = signal<DriverWallet | null>(null);
  protected readonly walletColumns: ColumnDef<DriverWallet>[] = [
    { key: 'livreur_nom', label: 'Livreur' },
    { key: 'solde_disponible', label: 'Solde disponible', align: 'right', cell: (w) => formatXaf(w.solde_disponible) },
    { key: 'encours_cod', label: 'Encours COD', align: 'right', cell: (w) => formatXaf(w.encours_cod) },
    { key: 'plafond_cod', label: 'Plafond', align: 'right', cell: (w) => formatXaf(w.plafond_cod) },
  ];

  constructor() {
    this.fetchPeriods();
    this.fetchWithdrawals();
    this.fetchWallets();
  }

  selectTab(id: string): void { this.activeTab.set(id); }

  // --- Réconciliation ---------------------------------------------------------
  selectDomain(d: ReconciliationDomain): void {
    this.domain.set(d);
    this.selectedPeriod.set(null);
    this.fetchPeriods();
  }

  private fetchPeriods(): void {
    this.loadingPeriods.set(true);
    this.financeService.reconciliationPeriods(this.domain()).subscribe((res) => {
      this.periods.set(res);
      this.loadingPeriods.set(false);
    });
  }

  openPeriod(period: ReconciliationPeriod): void {
    this.selectedPeriod.set(period);
  }

  qualifyGap(gap: ReconciliationGap, action: 'REMBOURSEMENT' | 'REGULARISATION' | 'ENQUETE'): void {
    const period = this.selectedPeriod();
    if (!period) return;
    this.financeService.qualifyGap(period.id, gap.id, action).subscribe((updated) => {
      this.selectedPeriod.set(updated);
      this.fetchPeriods();
      this.toast.success('Écart qualifié');
    });
  }

  async closePeriod(): Promise<void> {
    const period = this.selectedPeriod();
    if (!period) return;
    const ok = await this.confirm.ask({
      title: 'Clôturer la période', danger: true, confirmLabel: 'Clôturer',
      message: 'Une période clôturée ne peut plus être modifiée — toute correction ultérieure passera par une écriture de régularisation. Continuer ?',
    });
    if (!ok) return;
    this.closingPeriod.set(true);
    this.financeService.closePeriod(period.id).subscribe({
      next: (updated) => {
        this.closingPeriod.set(false);
        this.selectedPeriod.set(updated);
        this.fetchPeriods();
        this.toast.success('Période clôturée');
      },
      error: (err: ProblemDetails) => { this.closingPeriod.set(false); this.toast.error('Clôture impossible', err.detail); },
    });
  }

  // --- Retraits ---------------------------------------------------------------
  private fetchWithdrawals(): void {
    this.loadingWithdrawals.set(true);
    this.withdrawalsService.list(this.withdrawalFilter()).subscribe((res) => {
      this.withdrawals.set(res);
      this.loadingWithdrawals.set(false);
    });
  }

  filterWithdrawals(status: WithdrawalStatus | 'TOUS'): void {
    this.withdrawalFilter.set(status);
    this.fetchWithdrawals();
  }

  isAtRisk(w: WithdrawalRequest): boolean {
    return w.encours_cod_au_moment > w.solde_disponible_au_moment;
  }

  approveWithdrawal(w: WithdrawalRequest): void {
    this.withdrawalsService.approve(w.id).subscribe({
      next: () => { this.fetchWithdrawals(); this.toast.success('Retrait validé'); },
      error: (err: ProblemDetails) => this.toast.error('Retrait refusé', err.detail),
    });
  }

  markPaid(w: WithdrawalRequest): void {
    this.withdrawalsService.markPaid(w.id).subscribe(() => {
      this.fetchWithdrawals();
      this.fetchWallets();
      this.toast.success('Versement confirmé');
    });
  }

  openReject(w: WithdrawalRequest): void {
    this.rejectMotif.set('');
    this.rejectTarget.set(w);
  }

  confirmReject(): void {
    const w = this.rejectTarget();
    const motif = this.rejectMotif();
    if (!w || !motif.trim()) return;
    this.withdrawalsService.reject(w.id, motif).subscribe(() => {
      this.rejectTarget.set(null);
      this.fetchWithdrawals();
      this.toast.info('Retrait rejeté');
    });
  }

  // --- Portefeuilles --------------------------------------------------------
  private fetchWallets(): void {
    this.loadingWallets.set(true);
    this.financeService.wallets().subscribe((res) => {
      this.wallets.set(res);
      this.loadingWallets.set(false);
    });
    this.financeService.walletCoherenceCheck().subscribe((res) => this.coherenceOk.set(res.ok));
  }

  openWallet(w: DriverWallet): void { this.selectedWallet.set(w); }

  formatXaf(v: number): string { return formatXaf(v); }
  formatDateTime(v?: string): string { return formatDateTime(v); }
  formatPercent(v: number): string { return formatPercent(v); }
}
