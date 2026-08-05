import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DriversService } from '../../../core/services/drivers.service';
import { FinanceService } from '../../../core/services/finance.service';
import { Driver, DriverSanction, DriverWallet } from '../../../core/models';
import { formatDate, formatXaf } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, AvatarComponent, BreadcrumbsComponent, EmptyStateComponent, FormFieldComponent, ModalComponent,
  StatusBadgeComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-driver-detail',
  imports: [ReactiveFormsModule, RouterLink, AvatarComponent, StatusBadgeComponent, BreadcrumbsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent, EmptyStateComponent],
  templateUrl: './driver-detail.component.html',
})
export class DriverDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly driversService = inject(DriversService);
  private readonly financeService = inject(FinanceService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly driver = signal<Driver | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly sanctions = signal<DriverSanction[]>([]);
  protected readonly wallet = signal<DriverWallet | null>(null);

  protected readonly permisDaysLeft = computed(() => this.daysLeft(this.driver()?.permis_expire_le));
  protected readonly assuranceDaysLeft = computed(() => this.daysLeft(this.driver()?.assurance_expire_le));

  protected readonly showSuspendModal = signal(false);
  protected readonly suspendForm = this.fb.nonNullable.group({ motif: ['', [Validators.required]] });
  protected readonly suspending = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.driversService.get(id).subscribe({
      next: (d) => {
        this.driver.set(d);
        this.loading.set(false);
        this.driversService.sanctionsFor(id).subscribe((s) => this.sanctions.set(s));
        if (this.auth.hasPermission('wallet.read')) {
          this.financeService.walletDetail(id).subscribe((w) => this.wallet.set(w));
        }
      },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  private daysLeft(iso?: string): number | null {
    if (!iso) return null;
    return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  }

  openSuspend(): void {
    this.suspendForm.reset({ motif: '' });
    this.showSuspendModal.set(true);
  }

  confirmSuspend(): void {
    if (this.suspendForm.invalid) {
      this.suspendForm.markAllAsTouched();
      return;
    }
    const d = this.driver();
    if (!d) return;
    this.suspending.set(true);
    this.driversService.suspend(d.id, this.suspendForm.getRawValue().motif).subscribe((updated) => {
      this.suspending.set(false);
      this.showSuspendModal.set(false);
      this.driver.set(updated);
      this.toast.success('Livreur suspendu');
    });
  }

  reactivate(): void {
    const d = this.driver();
    if (!d) return;
    this.driversService.reactivate(d.id).subscribe((updated) => {
      this.driver.set(updated);
      this.toast.success('Livreur réactivé');
    });
  }

  formatXaf(v: number): string { return formatXaf(v); }
  formatDate(v?: string): string { return formatDate(v); }
}
