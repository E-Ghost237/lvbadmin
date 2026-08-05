import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TeleconseillerService } from '../../../core/services/teleconseiller.service';
import {
  AgentActivitySnapshot, Callback, ClientSearchResult, Order, ParcelType, PaymentMethod,
  PricingSimulationResult, ProblemDetails, UrgencyLevel,
} from '../../../core/models';
import { e164Phone, integerAmount, requiredTrimmed } from '../../../core/utils/validators';
import { formatDateTime, formatRelative, formatXaf } from '../../../core/utils/formatters';
import {
  BreadcrumbsComponent, EmptyStateComponent, FormFieldComponent, ModalComponent, TabDef,
  TabsComponent, ToastService,
} from '../../../shared/ui';

type WizardStep = 'CLIENT' | 'TRAJET' | 'PAIEMENT';

const PARCEL_TYPES: { value: ParcelType; label: string }[] = [
  { value: 'DOCUMENT', label: 'Document' }, { value: 'PETIT', label: 'Petit colis' },
  { value: 'STANDARD', label: 'Colis standard' }, { value: 'VOLUMINEUX', label: 'Volumineux' },
  { value: 'FRAGILE', label: 'Fragile' }, { value: 'ALIMENTAIRE', label: 'Alimentaire' },
];

@Component({
  selector: 'app-teleconseiller-console',
  imports: [ReactiveFormsModule, RouterLink, TabsComponent, FormFieldComponent, EmptyStateComponent, BreadcrumbsComponent, ModalComponent],
  templateUrl: './teleconseiller-console.component.html',
})
export class TeleconseillerConsoleComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TeleconseillerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'new-order', label: 'Nouvelle commande' },
    { id: 'callbacks', label: 'Rappels' },
    { id: 'activity', label: 'Mon activité' },
  ];
  protected readonly activeTab = signal('new-order');
  protected readonly parcelTypes = PARCEL_TYPES;

  // --- Wizard state (UC-TEL-01) --------------------------------------
  protected readonly step = signal<WizardStep>('CLIENT');
  protected readonly elapsedSeconds = signal(0);
  private readonly wizardStartedAt = Date.now();

  protected readonly clientQuery = signal('');
  protected readonly clientResults = signal<ClientSearchResult[]>([]);
  protected readonly searchingClient = signal(false);
  protected readonly selectedClient = signal<ClientSearchResult | null>(null);
  protected readonly creatingNewClient = signal(false);

  protected readonly newClientForm = this.fb.nonNullable.group({
    nom: ['', [requiredTrimmed()]],
    prenom: ['', [requiredTrimmed()]],
    telephone: ['+237', [Validators.required, e164Phone()]],
  });

  protected readonly tripForm = this.fb.nonNullable.group({
    ville: ['Douala' as 'Douala' | 'Yaoundé', [Validators.required]],
    depart_quartier: ['', [requiredTrimmed()]],
    depart_repere: ['', [requiredTrimmed()]],
    depart_contact_nom: ['', [requiredTrimmed()]],
    depart_contact_telephone: ['+237', [Validators.required, e164Phone()]],
    arrivee_quartier: ['', [requiredTrimmed()]],
    arrivee_repere: ['', [requiredTrimmed()]],
    destinataire_nom: ['', [requiredTrimmed()]],
    destinataire_telephone: ['+237', [Validators.required, e164Phone()]],
    colis_type: ['STANDARD' as ParcelType, [Validators.required]],
    poids_kg: [1, [Validators.required, Validators.min(0.1)]],
    fragile: [false],
    valeur_declaree: [null as number | null, [integerAmount(0)]],
    urgence: ['STANDARD' as UrgencyLevel, [Validators.required]],
    distance_km: [4, [Validators.required, Validators.min(0.5), Validators.max(60)]],
  });

  protected readonly paymentForm = this.fb.nonNullable.group({
    mode_paiement: ['MTN_MOMO' as PaymentMethod, [Validators.required]],
  });

  protected readonly quote = signal<PricingSimulationResult | null>(null);
  protected readonly loadingQuote = signal(false);
  protected readonly submittingOrder = signal(false);
  protected readonly createdOrder = signal<Order | null>(null);

  // --- Callbacks (UC-TEL-06) ------------------------------------------
  protected readonly callbacks = signal<Callback[]>([]);
  protected readonly loadingCallbacks = signal(false);
  protected readonly showCallbackForm = signal(false);
  protected readonly callbackForm = this.fb.nonNullable.group({
    client_nom: ['', [requiredTrimmed()]],
    client_telephone: ['+237', [Validators.required, e164Phone()]],
    motif: ['', [requiredTrimmed()]],
    echeance: ['', [Validators.required]],
  });
  protected readonly savingCallback = signal(false);

  // --- Activity (UC-TEL-07) -------------------------------------------
  protected readonly activity = signal<AgentActivitySnapshot | null>(null);
  protected readonly loadingActivity = signal(false);

  constructor() {
    const sub = interval(1000).subscribe(() => this.elapsedSeconds.set(Math.round((Date.now() - this.wizardStartedAt) / 1000)));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.loadCallbacks();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'activity') this.loadActivity();
    if (id === 'callbacks') this.loadCallbacks();
  }

  // --- Client search ----------------------------------------------------
  onClientQueryChange(value: string): void {
    this.clientQuery.set(value);
    if (!value.trim()) { this.clientResults.set([]); return; }
    this.searchingClient.set(true);
    this.service.searchClient(value).subscribe((results) => {
      this.clientResults.set(results);
      this.searchingClient.set(false);
    });
  }

  selectClient(client: ClientSearchResult): void {
    this.selectedClient.set(client);
    this.creatingNewClient.set(false);
    this.tripForm.patchValue({ depart_contact_nom: client.nom, depart_contact_telephone: client.telephone });
    this.step.set('TRAJET');
  }

  startNewClient(): void {
    this.creatingNewClient.set(true);
    this.selectedClient.set(null);
  }

  confirmNewClient(): void {
    if (this.newClientForm.invalid) {
      this.newClientForm.markAllAsTouched();
      return;
    }
    const { nom, prenom, telephone } = this.newClientForm.getRawValue();
    this.tripForm.patchValue({ depart_contact_nom: `${prenom} ${nom}`, depart_contact_telephone: telephone });
    this.step.set('TRAJET');
  }

  goToStep(target: WizardStep): void {
    this.step.set(target);
  }

  // --- Devis --------------------------------------------------------
  requestQuote(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }
    const v = this.tripForm.getRawValue();
    this.loadingQuote.set(true);
    this.service.estimate(v.ville, { distance_km: v.distance_km, duree_min: v.distance_km * 3.4 + 5, urgence: v.urgence, poids_kg: v.poids_kg, fragile: v.fragile }).subscribe({
      next: (q) => { this.quote.set(q); this.loadingQuote.set(false); this.step.set('PAIEMENT'); },
      error: () => { this.loadingQuote.set(false); },
    });
  }

  submitOrder(): void {
    if (this.paymentForm.invalid || this.tripForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const t = this.tripForm.getRawValue();
    const client = this.selectedClient();
    const newClient = this.newClientForm.getRawValue();

    this.submittingOrder.set(true);
    this.service.createOrder({
      client_id: client?.client_id,
      nouveau_client: client ? undefined : { nom: newClient.nom, prenom: newClient.prenom, telephone: newClient.telephone },
      adresse_depart: { point: { lat: 4.05, lng: 9.7 }, ville: t.ville, quartier: t.depart_quartier, repere: t.depart_repere, contact_nom: t.depart_contact_nom, contact_telephone: t.depart_contact_telephone },
      adresse_arrivee: { point: { lat: 4.06, lng: 9.71 }, ville: t.ville, quartier: t.arrivee_quartier, repere: t.arrivee_repere, contact_nom: t.destinataire_nom, contact_telephone: t.destinataire_telephone },
      destinataire_nom: t.destinataire_nom, destinataire_telephone: t.destinataire_telephone,
      colis_type: t.colis_type, poids_kg: t.poids_kg, fragile: t.fragile, valeur_declaree: t.valeur_declaree ?? undefined,
      urgence: t.urgence, mode_paiement: this.paymentForm.getRawValue().mode_paiement,
      distance_km: t.distance_km, duree_min: t.distance_km * 3.4 + 5,
    }).subscribe({
      next: (order) => {
        this.submittingOrder.set(false);
        this.createdOrder.set(order);
        this.toast.success('Commande créée', `${order.numero} — créée en ${this.elapsedSeconds()} s`);
      },
      error: (err: ProblemDetails) => { this.submittingOrder.set(false); this.toast.error('Échec de la création', err.detail); },
    });
  }

  resetWizard(): void {
    this.step.set('CLIENT');
    this.clientQuery.set(''); this.clientResults.set([]); this.selectedClient.set(null); this.creatingNewClient.set(false);
    this.newClientForm.reset({ nom: '', prenom: '', telephone: '+237' });
    this.tripForm.reset({ ville: 'Douala', colis_type: 'STANDARD', poids_kg: 1, fragile: false, urgence: 'STANDARD', distance_km: 4, depart_contact_telephone: '+237', destinataire_telephone: '+237' });
    this.paymentForm.reset({ mode_paiement: 'MTN_MOMO' });
    this.quote.set(null);
    this.createdOrder.set(null);
  }

  // --- Callbacks ------------------------------------------------------
  loadCallbacks(): void {
    const agentId = this.auth.currentUser()?.id;
    this.loadingCallbacks.set(true);
    this.service.callbacks(agentId).subscribe((list) => {
      this.callbacks.set(list);
      this.loadingCallbacks.set(false);
    });
  }

  isOverdue(cb: Callback): boolean {
    return cb.statut === 'PLANIFIE' && new Date(cb.echeance).getTime() < Date.now();
  }

  openCallbackForm(): void {
    this.callbackForm.reset({ client_nom: '', client_telephone: '+237', motif: '', echeance: '' });
    this.showCallbackForm.set(true);
  }

  saveCallback(): void {
    if (this.callbackForm.invalid) {
      this.callbackForm.markAllAsTouched();
      return;
    }
    const v = this.callbackForm.getRawValue();
    this.savingCallback.set(true);
    this.service.createCallback({ client_nom: v.client_nom, client_telephone: v.client_telephone, motif: v.motif, echeance: new Date(v.echeance).toISOString() }).subscribe(() => {
      this.savingCallback.set(false);
      this.showCallbackForm.set(false);
      this.loadCallbacks();
      this.toast.success('Rappel planifié');
    });
  }

  completeCallback(cb: Callback): void {
    this.service.completeCallback(cb.id).subscribe(() => { this.loadCallbacks(); this.toast.success('Rappel marqué comme fait'); });
  }

  // --- Activity ---------------------------------------------------------
  loadActivity(): void {
    const agentId = this.auth.currentUser()?.id;
    if (!agentId) return;
    this.loadingActivity.set(true);
    this.service.activity(agentId).subscribe((snap) => {
      this.activity.set(snap);
      this.loadingActivity.set(false);
    });
  }

  goToOrder(orderId: string): void {
    this.router.navigate(['/orders', orderId]);
  }

  formatXaf(v: number): string { return formatXaf(v); }
  formatDateTime(v: string): string { return formatDateTime(v); }
  formatRelative(v: string): string { return formatRelative(v, this.i18n.locale()); }
}
