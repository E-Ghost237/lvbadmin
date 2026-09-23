import { Component, computed, inject, signal } from '@angular/core';
import { WalletService } from '../../../core/services/wallet.service';
import { PartnersService } from '../../../core/services/partners.service';
import {
  PARTNER_WITHDRAWAL_STATUS_VALUES, Partner, PartnerWalletReconciliation, PartnerWalletSummary, PartnerWithdrawal,
  PartnerWithdrawalStatus, ProblemDetails, WITHDRAWAL_ACTIONS, WalletAdjustmentKind, WithdrawalDecisionAction,
} from '../../../core/models';
import { formatDateTime, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, ConfirmService, DataTableComponent, ForbiddenStateComponent, ModalComponent,
  SelectComponent, SelectOption, StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
} from '../../../shared/ui';

const WITHDRAWAL_ACTION_LABEL: Record<WithdrawalDecisionAction, string> = {
  review: 'Mettre en validation', approve: 'Approuver', processing: 'Lancer le paiement',
  confirm: 'Confirmer le paiement', reject: 'Rejeter', cancel: 'Annuler', fail: 'Marquer en échec',
};
const WITHDRAWAL_ACTION_DANGER: Partial<Record<WithdrawalDecisionAction, boolean>> = {
  reject: true, cancel: true, fail: true,
};

interface WithdrawalAction {
  action: WithdrawalDecisionAction;
  label: string;
  danger: boolean;
}

const ADJUSTMENT_KIND_OPTIONS: SelectOption[] = [
  { value: 'adjustment', label: 'Ajustement' },
  { value: 'penalty', label: 'Pénalité (débit uniquement)' },
];

/**
 * Admin side of the Partner Wallet / Ledger module (PartnerLedger,
 * LVB-CDC-MKT-RENT-2026-V1.0) — `/v1/admin/partner-wallet/*`. Kept as its
 * own page (distinct from both the Marketplace oversight page and the base
 * Finance page's unrelated driver-withdrawal ledger) because it sits behind
 * its own `partner-wallet.view`/`.manage` permissions — the FINANCE role
 * gets those without `marketplace.manage`/`fleet.manage`/`booking.manage`.
 */
