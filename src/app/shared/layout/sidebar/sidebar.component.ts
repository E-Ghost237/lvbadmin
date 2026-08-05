import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ROLE_LABELS } from '../../../core/auth/rbac';
import { NAV_ITEMS } from '../nav-data';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="flex h-full w-64 shrink-0 flex-col" style="background: var(--surface-1); border-right: 1px solid var(--border)">
      <div class="flex items-center gap-2.5 px-5 h-16 shrink-0" style="border-bottom: 1px solid var(--border)">
        <div class="h-8 w-8 rounded-(--radius-sm) flex items-center justify-center font-bold text-white text-sm shrink-0" style="background: var(--brand)">LVB</div>
        <div class="min-w-0">
          <p class="text-sm font-semibold leading-tight truncate">{{ i18n.t('app.name') }}</p>
          <p class="text-[11px] leading-tight truncate" style="color: var(--text-muted)">La Vie est Belle</p>
        </div>
        <button type="button" class="ml-auto lg:hidden btn btn-ghost btn-sm !px-1.5" (click)="closeMobile.emit()" aria-label="Fermer le menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto thin-scroll px-3 py-4 flex flex-col gap-0.5" aria-label="Navigation principale">
        @for (item of visibleItems(); track item.path) {
          <a
            [routerLink]="item.path" routerLinkActive="active-nav-link" [routerLinkActiveOptions]="{ exact: false }"
            class="nav-link flex items-center gap-3 rounded-(--radius-sm) px-3 py-2 text-sm font-medium transition-colors"
            (click)="closeMobile.emit()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
              <path [attr.d]="item.icon" />
            </svg>
            <span class="truncate">{{ i18n.t(item.labelKey) }}</span>
            @if (item.path === '/dashboard' && criticalAlerts() > 0) {
              <span class="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style="background: var(--status-critical-bg); color: var(--status-critical)">{{ criticalAlerts() }}</span>
            }
          </a>
        }
      </nav>

      <div class="p-3 shrink-0" style="border-top: 1px solid var(--border)">
        <a routerLink="/account" class="flex items-center gap-2.5 rounded-(--radius-sm) px-2 py-2 hover:bg-(--surface-2)" style="background: var(--surface-2)">
          <div class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style="background: var(--brand)">
            {{ userInitials() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium truncate">{{ userName() }}</p>
            <p class="text-[11px] truncate" style="color: var(--text-muted)">{{ userRoleLabel() }}</p>
          </div>
        </a>
      </div>
    </aside>
    <style>
      .nav-link { color: var(--text-secondary); }
      .nav-link:hover { background: var(--surface-2); color: var(--text-primary); }
      .active-nav-link { background: var(--brand-50); color: var(--brand); }
    </style>
  `,
})
export class SidebarComponent {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);

  readonly closeMobile = output<void>();

  protected readonly visibleItems = computed(() => NAV_ITEMS.filter((item) => this.auth.hasAnyPermission(item.permissions)));
  protected readonly criticalAlerts = computed(() => this.notifications.criticalUnacknowledgedCount());
  protected readonly userName = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.prenom} ${u.nom}` : '';
  });
  protected readonly userInitials = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.prenom?.[0] ?? ''}${u.nom[0] ?? ''}`.toUpperCase() || '?' : '?';
  });
  protected readonly userRoleLabel = computed(() => {
    const u = this.auth.currentUser();
    return u ? ROLE_LABELS[u.role] : '';
  });
}
