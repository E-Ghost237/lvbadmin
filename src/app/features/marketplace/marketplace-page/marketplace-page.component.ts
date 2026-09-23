import { Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { RentalService } from '../../../core/services/rental.service';
import { BookingService } from '../../../core/services/booking.service';
import {
  Booking, BOOKING_STATUS_VALUES, BOOKING_TERMINAL_STATUSES, BookingStatus, DisputeOutcome,
  DRIVER_STATUS_VALUES, Driver, DriverStatus, MARKETPLACE_OFFER_STATUS_VALUES, MARKETPLACE_OFFER_TRANSITIONS,
  MarketplaceCategory, MarketplaceOffer, MarketplaceOfferStatus, ProblemDetails, VEHICLE_STATUS_VALUES, Vehicle,
  VehicleStatus, RentalVehicleType,
} from '../../../core/models';
import { formatDate, formatDateTime, formatXaf } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, ConfirmService, DataTableComponent, ForbiddenStateComponent, ModalComponent,
  SelectComponent, SelectOption, StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService,
  ToggleComponent,
} from '../../../shared/ui';

const TRANSITION_LABEL: Record<MarketplaceOfferStatus, string> = {
  BROUILLON: 'Renvoyer en brouillon', EN_REVUE: 'Renvoyer en revue', PUBLIEE: 'Publier',
  SUSPENDUE: 'Suspendre', ARCHIVEE: 'Archiver', REJETEE: 'Rejeter',
};
const TRANSITION_DANGER: Partial<Record<MarketplaceOfferStatus, boolean>> = {
  SUSPENDUE: true, REJETEE: true, ARCHIVEE: true,
};

interface OfferAction {
  target: MarketplaceOfferStatus;
  label: string;
  danger: boolean;
}

type BookingActionKind = 'accept' | 'reject' | 'cancel' | 'assign-driver' | 'incident' | 'resolve-dispute';

interface BookingActionDef {
  action: BookingActionKind;
  label: string;
  danger: boolean;
}

const BOOKING_REASON_LABEL: Partial<Record<BookingActionKind, string>> = {
  reject: 'Motif de rejet', cancel: 'Motif d’annulation', incident: 'Description de l’incident',
  'assign-driver': 'UUID du chauffeur affecté',
};

