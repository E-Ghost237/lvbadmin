import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AdminWithdrawal, FinanceService, ReconciliationDetail, ReconciliationItem, ReconciliationPeriod,
} from '../../../core/services/finance.service';
import {
  ProblemDetails, ReconciliationResolutionAction, ReconciliationStatus, WithdrawalStatus,
} from '../../../core/models';
import { formatDateTime, formatPercent, formatXaf, humanizeSlug } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  ColumnDef,
  ConfirmService,
  DataTableComponent,
  ForbiddenStateComponent,
  FormFeedbackService,
  FormFieldComponent,
  ModalComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectOption,
  StatusBadgeComponent,
  TabDef,
  TableCellDefDirective,
  TabsComponent,
  ToastService,
} from '../../../shared/ui';

const WITHDRAWAL_STATUSES: WithdrawalStatus[] = ['EN_ATTENTE', 'EN_COURS', 'PAYE', 'REJETE', 'ECHEC'];
const RECONCILIATION_STATUSES: ReconciliationStatus[] = ['OUVERTE', 'CLOTUREE'];

const GAP_KIND_LABELS: Record<string, string> = {
  PLATEFORME_SANS_OPERATEUR: 'Plateforme sans opérateur', OPERATEUR_SANS_PLATEFORME: 'Opérateur sans plateforme',
  ECART_MONTANT: 'Écart de montant', DOUBLON_SUSPECTE: 'Doublon suspecté',
};
const RESOLUTION_ACTION_LABELS: Record<ReconciliationResolutionAction, string> = {
  REMBOURSEMENT: 'Remboursement', REGULARISATION: 'Régularisation', ENQUETE: 'Enquête',
};
const RESOLUTION_ACTION_OPTIONS: SelectOption[] = (Object.keys(RESOLUTION_ACTION_LABELS) as ReconciliationResolutionAction[])
  .map((value) => ({ value, label: RESOLUTION_ACTION_LABELS[value] }));

/** UC-ADM-15/16 — /v1/admin/withdrawals + /v1/admin/reconciliation (Ledger module). */
@Component({
  selector: 'app-finance-page',
  imports: [
  DataTableComponent,
  ForbiddenStateComponent,
  FormFieldComponent,
  ModalComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  SelectComponent,
  StatusBadgeComponent,
  TableCellDefDirective,
  TabsComponent,
],
  templateUrl: './finance-page.component.html',
})
export class FinancePageComponent {
  private readonly finance = inject(FinanceService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [{ id: 'withdrawals', label: 'Retraits' }, { id: 'reconciliation', label: 'Rapprochement' }];
  protected readonly activeTab = signal('withdrawals');
  protected readonly withdrawalStatuses = WITHDRAWAL_STATUSES;
  protected readonly reconciliationStatuses = RECONCILIATION_STATUSES;
  protected readonly resolutionActionOptions = RESOLUTION_ACTION_OPTIONS;
  protected readonly withdrawalStatusOptions = computed<SelectOption[]>(() =>
    this.withdrawalStatuses.map((s) => ({ value: s, label: this.i18n.t('status.withdrawal.' + s) })));
  protected readonly reconciliationStatusOptions = computed<SelectOption[]>(() =>
    this.reconciliationStatuses.map((s) => ({ value: s, label: this.i18n.t('status.reconciliation.' + s) })));
  gapKindLabel(nature: string): string {
    return GAP_KIND_LABELS[nature] ?? humanizeSlug(nature);
  }

  resolutionActionLabel(action: string | null): string {
    if (!action) return '—';
    return RESOLUTION_ACTION_LABELS[action as ReconciliationResolutionAction] ?? humanizeSlug(action);
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'reconciliation' && this.periods().length === 0) this.fetchPeriods();
  }

