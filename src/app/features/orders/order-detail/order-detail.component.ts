import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { OrdersService } from '../../../core/services/orders.service';
import { CancellationQuote, CancellationReason, Driver, Order, ProblemDetails } from '../../../core/models';
import { isCancellable } from '../../../core/utils/cancellation';
import { formatDateTime, formatPhone, formatXaf } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, ConfirmService, EmptyStateComponent, FormFieldComponent,
  ModalComponent, StatusBadgeComponent, ToastService,
} from '../../../shared/ui';

const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: 'ERREUR_ADRESSE', label: 'Erreur d’adresse' }, { value: 'ERREUR_COLIS', label: 'Erreur de colis' },
  { value: 'PLUS_BESOIN', label: 'Plus besoin' }, { value: 'TROP_CHER', label: 'Trop cher' },
  { value: 'TROP_LONG', label: 'Trop long' }, { value: 'LIVREUR_INJOIGNABLE', label: 'Livreur injoignable' },
  { value: 'AUTRE', label: 'Autre' },
];

@Component({
  selector: 'app-order-detail',
  imports: [ReactiveFormsModule, RouterLink, StatusBadgeComponent, BreadcrumbsComponent, ModalComponent, FormFieldComponent, AlertBannerComponent, EmptyStateComponent],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);

  protected readonly cancelReasons = CANCEL_REASONS;
  protected readonly showCancelModal = signal(false);
  protected readonly cancelQuote = computed<CancellationQuote | null>(() => {
    const o = this.order();
    return o ? this.ordersService.quoteCancellation(o) : null;
  });
  protected readonly cancellable = computed(() => {
    const o = this.order();
    return o ? isCancellable(o) : false;
  });
  protected readonly cancelForm = this.fb.nonNullable.group({
    reason: ['PLUS_BESOIN', [Validators.required]],
    note: [''],
  });
  protected readonly cancelling = signal(false);

  protected readonly showAssignModal = signal(false);
  protected readonly eligibleDrivers = signal<Driver[]>([]);
  protected readonly loadingDrivers = signal(false);
  protected readonly assignForm = this.fb.nonNullable.group({
    driverId: ['', [Validators.required]],
    motif: [''],
  });
  protected readonly assigning = signal(false);
  protected readonly isReassignment = computed(() => !!this.order()?.livreur_id);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.ordersService.get(id).subscribe({
      next: (o) => { this.order.set(o); this.loading.set(false); },
      error: () => { this.notFound.set(true); this.loading.set(false); },
    });
  }

  reload(): void {
    const o = this.order();
    if (o) this.load(o.id);
  }

  openCancelModal(): void {
    this.cancelForm.reset({ reason: 'PLUS_BESOIN', note: '' });
    this.showCancelModal.set(true);
  }

  confirmCancel(): void {
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    const o = this.order();
    if (!o) return;
    this.cancelling.set(true);
    const { reason, note } = this.cancelForm.getRawValue();
    this.ordersService.cancel(o.id, reason as CancellationReason, note).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        this.order.set(updated);
        this.toast.success('Commande annulée', `Frais retenus : ${formatXaf(updated.frais_annulation ?? 0)}`);
      },
      error: (err: ProblemDetails) => { this.cancelling.set(false); this.toast.error('Annulation impossible', err.detail); },
    });
  }

  openAssignModal(): void {
    const o = this.order();
    if (!o) return;
    this.assignForm.reset({ driverId: '', motif: '' });
    this.showAssignModal.set(true);
    this.loadingDrivers.set(true);
    this.ordersService.eligibleDrivers(o).subscribe((drivers) => {
      this.eligibleDrivers.set(drivers);
      this.loadingDrivers.set(false);
    });
  }

  confirmAssign(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }
    const o = this.order();
    if (!o) return;
    const { driverId, motif } = this.assignForm.getRawValue();
    if (this.isReassignment() && !motif.trim()) {
      this.assignForm.controls.motif.setErrors({ required: true });
      this.assignForm.controls.motif.markAsTouched();
      return;
    }
    this.assigning.set(true);
    const action$ = this.isReassignment()
      ? this.ordersService.reassign(o.id, driverId, motif)
      : this.ordersService.assign(o.id, driverId, motif || undefined);
    action$.subscribe({
      next: (updated) => {
        this.assigning.set(false);
        this.showAssignModal.set(false);
        this.order.set(updated);
        this.toast.success(this.isReassignment() ? 'Commande réaffectée' : 'Commande affectée');
      },
      error: (err: ProblemDetails) => { this.assigning.set(false); this.toast.error('Affectation impossible', err.detail); },
    });
  }

  async escalateManual(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Escalader vers l’affectation manuelle', danger: false,
      message: 'La commande sera visible dans la file "Sans affectation" du poste de supervision. Continuer ?',
    });
    if (ok) this.toast.info('Commande signalée au superviseur');
  }

  formatDateTime(iso?: string): string { return formatDateTime(iso); }
  formatXaf(v: number): string { return formatXaf(v); }
  formatPhone(v?: string): string { return formatPhone(v); }
}
