import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ClaimsService } from '../../../core/services/claims.service';
import { Claim } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import {
  BreadcrumbsComponent, ColumnDef, DataTableComponent, SearchInputComponent, StatusBadgeComponent, TableCellDefDirective,
} from '../../../shared/ui';

@Component({
  selector: 'app-claims-list',
  imports: [DataTableComponent, TableCellDefDirective, StatusBadgeComponent, SearchInputComponent, BreadcrumbsComponent],
  templateUrl: './claims-list.component.html',
})
export class ClaimsListComponent {
  private readonly claimsService = inject(ClaimsService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly rows = signal<Claim[]>([]);
  protected readonly loading = signal(true);
  protected readonly statut = signal('TOUS');
  protected readonly gravite = signal('TOUS');
  protected readonly search = signal('');

  protected readonly columns: ColumnDef<Claim>[] = [
    { key: 'numero', label: 'Réclamation' },
    { key: 'commande_numero', label: 'Commande' },
    { key: 'ouverte_par_nom', label: 'Ouverte par' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'gravite', label: 'Gravité' },
    { key: 'statut', label: 'Statut' },
    { key: 'echeance_sla', label: 'Échéance SLA', cell: (c) => formatDateTime(c.echeance_sla) },
  ];

  constructor() {
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.claimsService.list({ statut: this.statut(), gravite: this.gravite(), search: this.search() || undefined }).subscribe((res) => {
      this.rows.set(res);
      this.loading.set(false);
    });
  }

  applyFilters(): void { this.fetch(); }
  onSearch(v: string): void { this.search.set(v); this.fetch(); }

  isOverdue(claim: Claim): boolean {
    return claim.statut !== 'RESOLUE' && claim.statut !== 'FERMEE' && new Date(claim.echeance_sla).getTime() < Date.now();
  }

  openClaim(claim: Claim): void {
    this.router.navigate(['/claims', claim.id]);
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
}