/** UC-MKT / MKT-M04 — /v1/admin/marketplace/categories, .../offers (Marketplace module, LVB-CDC-MKT-RENT-2026-V1.0). */
@Component({
  selector: 'app-marketplace-page',
  imports: [
    BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent, SelectComponent,
    DataTableComponent, TableCellDefDirective, ToggleComponent, ModalComponent,
  ],
  templateUrl: './marketplace-page.component.html',
})
export class MarketplacePageComponent {
  private readonly marketplace = inject(MarketplaceService);
  private readonly rental = inject(RentalService);
  private readonly bookingSvc = inject(BookingService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [
    { id: 'offers', label: 'Offres' }, { id: 'categories', label: 'Catégories' },
    { id: 'vehicles', label: 'Véhicules' }, { id: 'drivers', label: 'Chauffeurs' },
    { id: 'vehicleTypes', label: 'Types de véhicule' }, { id: 'bookings', label: 'Réservations' },
  ];
  protected readonly activeTab = signal('offers');

  protected readonly statusOptions: SelectOption[] = MARKETPLACE_OFFER_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.marketplaceOffer.' + s),
  }));

  protected readonly offerColumns: ColumnDef<MarketplaceOffer>[] = [
    { key: 'title', label: 'Offre' },
    { key: 'partner_id', label: 'Partenaire', cell: (r) => `Partenaire #${r.partner_id}` },
    { key: 'category_id', label: 'Catégorie', cell: (r) => `Catégorie #${r.category_id}` },
    { key: 'status', label: 'Statut' },
    { key: 'created_at', label: 'Créée le', cell: (r) => formatDate(r.created_at) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByOfferUuid = (row: MarketplaceOffer) => row.uuid;

  protected readonly offers = signal<MarketplaceOffer[]>([]);
  protected readonly loadingOffers = signal(true);
  protected readonly forbiddenOffers = signal(false);
  protected readonly offersCursor = signal<string | null>(null);
  protected readonly offerStatusFilter = signal<MarketplaceOfferStatus | ''>('');
  protected readonly transitioning = signal<string | null>(null);

  constructor() {
    this.fetchOffers();
  }

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'categories' && this.categories().length === 0) this.fetchCategories();
    if (id === 'vehicleTypes' && this.vehicleTypes().length === 0) this.fetchVehicleTypes();
    if (id === 'bookings' && this.bookings().length === 0) this.fetchBookings();
  }

  fetchOffers(cursor?: string): void {
    this.loadingOffers.set(true);
    this.forbiddenOffers.set(false);
    this.marketplace.listOffers({ status: this.offerStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingOffers.set(false);
        this.offers.set(cursor ? [...this.offers(), ...page.items] : page.items);
        this.offersCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingOffers.set(false);
        if (err.status === 403) this.forbiddenOffers.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onOfferStatusFilterChange(value: string): void {
    this.offerStatusFilter.set(value as MarketplaceOfferStatus | '');
    this.fetchOffers();
  }

  actionsFor(offer: MarketplaceOffer): OfferAction[] {
    return MARKETPLACE_OFFER_TRANSITIONS[offer.status].map((target) => ({
      target, label: TRANSITION_LABEL[target], danger: !!TRANSITION_DANGER[target],
    }));
  }

  async applyTransition(offer: MarketplaceOffer, action: OfferAction): Promise<void> {
    const ok = await this.confirm.ask({
      title: `${action.label} cette offre ?`, message: offer.title, danger: action.danger, confirmLabel: action.label,
    });
    if (!ok) return;
    this.transitioning.set(offer.uuid);
    this.marketplace.transitionOffer(offer.uuid, action.target).subscribe({
      next: () => {
        this.transitioning.set(null);
        this.toast.success('Statut mis à jour');
        this.fetchOffers();
      },
      error: (err: ProblemDetails) => {
        this.transitioning.set(null);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Categories -------------------------------------------------------

  protected readonly categories = signal<MarketplaceCategory[]>([]);
  protected readonly loadingCategories = signal(false);
  protected readonly savingCategory = signal<string | null>(null);
  protected readonly newCategoryName = signal('');

  fetchCategories(): void {
    this.loadingCategories.set(true);
    this.marketplace.listCategories().subscribe({
      next: (page) => { this.loadingCategories.set(false); this.categories.set(page.items); },
      error: (err: ProblemDetails) => { this.loadingCategories.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  private static slugify(name: string): string {
    return name.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  renameCategory(category: MarketplaceCategory, name: string): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) return;
    this.savingCategory.set(category.uuid);
    this.marketplace.updateCategory(category.uuid, trimmed, category.slug, category.active).subscribe({
      next: () => { this.savingCategory.set(null); this.toast.success('Catégorie mise à jour'); this.fetchCategories(); },
      error: (err: ProblemDetails) => { this.savingCategory.set(null); this.toast.error('Échec', err.detail); this.fetchCategories(); },
    });
  }

  toggleCategoryActive(category: MarketplaceCategory): void {
    this.savingCategory.set(category.uuid);
    this.marketplace.updateCategory(category.uuid, category.name, category.slug, !category.active).subscribe({
      next: () => { this.savingCategory.set(null); this.fetchCategories(); },
      error: (err: ProblemDetails) => { this.savingCategory.set(null); this.toast.error('Échec', err.detail); this.fetchCategories(); },
    });
  }

  onNewCategoryNameInput(value: string): void {
    this.newCategoryName.set(value);
  }

  createCategory(): void {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.marketplace.createCategory(name, MarketplacePageComponent.slugify(name), true).subscribe({
      next: () => {
        this.newCategoryName.set('');
        this.toast.success('Catégorie créée');
        this.fetchCategories();
      },
      error: (err: ProblemDetails) => this.toast.error('Échec de la création', err.detail),
    });
  }

  // --- Vehicles (RNT-M01) ------------------------------------------------
  // Every vehicle/driver call requires a `partner_id` integer the admin has
  // to already know (see RentalService docblock) — the tab starts with a
  // lookup step rather than a flat cross-partner list.

  protected readonly vehicleStatusOptions: SelectOption[] = VEHICLE_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.rentalVehicle.' + s),
  }));
  protected readonly vehicleColumns: ColumnDef<Vehicle>[] = [
    { key: 'registration', label: 'Immatriculation' },
    { key: 'brand', label: 'Marque / modèle', cell: (r) => `${r.brand} ${r.model}` },
    { key: 'vehicle_type', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'compliance_suspended', label: 'Conformité', cell: (r) => (r.compliance_suspended ? 'Suspendu' : 'OK') },
  ];
  protected readonly trackByVehicleUuid = (row: Vehicle) => row.uuid;

  protected readonly vehiclePartnerIdInput = signal('');
  protected readonly vehiclePartnerId = signal<number | null>(null);
  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly loadingVehicles = signal(false);
  protected readonly vehiclesCursor = signal<number | null>(null);
  protected readonly vehicleStatusFilter = signal<VehicleStatus | ''>('');
  protected readonly updatingVehicle = signal<string | null>(null);

  onVehiclePartnerIdInput(value: string): void {
    this.vehiclePartnerIdInput.set(value);
  }

  lookupVehiclePartner(): void {
    const id = Number.parseInt(this.vehiclePartnerIdInput(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      this.toast.error('Identifiant invalide', 'Saisissez un identifiant partenaire numérique valide.');
      return;
    }
    this.vehiclePartnerId.set(id);
    this.vehicles.set([]);
    this.vehiclesCursor.set(null);
    this.fetchVehicles();
  }

  fetchVehicles(cursor?: number): void {
    const partnerId = this.vehiclePartnerId();
    if (partnerId === null) return;
    this.loadingVehicles.set(true);
    this.rental.listVehicles(partnerId, { status: this.vehicleStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingVehicles.set(false);
        this.vehicles.set(cursor ? [...this.vehicles(), ...page.items] : page.items);
        this.vehiclesCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingVehicles.set(false);
        this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onVehicleStatusFilterChange(value: string): void {
    this.vehicleStatusFilter.set(value as VehicleStatus | '');
    this.fetchVehicles();
  }

  async changeVehicleStatus(vehicle: Vehicle, status: string): Promise<void> {
    const target = status as VehicleStatus;
    if (target === vehicle.status) return;
    const ok = await this.confirm.ask({
      title: `Changer le statut de ${vehicle.registration} ?`,
      message: `Nouveau statut : ${this.i18n.t('status.rentalVehicle.' + target)}`,
      danger: target === 'SUSPENDU' || target === 'ARCHIVE',
    });
    if (!ok) return;
    this.updatingVehicle.set(vehicle.uuid);
    this.rental.updateVehicleStatus(this.vehiclePartnerId()!, vehicle.uuid, target).subscribe({
      next: () => { this.updatingVehicle.set(null); this.toast.success('Statut mis à jour'); this.fetchVehicles(); },
      error: (err: ProblemDetails) => { this.updatingVehicle.set(null); this.toast.error('Échec', err.detail); this.fetchVehicles(); },
    });
  }

  // --- Drivers (RNT-M02) --------------------------------------------------

  protected readonly driverStatusOptions: SelectOption[] = DRIVER_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.rentalDriver.' + s),
  }));
  protected readonly driverColumns: ColumnDef<Driver>[] = [
    { key: 'name', label: 'Chauffeur', cell: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'phone', label: 'Téléphone' },
    { key: 'license_categories', label: 'Permis', cell: (r) => r.license_categories.join(', ') },
    { key: 'status', label: 'Statut' },
    { key: 'compliance_suspended', label: 'Conformité', cell: (r) => (r.compliance_suspended ? 'Suspendu' : 'OK') },
  ];
  protected readonly trackByDriverUuid = (row: Driver) => row.uuid;

  protected readonly driverPartnerIdInput = signal('');
  protected readonly driverPartnerId = signal<number | null>(null);
  protected readonly drivers = signal<Driver[]>([]);
  protected readonly loadingDrivers = signal(false);
  protected readonly driversCursor = signal<number | null>(null);
  protected readonly driverStatusFilter = signal<DriverStatus | ''>('');
  protected readonly updatingDriver = signal<string | null>(null);

  onDriverPartnerIdInput(value: string): void {
    this.driverPartnerIdInput.set(value);
  }

  lookupDriverPartner(): void {
    const id = Number.parseInt(this.driverPartnerIdInput(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      this.toast.error('Identifiant invalide', 'Saisissez un identifiant partenaire numérique valide.');
      return;
    }
    this.driverPartnerId.set(id);
    this.drivers.set([]);
    this.driversCursor.set(null);
    this.fetchDrivers();
  }

  fetchDrivers(cursor?: number): void {
    const partnerId = this.driverPartnerId();
    if (partnerId === null) return;
    this.loadingDrivers.set(true);
    this.rental.listDrivers(partnerId, { status: this.driverStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingDrivers.set(false);
        this.drivers.set(cursor ? [...this.drivers(), ...page.items] : page.items);
        this.driversCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingDrivers.set(false);
        this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onDriverStatusFilterChange(value: string): void {
    this.driverStatusFilter.set(value as DriverStatus | '');
    this.fetchDrivers();
  }

  async changeDriverStatus(driver: Driver, status: string): Promise<void> {
    const target = status as DriverStatus;
    if (target === driver.status) return;
    const ok = await this.confirm.ask({
      title: `Changer le statut de ${driver.first_name} ${driver.last_name} ?`,
      message: `Nouveau statut : ${this.i18n.t('status.rentalDriver.' + target)}`,
      danger: target === 'SUSPENDU' || target === 'ARCHIVE',
    });
    if (!ok) return;
    this.updatingDriver.set(driver.uuid);
    this.rental.updateDriverStatus(this.driverPartnerId()!, driver.uuid, target).subscribe({
      next: () => { this.updatingDriver.set(null); this.toast.success('Statut mis à jour'); this.fetchDrivers(); },
      error: (err: ProblemDetails) => { this.updatingDriver.set(null); this.toast.error('Échec', err.detail); this.fetchDrivers(); },
    });
  }

  // --- Vehicle types (reference data, not partner-scoped) -----------------

  protected readonly vehicleTypes = signal<RentalVehicleType[]>([]);
  protected readonly loadingVehicleTypes = signal(false);
  protected readonly savingVehicleType = signal<string | null>(null);
  protected readonly newVehicleTypeCode = signal('');
  protected readonly newVehicleTypeLabel = signal('');

  fetchVehicleTypes(): void {
    this.loadingVehicleTypes.set(true);
    this.rental.listVehicleTypes().subscribe({
      next: (page) => { this.loadingVehicleTypes.set(false); this.vehicleTypes.set(page.items); },
      error: (err: ProblemDetails) => { this.loadingVehicleTypes.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  renameVehicleType(type: RentalVehicleType, label: string): void {
    const trimmed = label.trim();
    if (!trimmed || trimmed === type.label) return;
    this.savingVehicleType.set(type.code);
    this.rental.saveVehicleType(type.code, trimmed, type.active).subscribe({
      next: () => { this.savingVehicleType.set(null); this.toast.success('Type mis à jour'); this.fetchVehicleTypes(); },
      error: (err: ProblemDetails) => { this.savingVehicleType.set(null); this.toast.error('Échec', err.detail); this.fetchVehicleTypes(); },
    });
  }

  toggleVehicleTypeActive(type: RentalVehicleType): void {
    this.savingVehicleType.set(type.code);
    this.rental.saveVehicleType(type.code, type.label, !type.active).subscribe({
      next: () => { this.savingVehicleType.set(null); this.fetchVehicleTypes(); },
      error: (err: ProblemDetails) => { this.savingVehicleType.set(null); this.toast.error('Échec', err.detail); this.fetchVehicleTypes(); },
    });
  }

  onNewVehicleTypeCodeInput(value: string): void {
    this.newVehicleTypeCode.set(value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
  }

  onNewVehicleTypeLabelInput(value: string): void {
    this.newVehicleTypeLabel.set(value);
  }

  createVehicleType(): void {
    const code = this.newVehicleTypeCode().trim();
    const label = this.newVehicleTypeLabel().trim();
    if (!code || !label) return;
    this.rental.saveVehicleType(code, label, true).subscribe({
      next: () => {
        this.newVehicleTypeCode.set('');
        this.newVehicleTypeLabel.set('');
        this.toast.success('Type créé');
        this.fetchVehicleTypes();
      },
      error: (err: ProblemDetails) => this.toast.error('Échec de la création', err.detail),
    });
  }

  // --- Bookings (RGRNT030BookingTransition) --------------------------------
  // Bookings never expose partner_id/client_id/driver_id — only vehicle_uuid/
  // offer_uuid and a driver_assigned flag (see BookingService docblock) — so
  // unlike Vehicles/Drivers this list needs no partner lookup step, but rows
  // can't show a partner/client/driver name either.

  protected readonly bookingStatusOptions: SelectOption[] = BOOKING_STATUS_VALUES.map((s) => ({
    value: s, label: this.i18n.t('status.booking.' + s),
  }));
  protected readonly disputeOutcomeOptions: SelectOption[] = [
    { value: 'release', label: 'Libérer les fonds au partenaire' },
    { value: 'refund', label: 'Rembourser le client' },
  ];
  protected readonly bookingColumns: ColumnDef<Booking>[] = [
    { key: 'uuid', label: 'Réservation', cell: (r) => `${r.uuid.slice(0, 8)}…` },
    { key: 'status', label: 'Statut' },
    { key: 'dispute_status', label: 'Litige' },
    { key: 'starts_at', label: 'Début', cell: (r) => formatDateTime(r.starts_at) },
    { key: 'total_amount', label: 'Montant', cell: (r) => formatXaf(r.total_amount) },
    { key: 'actions', label: '' },
  ];
  protected readonly trackByBookingUuid = (row: Booking) => row.uuid;

  protected readonly bookings = signal<Booking[]>([]);
  protected readonly loadingBookings = signal(false);
  protected readonly forbiddenBookings = signal(false);
  protected readonly bookingsCursor = signal<number | null>(null);
  protected readonly bookingStatusFilter = signal<BookingStatus | ''>('');
  protected readonly updatingBooking = signal<string | null>(null);

  protected readonly bookingDetail = signal<Booking | null>(null);
  protected readonly loadingBookingDetail = signal(false);
  protected readonly showDisputeForm = signal(false);
  protected readonly disputeOutcome = signal<DisputeOutcome>('release');
  protected readonly disputeReason = signal('');
  protected readonly resolvingDispute = signal(false);

  fetchBookings(cursor?: number): void {
    this.loadingBookings.set(true);
    this.forbiddenBookings.set(false);
    this.bookingSvc.listBookings({ status: this.bookingStatusFilter() || undefined, cursor, limit: 50 }).subscribe({
      next: (page) => {
        this.loadingBookings.set(false);
        this.bookings.set(cursor ? [...this.bookings(), ...page.items] : page.items);
        this.bookingsCursor.set(page.next_cursor);
      },
      error: (err: ProblemDetails) => {
        this.loadingBookings.set(false);
        if (err.status === 403) this.forbiddenBookings.set(true);
        else this.toast.error('Chargement impossible', err.detail);
      },
    });
  }

  onBookingStatusFilterChange(value: string): void {
    this.bookingStatusFilter.set(value as BookingStatus | '');
    this.fetchBookings();
  }

  openBookingDetail(uuid: string): void {
    this.showDisputeForm.set(false);
    this.loadingBookingDetail.set(true);
    this.bookingDetail.set(null);
    this.bookingSvc.getBooking(uuid).subscribe({
      next: (b) => { this.loadingBookingDetail.set(false); this.bookingDetail.set(b); },
      error: (err: ProblemDetails) => { this.loadingBookingDetail.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  closeBookingDetail(): void {
    this.bookingDetail.set(null);
    this.showDisputeForm.set(false);
  }

  bookingActions(b: Booking): BookingActionDef[] {
    const actions: BookingActionDef[] = [];
    if (b.status === 'EN_ATTENTE_CONFIRMATION') {
      actions.push({ action: 'accept', label: 'Confirmer', danger: false });
      actions.push({ action: 'reject', label: 'Rejeter', danger: true });
    }
    if (b.with_driver && !b.driver_assigned && ['CONFIRMEE', 'EN_ATTENTE_AFFECTATION', 'PLANIFIEE'].includes(b.status)) {
      actions.push({ action: 'assign-driver', label: 'Affecter un chauffeur', danger: false });
    }
    if (!BOOKING_TERMINAL_STATUSES.includes(b.status)) {
      actions.push({ action: 'cancel', label: 'Annuler', danger: true });
    }
    if (b.dispute_status === 'OPEN') {
      actions.push({ action: 'resolve-dispute', label: 'Résoudre le litige', danger: false });
    }
    actions.push({ action: 'incident', label: 'Signaler un incident', danger: false });
    return actions;
  }

  async applyBookingAction(booking: Booking, def: BookingActionDef): Promise<void> {
    if (def.action === 'resolve-dispute') {
      this.disputeOutcome.set('release');
      this.disputeReason.set('');
      this.showDisputeForm.set(true);
      return;
    }
    if (def.action === 'accept') {
      const ok = await this.confirm.ask({ title: 'Confirmer cette réservation ?', message: booking.uuid, confirmLabel: 'Confirmer' });
      if (!ok) return;
      this.runBookingAction(booking.uuid, this.bookingSvc.acceptBooking(booking.uuid));
      return;
    }
    const reason = await this.confirm.askReason({
      title: `${def.label} cette réservation ?`, label: BOOKING_REASON_LABEL[def.action] ?? 'Motif',
      danger: def.danger, confirmLabel: def.label,
    });
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    let obs: Observable<Booking>;
    switch (def.action) {
      case 'reject': obs = this.bookingSvc.rejectBooking(booking.uuid, trimmed); break;
      case 'cancel': obs = this.bookingSvc.cancelBooking(booking.uuid, trimmed); break;
      case 'incident': obs = this.bookingSvc.reportIncident(booking.uuid, trimmed); break;
      case 'assign-driver': obs = this.bookingSvc.assignDriver(booking.uuid, trimmed); break;
      default: return;
    }
    this.runBookingAction(booking.uuid, obs);
  }

  onDisputeOutcomeChange(value: string): void {
    this.disputeOutcome.set(value as DisputeOutcome);
  }

  onDisputeReasonInput(value: string): void {
    this.disputeReason.set(value);
  }

  cancelDisputeForm(): void {
    this.showDisputeForm.set(false);
  }

  submitDisputeResolution(): void {
    const booking = this.bookingDetail();
    const reason = this.disputeReason().trim();
    if (!booking || !reason) return;
    this.resolvingDispute.set(true);
    this.bookingSvc.resolveDispute(booking.uuid, this.disputeOutcome(), reason).subscribe({
      next: () => {
        this.resolvingDispute.set(false);
        this.showDisputeForm.set(false);
        this.toast.success('Litige résolu');
        this.fetchBookings();
        this.openBookingDetail(booking.uuid);
      },
      error: (err: ProblemDetails) => { this.resolvingDispute.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  dateTime(iso: string | null): string {
    return formatDateTime(iso);
  }

  xaf(amount: number | null): string {
    return formatXaf(amount);
  }

  private runBookingAction(uuid: string, obs: Observable<Booking>): void {
    this.updatingBooking.set(uuid);
    obs.subscribe({
      next: () => {
        this.updatingBooking.set(null);
        this.toast.success('Réservation mise à jour');
        this.fetchBookings();
        if (this.bookingDetail()?.uuid === uuid) this.openBookingDetail(uuid);
      },
      error: (err: ProblemDetails) => { this.updatingBooking.set(null); this.toast.error('Échec', err.detail); },
    });
  }
}
