import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WalletService } from '../../../core/services/wallet.service';
import { CreatePayoutAccountRequest, PartnerLedgerMovement, PartnerPayoutAccount } from '../../../core/models';
import { PartnerWalletSummary, PartnerWithdrawal } from '@lvb/models/wallet.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatDateTime, formatXaf } from '@lvb/utils/formatters';
import { I18nService } from '@lvb/i18n/i18n.service';
import { BreadcrumbsComponent } from '@lvb/ui/breadcrumbs/breadcrumbs.component';
import { TabDef, TabsComponent } from '@lvb/ui/tabs/tabs.component';
import { ForbiddenStateComponent } from '@lvb/ui/forbidden-state/forbidden-state.component';
import { StatusBadgeComponent } from '@lvb/ui/status-badge/status-badge.component';
import { StatTileComponent } from '@lvb/ui/stat-tile/stat-tile.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ColumnDef, DataTableComponent } from '@lvb/ui/table/data-table.component';
import { TableCellDefDirective } from '@lvb/ui/table/table-cell-def.directive';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ToastService } from '@lvb/ui/toast/toast.service';

const PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'MTN_MOMO', label: 'MTN Mobile Money' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'BANK', label: 'Compte bancaire' },
];

/**
 * Wallet self-service — `/v1/partner/wallet*` (PartnerLedger,
 * LVB-CDC-MKT-RENT-2026-V1.0). Only RESPONSABLE_PARTENAIRE has
 * `wallet.read`/`wallet.withdraw` — nobody else in the org can see this
 * page at all, and the server enforces that regardless of the client, so a
 * 403 here surfaces as ForbiddenStateComponent like everywhere else.
 */