  // --- Withdrawals ---------------------------------------------------------
  protected readonly withdrawalColumns: ColumnDef<AdminWithdrawal>[] = [
    { key: 'livreur_id', label: 'Livreur', cell: (r) => `Livreur #${r.livreur_id}` },
    { key: 'numero_momo', label: 'Numéro Mobile Money' },
    { key: 'montant_xaf', label: 'Montant', align: 'right', cell: (r) => formatXaf(r.montant_xaf) },
    { key: 'statut', label: 'Statut' },
    { key: 'demandee_le', label: 'Demandé le', cell: (r) => formatDateTime(r.demandee_le) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByWithdrawalUuid = (row: AdminWithdrawal) => row.uuid;

  protected readonly withdrawals = signal<AdminWithdrawal[]>([]);
  protected readonly loadingWithdrawals = signal(true);
  protected readonly forbiddenWithdrawals = signal(false);
  protected readonly withdrawalsCursor = signal<string | null>(null);
  protected readonly withdrawalStatusFilter = signal<WithdrawalStatus | ''>('');
  protected readonly decidingWithdrawal = signal<string | null>(null);

  constructor() {
    this.fetchWithdrawals();
  }

  fetchWithdrawals(cursor?: string): void {
    this.loadingWithdrawals.set(true);
    this.forbiddenWithdrawals.set(false);
    this.finance.listWithdrawals({ status: this.withdrawalStatusFilter() || undefined, cursor }).subscribe({
      next: (page) => {
        this.loadingWithdrawals.set(false);
        this.withdrawals.set(cursor ? [...this.withdrawals(), ...page.items] : page.items);
        this.withdrawalsCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingWithdrawals.set(false);
        if (err.status === 403) this.forbiddenWithdrawals.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onWithdrawalStatusFilterChange(value: string): void {
    this.withdrawalStatusFilter.set(value as WithdrawalStatus | '');
    this.fetchWithdrawals();
  }

  async approveWithdrawal(row: AdminWithdrawal): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Approuver ce retrait ?', message: `${formatXaf(row.montant_xaf)} seront versés au ${row.numero_momo}.`,
    });
    if (!ok) return;
    this.decidingWithdrawal.set(row.uuid);
    this.finance.approveWithdrawal(row.uuid).subscribe({
      next: () => {
        this.decidingWithdrawal.set(null);
        this.toast.success('Retrait approuvé et versé');
        this.fetchWithdrawals();
      },
      error: (err: ProblemDetails) => {
        this.decidingWithdrawal.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  async rejectWithdrawal(row: AdminWithdrawal): Promise<void> {
    const reason = await this.confirm.askReason({
      title: 'Rejeter ce retrait ?', label: 'Motif du rejet', minLength: 5, danger: true, confirmLabel: 'Rejeter',
    });
    if (!reason) return;
    this.decidingWithdrawal.set(row.uuid);
    this.finance.rejectWithdrawal(row.uuid, reason).subscribe({
      next: () => {
        this.decidingWithdrawal.set(null);
        this.toast.success('Retrait rejeté');
        this.fetchWithdrawals();
      },
      error: (err: ProblemDetails) => {
        this.decidingWithdrawal.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Reconciliation --------------------------------------------------
  protected readonly periodColumns: ColumnDef<ReconciliationPeriod>[] = [
    { key: 'from', label: 'Période', cell: (r) => `${this.dateOnly(r.from)} → ${this.dateOnly(r.to)}` },
    { key: 'statut', label: 'Statut' },
    { key: 'expected_amount_xaf', label: 'Attendu', align: 'right', cell: (r) => formatXaf(r.expected_amount_xaf) },
    { key: 'statement_amount_xaf', label: 'Relevé', align: 'right', cell: (r) => formatXaf(r.statement_amount_xaf) },
    { key: 'gap_xaf', label: 'Écart', align: 'right', cell: (r) => `${formatXaf(r.gap_xaf)} (${formatPercent(r.gap_rate * 100)})` },
    { key: 'created_at', label: 'Créée le', cell: (r) => formatDateTime(r.created_at) },
  ];
  protected readonly trackByPeriodUuid = (row: ReconciliationPeriod) => row.uuid;

  protected readonly periods = signal<ReconciliationPeriod[]>([]);
  protected readonly loadingPeriods = signal(true);
  protected readonly forbiddenPeriods = signal(false);
  protected readonly periodsCursor = signal<string | null>(null);
  protected readonly periodStatusFilter = signal<ReconciliationStatus | ''>('');

  fetchPeriods(cursor?: string): void {
    this.loadingPeriods.set(true);
    this.forbiddenPeriods.set(false);
    this.finance.listReconciliationPeriods({ status: this.periodStatusFilter() || undefined, cursor }).subscribe({
      next: (page) => {
        this.loadingPeriods.set(false);
        this.periods.set(cursor ? [...this.periods(), ...page.items] : page.items);
        this.periodsCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingPeriods.set(false);
        if (err.status === 403) this.forbiddenPeriods.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onPeriodStatusFilterChange(value: string): void {
    this.periodStatusFilter.set(value as ReconciliationStatus | '');
    this.fetchPeriods();
  }

  // --- Period detail / item resolution -------------------------------------
  protected readonly selectedPeriod = signal<ReconciliationDetail | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly resolvingItem = signal<ReconciliationItem | null>(null);
  protected readonly resolvingSubmit = signal(false);
  protected readonly closingPeriod = signal(false);
  protected readonly resolveForm = this.fb.nonNullable.group({
    action: ['REMBOURSEMENT' as ReconciliationResolutionAction, [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });

  openPeriod(period: ReconciliationPeriod): void {
    this.loadingDetail.set(true);
    this.selectedPeriod.set(null);
    this.finance.getReconciliationPeriod(period.uuid).subscribe({
      next: (detail) => {
        this.loadingDetail.set(false);
        this.selectedPeriod.set(detail);
      },
      error: (err: ProblemDetails) => {
        this.loadingDetail.set(false);
        this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  closeDetail(): void {
    this.selectedPeriod.set(null);
    this.resolvingItem.set(null);
  }

  private refreshDetail(): void {
    const period = this.selectedPeriod();
    if (!period) return;
    this.finance.getReconciliationPeriod(period.uuid).subscribe((detail) => this.selectedPeriod.set(detail));
    this.fetchPeriods();
  }

  openResolve(item: ReconciliationItem): void {
    this.resolveForm.reset({ action: 'REMBOURSEMENT', reason: '' });
    this.resolvingItem.set(item);
  }

  confirmResolve(): void {
    const period = this.selectedPeriod();
    const item = this.resolvingItem();
    if (!period || !item || this.resolveForm.invalid) {
      this.feedback.invalid(this.resolveForm);
      return;
    }
    const v = this.resolveForm.getRawValue();
    this.resolvingSubmit.set(true);
    this.finance.resolveReconciliationItem(period.uuid, item.uuid, v.action, v.reason).subscribe({
      next: () => {
        this.resolvingSubmit.set(false);
        this.resolvingItem.set(null);
        this.toast.success('Écart qualifié');
        this.refreshDetail();
      },
      error: (err: ProblemDetails) => {
        this.resolvingSubmit.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  async closePeriod(): Promise<void> {
    const period = this.selectedPeriod();
    if (!period) return;
    const ok = await this.confirm.ask({
      title: 'Clôturer cette période ?', message: 'Un rapport signé sera généré. Cette action est définitive.', danger: true,
    });
    if (!ok) return;
    this.closingPeriod.set(true);
    this.finance.closeReconciliationPeriod(period.uuid).subscribe({
      next: () => {
        this.closingPeriod.set(false);
        this.toast.success('Période clôturée');
        this.closeDetail();
        this.fetchPeriods();
      },
      error: (err: ProblemDetails) => {
        this.closingPeriod.set(false);
        this.toast.error('Échec de la clôture', err.detail);
      },
    });
  }

  hasOpenItems(detail: ReconciliationDetail): boolean {
    return detail.discrepancies.some((d) => d.status === 'OUVERT');
  }

  dateOnly(iso: string): string {
    return iso.slice(0, 10);
  }

  xaf(amount: number): string {
    return formatXaf(amount);
  }

  percent(rate: number): string {
    return formatPercent(rate * 100);
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }
}
