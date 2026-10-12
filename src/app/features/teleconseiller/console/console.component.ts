import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AgentActivitySummary, ComplaintCategory, ConsoleOrderCreated, ConsoleOrderDetail, ConsoleSearchResult,
  PaymentMethod, QuoteCreated, Reminder, TeleconseillerService, UrgencyLevel,
} from '../../../core/services/teleconseiller.service';
import { GeoPoint, ProblemDetails } from '../../../core/models';
import { cmMobilePhone, emailAddress, personName } from '../../../core/utils/validators';
import { formatDateTime, formatXaf, humanizeSlug } from '../../../core/utils/formatters';
import {
  CmPhoneDirective,
  FormFeedbackService,
  FormFieldComponent,
  LocationPickerComponent,
  ModalComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SegmentOption,
  SegmentedControlComponent,
  SelectComponent,
  SelectOption,
  TabDef,
  TabsComponent,
  ToastService,
} from '../../../shared/ui';

type WizardStep = 1 | 2 | 3;
type PointTarget = 'pickup' | 'dropoff';

const VILLE_OPTIONS: SelectOption[] = [{ value: 'Douala', label: 'Douala' }, { value: 'Yaoundé', label: 'Yaoundé' }];
const URGENCE_OPTIONS: SelectOption[] = [
  { value: 'STANDARD', label: 'Standard' }, { value: 'EXPRESS', label: 'Express' }, { value: 'PLANIFIE', label: 'Planifié' },
];
const PAYMENT_OPTIONS: SelectOption[] = [
  { value: 'MTN_MOMO', label: 'MTN Mobile Money' }, { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'CARTE', label: 'Carte' }, { value: 'COD', label: 'Paiement à la livraison' },
];
const COMPLAINT_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'RETARD', label: 'Retard' }, { value: 'COLIS_ENDOMMAGE', label: 'Colis endommagé' },
  { value: 'COLIS_PERDU', label: 'Colis perdu' }, { value: 'COMPORTEMENT', label: 'Comportement' },
  { value: 'ERREUR_FACTURATION', label: 'Erreur de facturation' },
];

/** Curated labels for the deterministic pricing engine's decomposition lines (RG-010→016); falls back to a humanized key for any line the backend adds before a label exists here. */
const DECOMPOSITION_LABELS: Record<string, string> = {
  prix_base: 'Prix de base',
  charge_distance: 'Charge distance',
  charge_duree: 'Charge durée',
  frais_prise_en_charge: 'Frais de prise en charge',
  supplement_poids: 'Supplément poids',
  supplement_volume: 'Supplément volume',
  supplement_fragile: 'Supplément colis fragile',
  supplement_zone_difficile: 'Supplément zone difficile',
  prix_avant_remise: 'Prix avant remise',
  remise: 'Remise',
  prix_ajuste: 'Prix ajusté',
};