@Component({
  selector: 'app-wallet-page',
  imports: [
    ReactiveFormsModule, BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent,
    StatTileComponent, SelectComponent, DataTableComponent, TableCellDefDirective, FormFieldComponent,
  ],
  templateUrl: './wallet-page.component.html',
})
export class WalletPageComponent {
  private readonly wallet = inject(WalletService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'balance', label: 'Solde' }, { id: 'accounts', label: 'Comptes de paiement' }, { id: 'withdrawals', label: 'Retraits' },
  ];
  protected readonly activeTab = signal('balance');
  protected readonly providerOptions = PROVIDER_OPTIONS;

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number | null): string {
    return formatXaf(amount);
  }

  constructor() {
    this.fetchSummary();
    this.fetchMovements();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'accounts' && this.payoutAccounts().length === 0 && !this.loadingAccounts()) this.fetchPayoutAccounts();
    if (id === 'withdrawals' && this.withdrawals().length === 0 && !this.loadingWithdrawals()) {
      this.fetchWithdrawals();
      if (this.payoutAccounts().length === 0) this.fetchPayoutAccounts();
    }
  }

  // --- Balance & movements ------------------------------------------------

  protected readonly summary = signal<PartnerWalletSummary | null>(null);
  protected readonly loadingSummary = signal(true);
  protected readonly forbidden = signal(false);

  protected readonly movementColumns: ColumnDef<PartnerLedgerMovement>[] = [
    { key: 'reference', label: 'Référence' },
    { key: 'kind', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'created_at', label: 'Date', cell: (r) => this.dateTime(r.created_at) },
    { key: 'entries', label: 'Mouvements', cell: (r) => r.entries.map((e) => `${e.account}: ${this.xaf(e.amount_xaf)}`).join(' · ') },
  ];
  protected readonly trackByMovementUuid = (row: PartnerLedgerMovement) => row.uuid;

  protected readonly movements = signal<PartnerLedgerMovement[]>([]);
  protected readonly loadingMovements = signal(true);
  protected readonly movementsCursor = signal<number | null>(null);

  fetchSummary(): void {
    this.loadingSummary.set(true);
    this.forbidden.set(false);
    this.wallet.getSummary().subscribe({
      next: (s) => { this.loadingSummary.set(false); this.summary.set(s); },
      error: (err: ProblemDetails) => {
        this.loadingSummary.set(false);
        if (err.status === 403) this.forbidden.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  fetchMovements(cursor?: number): void {
    this.loadingMovements.set(true);
    this.wallet.listMovements({ cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingMovements.set(false);
        this.movements.set(cursor ? [...this.movements(), ...page.items] : page.items);
        this.movementsCursor.set(page.next_cursor);
      },
      error: () => this.loadingMovements.set(false),
    });
  }

  // --- Payout accounts ------------------------------------------------

  protected readonly accountColumns: ColumnDef<PartnerPayoutAccount>[] = [
    { key: 'provider', label: 'Opérateur', cell: (r) => this.providerLabel(r.provider) },
    { key: 'account_last_four', label: 'Numéro', cell: (r) => `•••• ${r.account_last_four}` },
    { key: 'holder_name', label: 'Titulaire' },
    { key: 'verified', label: 'Vérifié', cell: (r) => (r.verified ? 'Oui' : 'En attente de vérification LVB') },
  ];
  protected readonly trackByAccountUuid = (row: PartnerPayoutAccount) => row.uuid;

  protected readonly payoutAccounts = signal<PartnerPayoutAccount[]>([]);
  protected readonly loadingAccounts = signal(false);

  protected readonly accountFormOpen = signal(false);
  protected readonly savingAccount = signal(false);
  protected readonly accountForm = this.fb.nonNullable.group({
    provider: ['MTN_MOMO' as CreatePayoutAccountRequest['provider'], [Validators.required]],
    account_number: ['', [Validators.required, Validators.minLength(4)]],
    holder_name: ['', [Validators.required]],
  });

  providerLabel(provider: string): string {
    return PROVIDER_OPTIONS.find((o) => o.value === provider)?.label ?? provider;
  }

  fetchPayoutAccounts(): void {
    this.loadingAccounts.set(true);
    this.wallet.listPayoutAccounts().subscribe({
      next: (page) => { this.loadingAccounts.set(false); this.payoutAccounts.set(page.items); },
      error: (err: ProblemDetails) => { this.loadingAccounts.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  openNewAccountForm(): void {
    this.accountForm.reset({ provider: 'MTN_MOMO', account_number: '', holder_name: '' });
    this.accountFormOpen.set(true);
  }

  submitAccountForm(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }
    const v = this.accountForm.getRawValue();
    this.savingAccount.set(true);
    this.wallet.createPayoutAccount(v).subscribe({
      next: () => {
        this.savingAccount.set(false);
        this.accountFormOpen.set(false);
        this.toast.success('Compte ajouté — en attente de vérification par LVB');
        this.fetchPayoutAccounts();
      },
      error: (err: ProblemDetails) => { this.savingAccount.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Withdrawals ------------------------------------------------------

  protected readonly withdrawalColumns: ColumnDef<PartnerWithdrawal>[] = [
    { key: 'amount_xaf', label: 'Montant', cell: (r) => this.xaf(r.amount_xaf) },
    { key: 'status', label: 'Statut' },
    { key: 'operator_reference', label: 'Référence opérateur', cell: (r) => r.operator_reference ?? '—' },
    { key: 'created_at', label: 'Demandé le', cell: (r) => this.dateTime(r.created_at) },
  ];
  protected readonly trackByWithdrawalUuid = (row: PartnerWithdrawal) => row.uuid;

  protected readonly withdrawals = signal<PartnerWithdrawal[]>([]);
  protected readonly loadingWithdrawals = signal(false);

  protected readonly withdrawalFormOpen = signal(false);
  protected readonly submittingWithdrawal = signal(false);
  protected readonly withdrawalPayoutAccount = signal('');
  protected readonly withdrawalAmount = signal<number | null>(null);

  protected readonly verifiedAccountOptions = () => this.payoutAccounts()
    .filter((a) => a.verified)
    .map((a): SelectOption => ({ value: a.uuid, label: `${this.providerLabel(a.provider)} •••• ${a.account_last_four}` }));

  fetchWithdrawals(): void {
    this.loadingWithdrawals.set(true);
    this.wallet.listWithdrawals().subscribe({
      next: (page) => { this.loadingWithdrawals.set(false); this.withdrawals.set(page.items); },
      error: (err: ProblemDetails) => { this.loadingWithdrawals.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  openWithdrawalForm(): void {
    this.withdrawalPayoutAccount.set('');
    this.withdrawalAmount.set(null);
    this.withdrawalFormOpen.set(true);
  }

  onWithdrawalPayoutAccountChange(value: string): void {
    this.withdrawalPayoutAccount.set(value);
  }

  onWithdrawalAmountInput(value: string): void {
    const n = Number.parseInt(value, 10);
    this.withdrawalAmount.set(Number.isFinite(n) ? n : null);
  }

  submitWithdrawal(): void {
    const payoutAccountUuid = this.withdrawalPayoutAccount();
    const amount = this.withdrawalAmount();
    if (!payoutAccountUuid || !amount) return;
    this.submittingWithdrawal.set(true);
    this.wallet.requestWithdrawal({ payout_account_uuid: payoutAccountUuid, amount_xaf: amount }).subscribe({
      next: () => {
        this.submittingWithdrawal.set(false);
        this.withdrawalFormOpen.set(false);
        this.toast.success('Demande de retrait envoyée');
        this.fetchWithdrawals();
        this.fetchSummary();
      },
      error: (err: ProblemDetails) => { this.submittingWithdrawal.set(false); this.toast.error('Échec', err.detail); },
    });
  }
}
