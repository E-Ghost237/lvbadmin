import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ROLE_LABELS } from '../../../core/auth/rbac';
import { NAV_ITEMS } from '../nav-data';

const COLLAPSE_KEY = 'lvb.sidebar.collapsed';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="flex h-full shrink-0 flex-col transition-[width] duration-200" [style.width.px]="collapsed() ? 72 : 256" style="background: var(--sidebar-bg)">
      <div class="flex items-center gap-2.5 h-16 shrink-0 px-3" [class.justify-center]="collapsed()" style="border-bottom: 1px solid var(--sidebar-border)">
        <div class="h-9 w-9 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden p-1">
          <img src="/logo/Logo_lvb.png" alt="LVB" class="h-full w-full object-contain" />
        </div>
        @if (!collapsed()) {
          <div class="min-w-0">
            <p class="text-sm font-semibold leading-tight truncate" style="color: var(--sidebar-text-active); font-family: var(--font-heading)">{{ i18n.t('app.name') }}</p>
            <p class="text-[11px] leading-tight truncate" style="color: var(--sidebar-text)">La Vie est Belle</p>
          </div>
        }
        <button type="button" class="ml-auto lg:hidden btn btn-ghost btn-sm !px-1.5" style="color: var(--sidebar-text)" (click)="closeMobile.emit()" aria-label="Fermer le menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto thin-scroll px-3 py-4 flex flex-col gap-0.5" aria-label="Navigation principale">
        @for (item of visibleItems(); track item.path) {
          <a
            [routerLink]="item.path" routerLinkActive="active-nav-link" [routerLinkActiveOptions]="{ exact: false }"
            class="nav-link flex items-center gap-3 rounded-(--radius-sm) py-2 text-sm font-medium transition-colors"
            [class.px-3]="!collapsed()" [class.justify-center]="collapsed()" [class.px-0]="collapsed()"
            [attr.title]="collapsed() ? i18n.t(item.labelKey) : null"
            [attr.aria-label]="collapsed() ? i18n.t(item.labelKey) : null"
            (click)="closeMobile.emit()"
          >
            <span class="relative shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path [attr.d]="item.icon" />
              </svg>
              @if (collapsed() && item.path === '/dashboard' && criticalAlerts() > 0) {
                <span class="absolute -top-1 -right-1.5 h-2 w-2 rounded-full" style="background: var(--status-critical)"></span>
              }
            </span>
            @if (!collapsed()) {
              <span class="truncate">{{ i18n.t(item.labelKey) }}</span>
              @if (item.path === '/dashboard' && criticalAlerts() > 0) {
                <span class="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style="background: var(--status-critical); color: white">{{ criticalAlerts() }}</span>
              }
            }
          </a>
        }
      </nav>

      <div class="p-3 shrink-0" style="border-top: 1px solid var(--sidebar-border)">
        <a
          routerLink="/account" class="flex items-center gap-2.5 rounded-(--radius-sm) py-2 transition-colors account-link"
          [class.px-2]="!collapsed()" [class.justify-center]="collapsed()"
          [attr.title]="collapsed() ? userName() : null" [attr.aria-label]="collapsed() ? userName() : null"
        >
          <div class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style="background: var(--accent); color: var(--sidebar-bg)">
            {{ userInitials() }}
          </div>
          @if (!collapsed()) {
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium truncate" style="color: var(--sidebar-text-active)">{{ userName() }}</p>
              <p class="text-[11px] truncate" style="color: var(--sidebar-text)">{{ userRoleLabel() }}</p>
            </div>
          }
        </a>

        @if (allowCollapse()) {
          <button
            type="button" class="hidden lg:flex items-center gap-2.5 rounded-(--radius-sm) py-2 mt-1 w-full transition-colors collapse-toggle"
            [class.px-2]="!collapsed()" [class.justify-center]="collapsed()"
            [attr.aria-expanded]="!collapsed()" aria-label="Réduire ou étendre le menu"
            (click)="toggleCollapsed()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 transition-transform" [style.transform]="collapsed() ? 'rotate(180deg)' : 'none'">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            @if (!collapsed()) { <span class="text-xs font-medium">Réduire</span> }
          </button>
        }
      </div>
    </aside>
    <style>
      .nav-link { color: var(--sidebar-text); }
      .nav-link:hover { background: var(--sidebar-bg-elevated); color: var(--sidebar-text-active); }
      .active-nav-link { background: var(--sidebar-active-bg); color: var(--sidebar-text-active); }
      .account-link { background: var(--sidebar-bg-elevated); }
      .account-link:hover { background: var(--brand); }
      .collapse-toggle { color: var(--sidebar-text); }
      .collapse-toggle:hover { background: var(--sidebar-bg-elevated); color: var(--sidebar-text-active); }
    </style>
  `,
})
export class SidebarComponent {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);

  readonly closeMobile = output<void>();
  readonly allowCollapse = input(true);

  protected readonly collapsed = signal(this.readCollapsed());

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

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem(COLLAPSE_KEY, String(next));
  }

  private readCollapsed(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  }
}
