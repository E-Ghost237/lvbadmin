import { Component } from '@angular/core';
import { BreadcrumbsComponent } from '../../../shared/ui';

/**
 * Module Partenaire (LVB-CDC-PART-2026-V1.0) — admin side of `/v1/admin/partners*`.
 * Foundation stage: service and models are wired (`PartnersService`); the
 * list, creation, validation, document review, team and audit screens land
 * in the stages that follow.
 */
@Component({
  selector: 'app-partners-page',
  imports: [BreadcrumbsComponent],
  templateUrl: './partners-page.component.html',
})
export class PartnersPageComponent {}
