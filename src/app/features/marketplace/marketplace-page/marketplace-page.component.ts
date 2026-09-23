import { Component, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import {
  MARKETPLACE_OFFER_STATUS_VALUES, MARKETPLACE_OFFER_TRANSITIONS, MarketplaceCategory, MarketplaceOffer,
  MarketplaceOfferStatus, ProblemDetails,
} from '../../../core/models';
import { formatDate } from '../../../core/utils/formatters';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  BreadcrumbsComponent, ColumnDef, ConfirmService, DataTableComponent, ForbiddenStateComponent, SelectComponent,
  SelectOption, StatusBadgeComponent, TabDef, TableCellDefDirective, TabsComponent, ToastService, ToggleComponent,
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

/** UC-MKT / MKT-M04 — /v1/admin/marketplace/categories, .../offers (Marketplace module, LVB-CDC-MKT-RENT-2026-V1.0). */
@Component({
  selector: 'app-marketplace-page',
  imports: [
    BreadcrumbsComponent, TabsComponent, ForbiddenStateComponent, StatusBadgeComponent, SelectComponent,
    DataTableComponent, TableCellDefDirective, ToggleComponent,
  ],
  templateUrl: './marketplace-page.component.html',
})
export class MarketplacePageComponent {
  private readonly marketplace = inject(MarketplaceService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly tabs: TabDef[] = [{ id: 'offers', label: 'Offres' }, { id: 'categories', label: 'Catégories' }];
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
}