@Component({
  selector: 'app-console',
  imports: [
  CmPhoneDirective,
  DecimalPipe,
  FormFieldComponent,
  LocationPickerComponent,
  ModalComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  SearchInputComponent,
  SegmentedControlComponent,
  SelectComponent,
  TabsComponent,
],
  templateUrl: './console.component.html',
})
export class ConsoleComponent {
  private readonly teleconseiller = inject(TeleconseillerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly villeOptions = VILLE_OPTIONS;
  protected readonly urgenceOptions = URGENCE_OPTIONS;
  protected readonly paymentOptions = PAYMENT_OPTIONS;
  protected readonly complaintCategoryOptions = COMPLAINT_CATEGORY_OPTIONS;

  protected readonly tabs: TabDef[] = [
    { id: 'wizard', label: 'Nouvelle commande' },
    { id: 'search', label: 'Rechercher' },
    { id: 'reminders', label: 'Rappels' },
    { id: 'activity', label: 'Mon activité' },
  ];
  protected readonly activeTab = signal('wizard');

  // --- Wizard ---------------------------------------------------------
  protected readonly wizardStep = signal<WizardStep>(1);
  protected readonly elapsedSeconds = signal(0);

  protected readonly clientForm = this.fb.nonNullable.group({
    telephone_client: ['', [Validators.required, cmMobilePhone()]],
    email_client: ['', [emailAddress(), Validators.maxLength(255)]],
    nom_client: ['', [Validators.required, personName(), Validators.maxLength(150)]],
    prenom_client: ['', [personName(), Validators.maxLength(150)]],
  });

  protected readonly trajetForm = this.fb.nonNullable.group({
    ville: ['Douala', [Validators.required]],
    urgence: ['STANDARD' as UrgencyLevel, [Validators.required]],
    poids_kg: [1, [Validators.required, Validators.min(0.1)]],
    fragile: [false],
    valeur_declaree_xaf: [0],
    assurance_souscrite: [false],
    remise_souhaitee_xaf: [0],
  });

  protected readonly activePointTarget = signal<PointTarget>('pickup');
  protected readonly pickupPoint = signal<GeoPoint | null>(null);
  protected readonly dropoffPoint = signal<GeoPoint | null>(null);
  protected readonly pointTargetOptions = computed<SegmentOption[]>(() => [
    { value: 'pickup', label: `Ramassage ${this.pickupPoint() ? '✓' : ''}`.trim() },
    { value: 'dropoff', label: `Livraison ${this.dropoffPoint() ? '✓' : ''}`.trim() },
  ]);
  protected readonly quoting = signal(false);
  protected readonly quote = signal<QuoteCreated | null>(null);
  protected readonly quoteError = signal('');

  protected readonly deliveryForm = this.fb.nonNullable.group({
    destinataire_nom: ['', [Validators.required, personName(), Validators.maxLength(150)]],
    destinataire_telephone: ['', [Validators.required, cmMobilePhone()]],
    mode_paiement: ['MTN_MOMO' as PaymentMethod, [Validators.required]],
    instructions_ramassage: [''],
    instructions_livraison: [''],
  });

  protected readonly creating = signal(false);
  protected readonly orderCreated = signal<ConsoleOrderCreated | null>(null);

  // --- Search -----------------------------------------------------------
  protected readonly searchResults = signal<ConsoleSearchResult | null>(null);
  protected readonly searching = signal(false);
  protected readonly selectedClient = signal<ConsoleSearchResult['clients'][number] | null>(null);
  protected readonly selectedOrder = signal<{ id: number; uuid: string } | null>(null);
  protected readonly orderDetail = signal<ConsoleOrderDetail | null>(null);
  protected readonly loadingOrder = signal(false);

  protected readonly reassignOpen = signal(false);
  protected readonly reassignForm = this.fb.nonNullable.group({ motif: ['', [Validators.required, Validators.maxLength(255)]] });
  protected readonly reassigning = signal(false);

  protected readonly complaintOpen = signal(false);
  protected readonly complaintForm = this.fb.nonNullable.group({
    categorie: ['RETARD' as ComplaintCategory, [Validators.required]],
    description: ['', [Validators.required]],
  });
  protected readonly openingComplaint = signal(false);

  // --- Reminders ----------------------------------------------------------
  protected readonly reminders = signal<Reminder[]>([]);
  protected readonly loadingReminders = signal(false);
  protected readonly reminderForm = this.fb.nonNullable.group({
    echeance: ['', [Validators.required]],
    notes: [''],
  });
  protected readonly creatingReminder = signal(false);

  // --- Activity -------------------------------------------------------
  protected readonly activity = signal<AgentActivitySummary | null>(null);
  protected readonly loadingActivity = signal(false);

  constructor() {
    const timer = setInterval(() => this.elapsedSeconds.update((s) => s + 1), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'reminders' && this.reminders().length === 0) this.fetchReminders();
    if (id === 'activity') this.fetchActivity();
  }

  // --- Wizard actions -----------------------------------------------------
  goToStep2(): void {
    if (this.clientForm.invalid) {
      this.feedback.invalid(this.clientForm);
      return;
    }
    this.wizardStep.set(2);
  }

  onMapPoint(point: GeoPoint): void {
    if (this.activePointTarget() === 'pickup') this.pickupPoint.set(point);
    else this.dropoffPoint.set(point);
  }

  setActivePointTarget(target: string): void {
    this.activePointTarget.set(target as PointTarget);
  }

  requestQuote(): void {
    if (this.trajetForm.invalid || !this.pickupPoint() || !this.dropoffPoint()) {
      this.feedback.invalid(this.trajetForm);
      this.quoteError.set(!this.pickupPoint() || !this.dropoffPoint() ? 'Placez les deux points sur la carte.' : '');
      return;
    }
    const v = this.trajetForm.getRawValue();
    this.quoting.set(true);
    this.quoteError.set('');
    this.teleconseiller.quote({
      ville: v.ville,
      depart: this.pickupPoint()!,
      arrivee: this.dropoffPoint()!,
      urgence: v.urgence,
      colis: {
        poids_kg: v.poids_kg, fragile: v.fragile,
        valeur_declaree_xaf: v.valeur_declaree_xaf || null, assurance_souscrite: v.assurance_souscrite,
      },
      remise_souhaitee_xaf: v.remise_souhaitee_xaf || 0,
    }).subscribe({
      next: (q) => {
        this.quoting.set(false);
        this.quote.set(q);
        this.wizardStep.set(3);
      },
      error: (err: ProblemDetails) => {
        this.quoting.set(false);
        this.quoteError.set(err.detail);
      },
    });
  }

  submitOrder(): void {
    if (this.deliveryForm.invalid || !this.quote()) {
      this.feedback.invalid(this.deliveryForm);
      return;
    }
    const client = this.clientForm.getRawValue();
    const delivery = this.deliveryForm.getRawValue();
    this.creating.set(true);
    this.teleconseiller.createOrder({
      telephone_client: client.telephone_client, email_client: client.email_client || null, nom_client: client.nom_client, prenom_client: client.prenom_client || null,
      devis_id: this.quote()!.devis_id,
      destinataire_nom: delivery.destinataire_nom, destinataire_telephone: delivery.destinataire_telephone,
      mode_paiement: delivery.mode_paiement,
      instructions_ramassage: delivery.instructions_ramassage || null, instructions_livraison: delivery.instructions_livraison || null,
    }).subscribe({
      next: (res) => {
        this.creating.set(false);
        this.orderCreated.set(res);
        this.toast.success('Commande créée', res.commande_id);
      },
      error: (err: ProblemDetails) => {
        this.creating.set(false);
        this.toast.error('Échec de la création', err.detail);
      },
    });
  }

  resetWizard(): void {
    this.clientForm.reset({ telephone_client: '', email_client: '', nom_client: '', prenom_client: '' });
    this.trajetForm.reset({ ville: 'Douala', urgence: 'STANDARD', poids_kg: 1, fragile: false, valeur_declaree_xaf: 0, assurance_souscrite: false, remise_souhaitee_xaf: 0 });
    this.deliveryForm.reset({ destinataire_nom: '', destinataire_telephone: '', mode_paiement: 'MTN_MOMO', instructions_ramassage: '', instructions_livraison: '' });
    this.pickupPoint.set(null);
    this.dropoffPoint.set(null);
    this.quote.set(null);
    this.orderCreated.set(null);
    this.wizardStep.set(1);
    this.elapsedSeconds.set(0);
  }

  // --- Search actions -------------------------------------------------
  onSearch(q: string): void {
    if (!q.trim()) {
      this.searchResults.set(null);
      return;
    }
    this.searching.set(true);
    this.teleconseiller.search(q).subscribe({
      next: (res) => {
        this.searching.set(false);
        this.searchResults.set(res);
      },
      error: (err: ProblemDetails) => {
        this.searching.set(false);
        this.toast.error('Recherche impossible', err.detail);
      },
    });
  }

  selectClient(client: ConsoleSearchResult['clients'][number]): void {
    this.selectedClient.set(client);
  }

  selectOrder(order: { id: number; uuid: string }): void {
    this.selectedOrder.set(order);
    this.loadingOrder.set(true);
    this.orderDetail.set(null);
    this.teleconseiller.getOrder(order.uuid).subscribe({
      next: (d) => {
        this.loadingOrder.set(false);
        this.orderDetail.set(d);
      },
      error: (err: ProblemDetails) => {
        this.loadingOrder.set(false);
        this.toast.error('Commande introuvable', err.detail);
      },
    });
  }

  openReassign(): void {
    this.reassignForm.reset();
    this.reassignOpen.set(true);
  }

  confirmReassign(): void {
    if (this.reassignForm.invalid || !this.selectedOrder()) {
      this.feedback.invalid(this.reassignForm);
      return;
    }
    this.reassigning.set(true);
    this.teleconseiller.reassignOrder(this.selectedOrder()!.uuid, this.reassignForm.getRawValue().motif).subscribe({
      next: () => {
        this.reassigning.set(false);
        this.reassignOpen.set(false);
        this.toast.success('Commande réaffectée — dispatch relancé');
        this.selectOrder(this.selectedOrder()!);
      },
      error: (err: ProblemDetails) => {
        this.reassigning.set(false);
        this.toast.error('Échec de la réaffectation', err.detail);
      },
    });
  }

  openComplaint(): void {
    this.complaintForm.reset({ categorie: 'RETARD', description: '' });
    this.complaintOpen.set(true);
  }

  confirmComplaint(): void {
    if (this.complaintForm.invalid || !this.selectedClient() || !this.selectedOrder()) {
      this.feedback.invalid(this.complaintForm);
      return;
    }
    this.openingComplaint.set(true);
    const v = this.complaintForm.getRawValue();
    this.teleconseiller.openComplaint({
      commande_id: this.selectedOrder()!.id, client_id: this.selectedClient()!.id,
      categorie: v.categorie, description: v.description,
    }).subscribe({
      next: (res) => {
        this.openingComplaint.set(false);
        this.complaintOpen.set(false);
        this.toast.success('Réclamation ouverte', `#${res.reclamation_id}`);
      },
      error: (err: ProblemDetails) => {
        this.openingComplaint.set(false);
        this.toast.error('Échec de l’ouverture', err.detail);
      },
    });
  }

  // --- Reminders --------------------------------------------------------
  fetchReminders(): void {
    this.loadingReminders.set(true);
    this.teleconseiller.reminders().subscribe({
      next: (r) => {
        this.loadingReminders.set(false);
        this.reminders.set(r);
      },
      error: () => this.loadingReminders.set(false),
    });
  }

  createReminder(): void {
    if (this.reminderForm.invalid) {
      this.feedback.invalid(this.reminderForm);
      return;
    }
    const v = this.reminderForm.getRawValue();
    this.creatingReminder.set(true);
    this.teleconseiller.createReminder({
      client_id: this.selectedClient()?.id ?? null,
      commande_id: this.selectedOrder()?.id ?? null,
      echeance: new Date(v.echeance).toISOString(),
      notes: v.notes || null,
    }).subscribe({
      next: () => {
        this.creatingReminder.set(false);
        this.reminderForm.reset({ echeance: '', notes: '' });
        this.toast.success('Rappel planifié');
        this.fetchReminders();
      },
      error: (err: ProblemDetails) => {
        this.creatingReminder.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Activity ---------------------------------------------------------
  fetchActivity(): void {
    this.loadingActivity.set(true);
    this.teleconseiller.activity().subscribe({
      next: (a) => {
        this.loadingActivity.set(false);
        this.activity.set(a);
      },
      error: () => this.loadingActivity.set(false),
    });
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number): string {
    return formatXaf(amount);
  }

  decompositionLabel(key: string): string {
    return DECOMPOSITION_LABELS[key] ?? humanizeSlug(key);
  }

  /** Reads like a receipt (base → charges/suppléments → remise → prix ajusté) instead of the alphabetical order a plain keyvalue pipe would give. Unknown future lines are appended at the end rather than dropped. */
  orderedDecomposition(decomposition: Record<string, number>): [string, number][] {
    const known = Object.keys(DECOMPOSITION_LABELS).filter((k) => k in decomposition);
    const rest = Object.keys(decomposition).filter((k) => !(k in DECOMPOSITION_LABELS));
    return [...known, ...rest].map((k) => [k, decomposition[k]]);
  }
}