@Component({
  selector: 'app-wallet-page',
  imports: [
    BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent, SelectComponent,
    DataTableComponent, TableCellDefDirective, ModalComponent,
  ],
  templateUrl: './wallet-page.component.html',
})
export class WalletPageComponent {
  private readonly wallet = inject(WalletService);
  private readonly partners = inject(PartnersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'withdrawals', label: 'Retraits' }, { id: 'reconciliation', label: 'Réconciliation' },
    { id: 'adjustments', label: 'Ajustements' },
  ];
  protected readonly activeTab = signal('withdrawals');
  protected readonly adjustmentKindOptions = ADJUSTMENT_KIND_OPTIONS;

  constructor() {
    this.fetchWithdrawals();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number | null): string {
    return formatXaf(amount);
  }

  // --- Withdrawals ----------------------------------------------------------
  // No partner filter and no cursor server-side — the list is capped at the
  // 100 most recent withdrawals across every partner (see WalletService).

  protected readonly withdrawalStatusOptions: SelectOption[] = PARTNER_WITHDRAWAL_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.partnerWithdrawal.' + s),
  }));
  protected readonly withdrawalColumns: ColumnDef<PartnerWithdrawal>[] = [
    { key: 'payout_account_uuid', label: 'Compte de paiement' },
    { key: 'amount_xaf', label: 'Montant', cell: (r) => formatXaf(r.amount_xaf) },
    { key: 'status', label: 'Statut' },
    { key: 'operator_reference', label: 'Référence opérateur', cell: (r) => r.operator_reference ?? '—' },
    { key: 'created_at', label: 'Demandé le', cell: (r) => formatDateTime(r.created_at) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByWithdrawalUuid = (row: PartnerWithdrawal) => row.uuid;

  protected readonly withdrawals = signal<PartnerWithdrawal[]>([]);
  protected readonly loadingWithdrawals = signal(true);
  protected readonly forbiddenWithdrawals = signal(false);
  protected readonly withdrawalStatusFilter = signal<PartnerWithdrawalStatus | ''>('');
  protected readonly decidingWithdrawal = signal<string | null>(null);
  protected readonly verifyingAccount = signal<string | null>(null);

  protected readonly confirmingWithdrawal = signal<PartnerWithdrawal | null>(null);
  protected readonly confirmReason = signal('');
  protected readonly confirmOperatorReference = signal('');
  protected readonly submittingConfirm = signal(false);

  fetchWithdrawals(): void {
    this.loadingWithdrawals.set(true);
    this.forbiddenWithdrawals.set(false);
    this.wallet.listWithdrawals(this.withdrawalStatusFilter() || undefined).subscribe({
      next: (page) => { this.loadingWithdrawals.set(false); this.withdrawals.set(page.items); },
      error: (err: ProblemDetails) => {
        this.loadingWithdrawals.set(false);
        if (err.status === 403) this.forbiddenWithdrawals.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onWithdrawalStatusFilterChange(value: string): void {
    this.withdrawalStatusFilter.set(value as PartnerWithdrawalStatus | '');
    this.fetchWithdrawals();
  }

  actionsFor(row: PartnerWithdrawal): WithdrawalAction[] {
    return WITHDRAWAL_ACTIONS[row.status].map((action) => ({
      action, label: WITHDRAWAL_ACTION_LABEL[action], danger: !!WITHDRAWAL_ACTION_DANGER[action],
    }));
  }

  async applyWithdrawalAction(row: PartnerWithdrawal, def: WithdrawalAction): Promise<void> {
    if (def.action === 'confirm') {
      this.confirmingWithdrawal.set(row);
      this.confirmReason.set('');
      this.confirmOperatorReference.set('');
      return;
    }
    const reason = await this.confirm.askReason({
      title: `${def.label} ce retrait ?`, label: 'Motif', minLength: 3,
      danger: def.danger, confirmLabel: def.label,
    });
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    this.decidingWithdrawal.set(row.uuid);
    this.wallet.decideWithdrawal(row.uuid, def.action, trimmed).subscribe({
      next: () => { this.decidingWithdrawal.set(null); this.toast.success('Retrait mis à jour'); this.fetchWithdrawals(); },
      error: (err: ProblemDetails) => { this.decidingWithdrawal.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  closeConfirmForm(): void {
    this.confirmingWithdrawal.set(null);
  }

  onConfirmReasonInput(value: string): void {
    this.confirmReason.set(value);
  }

  onConfirmOperatorReferenceInput(value: string): void {
    this.confirmOperatorReference.set(value);
  }

  submitConfirmWithdrawal(): void {
    const row = this.confirmingWithdrawal();
    const reason = this.confirmReason().trim();
    const operatorRef = this.confirmOperatorReference().trim();
    if (!row || !reason || !operatorRef) return;
    this.submittingConfirm.set(true);
    this.wallet.decideWithdrawal(row.uuid, 'confirm', reason, operatorRef).subscribe({
      next: () => {
        this.submittingConfirm.set(false);
        this.confirmingWithdrawal.set(null);
        this.toast.success('Paiement confirmé');
        this.fetchWithdrawals();
      },
      error: (err: ProblemDetails) => { this.submittingConfirm.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  async verifyPayoutAccount(row: PartnerWithdrawal): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Vérifier ce compte de paiement ?',
      message: `Compte ${row.payout_account_uuid} — utilisé par le retrait en cours.`, confirmLabel: 'Vérifier',
    });
    if (!ok) return;
    this.verifyingAccount.set(row.uuid);
    this.wallet.verifyPayoutAccount(row.payout_account_uuid).subscribe({
      next: () => { this.verifyingAccount.set(null); this.toast.success('Compte vérifié'); },
      error: (err: ProblemDetails) => { this.verifyingAccount.set(null); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Reconciliation ---------------------------------------------------
  // Stateless, computed live on every call — no persisted run history.

  protected readonly reconciliation = signal<PartnerWalletReconciliation | null>(null);
  protected readonly loadingReconciliation = signal(false);

  runReconciliation(): void {
    this.loadingReconciliation.set(true);
    this.wallet.reconciliation().subscribe({
      next: (report) => { this.loadingReconciliation.set(false); this.reconciliation.set(report); },
      error: (err: ProblemDetails) => { this.loadingReconciliation.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  // --- Adjustments --------------------------------------------------------

  protected readonly adjustPartnerUuidInput = signal('');
  protected readonly adjustPartner = signal<Partner | null>(null);
  protected readonly loadingAdjustPartner = signal(false);
  protected readonly adjustAmountInput = signal('');
  protected readonly adjustKind = signal<WalletAdjustmentKind>('adjustment');
  protected readonly adjustReason = signal('');
  protected readonly submittingAdjustment = signal(false);
  protected readonly adjustResult = signal<PartnerWalletSummary | null>(null);

  protected readonly adjustAmountInvalid = computed(() => {
    const amount = Number.parseInt(this.adjustAmountInput(), 10);
    if (!Number.isFinite(amount) || amount === 0) return true;
    if (this.adjustKind() === 'penalty' && amount >= 0) return true;
    return false;
  });

  onAdjustPartnerUuidInput(value: string): void {
    this.adjustPartnerUuidInput.set(value);
    this.adjustPartner.set(null);
    this.adjustResult.set(null);
  }

  lookupAdjustPartner(): void {
    const uuid = this.adjustPartnerUuidInput().trim();
    if (!uuid) return;
    this.loadingAdjustPartner.set(true);
    this.partners.get(uuid).subscribe({
      next: (partner) => { this.loadingAdjustPartner.set(false); this.adjustPartner.set(partner); },
      error: (err: ProblemDetails) => { this.loadingAdjustPartner.set(false); this.toast.error('Partenaire introuvable', err.detail); },
    });
  }

  onAdjustAmountInput(value: string): void {
    this.adjustAmountInput.set(value);
  }

  onAdjustKindChange(value: string): void {
    this.adjustKind.set(value as WalletAdjustmentKind);
  }

  onAdjustReasonInput(value: string): void {
    this.adjustReason.set(value);
  }

  submitAdjustment(): void {
    const partner = this.adjustPartner();
    const amount = Number.parseInt(this.adjustAmountInput(), 10);
    const reason = this.adjustReason().trim();
    if (!partner || this.adjustAmountInvalid() || !reason) return;
    this.submittingAdjustment.set(true);
    this.wallet.adjust(partner.uuid, amount, this.adjustKind(), reason).subscribe({
      next: (summary) => {
        this.submittingAdjustment.set(false);
        this.adjustResult.set(summary);
        this.adjustReason.set('');
        this.adjustAmountInput.set('');
        this.toast.success('Ajustement appliqué');
      },
      error: (err: ProblemDetails) => { this.submittingAdjustment.set(false); this.toast.error('Échec', err.detail); },
    });
  }
}
