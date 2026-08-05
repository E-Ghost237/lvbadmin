import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionCode } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Structural directive mirroring the permission guard: `*appHasPermission="'order.cancel'"`.
 * Hiding an action in the UI is a courtesy, not the security boundary — the
 * route guard and (eventually) the backend are the real enforcement — but
 * hiding it also prevents confused-user support tickets.
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appHasPermission = input<PermissionCode | PermissionCode[]>([]);

  private inserted = false;

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const allowed = Array.isArray(required) && required.length === 0
        ? true
        : this.auth.hasPermission(required);
      if (allowed && !this.inserted) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.inserted = true;
      } else if (!allowed && this.inserted) {
        this.viewContainer.clear();
        this.inserted = false;
      }
    });
  }
}
