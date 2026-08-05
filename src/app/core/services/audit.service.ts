import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogEntry, ListQuery, PagedResult } from '../models';
import { MockDbService } from '../mock/mock-db.service';
import { matchesSearch, mockOk, paginate } from '../mock/mock-utils';

/** UC-ADM-14 — journal immuable, écriture seule, recherche et export. */
@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private readonly db: MockDbService) {}

  list(query?: ListQuery & { action?: string; date_debut?: string; date_fin?: string }): Observable<PagedResult<AuditLogEntry>> {
    let items = [...this.db.auditLog()];
    if (query?.action && query.action !== 'TOUS') items = items.filter((a) => a.action === query.action);
    if (query?.date_debut) items = items.filter((a) => a.cree_le >= query.date_debut!);
    if (query?.date_fin) items = items.filter((a) => a.cree_le <= query.date_fin!);
    if (query?.search) items = items.filter((a) => matchesSearch([a.auteur_nom, a.action, a.ressource, a.ressource_id, a.ip], query.search));
    return mockOk(paginate(items, query));
  }

  distinctActions(): string[] {
    return Array.from(new Set(this.db.auditLog().map((a) => a.action))).sort();
  }
}
