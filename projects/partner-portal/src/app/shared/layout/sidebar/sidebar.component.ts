import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronLeft, faXmark } from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '@lvb/auth/auth.service';
import { I18nService } from '@lvb/i18n/i18n.service';
import { NAV_ITEMS } from '../nav-data';

const COLLAPSE_KEY = 'lvb.sidebar.collapsed';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, FaIconComponent],
  template: `
    <aside class="flex h-full shrink-0 flex-col transition-[width] duration-200" [style.width.px]="collapsed() ? 72 : 256" style="background: var(--sidebar-bg)">
      <div class="flex items-center gap-2.5 h-18 shrink-0 px-3" [class.justify-center]="collapsed()" style="border-bottom: 1px solid var(--sidebar-border)">
        <img src="/logo/Logo_lvb_trimmed.png" alt="LVB" class="h-14 w-auto shrink-0" />
        @if (!collapsed()) {
          <div class="min-w-0">
            <p class="text-sm font-semibold leading-tight truncate" style="color: var(--sidebar-text-active); font-family: var(--font-heading)">{{ i18n.t('partner.app.name') }}</p>
            <p class="text-[11px] leading-tight truncate" style="color: var(--sidebar-text)">La Vie est Belle</p>
          </div>
        }
        <button type="button" class="ml-auto lg:hidden btn btn-ghost btn-sm !px-1.5" style="color: var(--sidebar-text)" (click)="closeMobile.emit()" aria-label="Fermer le menu">
          <fa-icon [icon]="closeIcon" style="font-size: 16px"></fa-icon>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto thin-scroll px-3 py-4 flex flex-col gap-0.5" aria-label="Navigation principale">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path" routerLinkActive="active-nav-link" [routerLinkActiveOptions]="{ exact: false }"
            class="nav-link flex items-center gap-3 rounded-(--radius-sm) py-2 text-sm font-medium transition-colors"
            [class.px-3]="!collapsed()" [class.justify-center]="collapsed()" [class.px-0]="collapsed()"
            [attr.title]="collapsed() ? i18n.t(item.labelKey) : null"
            [attr.aria-label]="collapsed() ? i18n.t(item.labelKey) : null"
            (click)="closeMobile.emit()"
          >
            <fa-icon [icon]="item.icon" class="shrink-0" style="font-size: 16px; width: 18px; text-align: center" aria-hidden="true"></fa-icon>
            @if (!collapsed()) {
              <span class="truncate">{{ i18n.t(item.labelKey) }}</span>
            }
          </a>
        }
      </nav>

      <div class="p-3 shrink-0" style="border-top: 1px solid var(--sidebar-border)">
        <a
          routerLink="/account" class="flex items-center gap-2.5 rounded-(--radius-sm) py-2 transition-colors account-link"
          [class.px-2]="!collapsed()" [class.justify-center]="collapsed()"
          [attr.title]="collapsed() ? userEmail() : null" [attr.aria-label]="collapsed() ? userEmail() : null"
        >
          <div class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style="background: var(--accent); color: var(--sidebar-bg)">
            {{ userInitials() }}
          </div>
          @if (!collapsed()) {
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium truncate" style="color: var(--sidebar-text-active)">{{ userLabel() }}</p>
              <p class="text-[11px] truncate" style="color: var(--sidebar-text)">Mon compte</p>
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
            <fa-icon
              [icon]="collapseIcon" class="shrink-0 transition-transform" style="font-size: 14px"
              [style.transform]="collapsed() ? 'rotate(180deg)' : 'none'"
            ></fa-icon>
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

  readonly closeMobile = output<void>();
  readonly allowCollapse = input(true);

  protected readonly navItems = NAV_ITEMS;
  protected readonly closeIcon = faXmark;
  protected readonly collapseIcon = faChevronLeft;
  protected readonly collapsed = signal(this.readCollapsed());

  protected readonly userEmail = computed(() => this.auth.identity()?.email ?? '');
  protected readonly userLabel = computed(() => {
    const id = this.auth.identity();
    const name = [id?.prenom, id?.nom].filter(Boolean).join(' ').trim();
    return name || id?.email || '';
  });
  protected readonly userInitials = computed(() => (this.userLabel().slice(0, 2) || '?').toUpperCase());

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
