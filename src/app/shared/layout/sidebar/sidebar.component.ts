import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronLeft, faXmark } from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NAV_ITEMS, NavItem } from '../nav-data';

const COLLAPSE_KEY = 'lvb.sidebar.collapsed';

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const GROUP_DEFS: { labelKey: string; paths: string[] }[] = [
  { labelKey: 'nav.group.operations', paths: ['/dashboard', '/orders', '/teleconseiller', '/drivers'] },
  { labelKey: 'nav.group.network', paths: ['/pricing', '/partners', '/marketplace', '/wallet'] },
  { labelKey: 'nav.group.steering', paths: ['/finance', '/claims', '/reports'] },
  { labelKey: 'nav.group.admin', paths: ['/users', '/settings', '/audit'] },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, FaIconComponent],
  template: `
    <aside class="lvb-sidebar" [style.width.px]="collapsed() ? 76 : 264">
      <div class="sidebar-brand" [class.justify-center]="collapsed()">
        <img src="/logo/Logo_lvb_trimmed.png" alt="LVB" class="w-auto shrink-0 brightness-0 invert" [class.h-8]="collapsed()" [class.h-9]="!collapsed()" />
        @if (!collapsed()) {
          <div class="min-w-0">
            <p class="text-[13px] font-extrabold leading-tight truncate" style="color: var(--sidebar-text-active); font-family: var(--font-heading)">{{ i18n.t('app.name') }}</p>
            <p class="text-[10.5px] leading-tight truncate" style="color: var(--sidebar-text)">La Vie est Belle</p>
          </div>
        }
        <button type="button" class="ml-auto lg:hidden btn btn-ghost btn-sm !px-1.5" style="color: var(--sidebar-text)" (click)="closeMobile.emit()" aria-label="Fermer le menu">
          <fa-icon [icon]="closeIcon" style="font-size: 16px"></fa-icon>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto thin-scroll px-3 py-3 flex flex-col gap-0.5" aria-label="Navigation principale">
        @for (group of groups; track group.labelKey; let first = $first) {
          @if (group.items.length) {
            @if (!collapsed()) {
              <p class="nav-group-label">{{ i18n.t(group.labelKey) }}</p>
            } @else if (!first) {
              <div class="nav-group-sep"></div>
            }
            @for (item of group.items; track item.path) {
              <a
                [routerLink]="item.path" routerLinkActive="active-nav-link" [routerLinkActiveOptions]="{ exact: false }"
                class="nav-link flex items-center gap-3 rounded-[10px] py-2 text-[13px] font-medium transition-colors"
                [class.px-3]="!collapsed()" [class.justify-center]="collapsed()" [class.px-0]="collapsed()"
                [attr.title]="collapsed() ? i18n.t(item.labelKey) : null"
                [attr.aria-label]="collapsed() ? i18n.t(item.labelKey) : null"
                (click)="closeMobile.emit()"
              >
                <fa-icon [icon]="item.icon" class="shrink-0" style="font-size: 15px; width: 18px; text-align: center" aria-hidden="true"></fa-icon>
                @if (!collapsed()) {
                  <span class="truncate">{{ i18n.t(item.labelKey) }}</span>
                }
              </a>
            }
          }
        }
      </nav>

      <div class="p-3 shrink-0">
        <a
          routerLink="/account" class="sidebar-account flex items-center gap-2.5 rounded-[12px] p-2 transition-colors"
          [class.justify-center]="collapsed()"
          [attr.title]="collapsed() ? userEmail() : null" [attr.aria-label]="collapsed() ? userEmail() : null"
        >
          <div class="h-8 w-8 rounded-[10px] flex items-center justify-center text-xs font-bold shrink-0" style="background: var(--chrome-accent); color: #06152b">
            {{ userInitials() }}
          </div>
          @if (!collapsed()) {
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold truncate" style="color: var(--sidebar-text-active)">{{ userLabel() }}</p>
              <p class="text-[10.5px] truncate" style="color: var(--sidebar-text)">Mon compte</p>
            </div>
          }
        </a>

        @if (allowCollapse()) {
          <button
            type="button" class="hidden lg:flex items-center gap-2.5 rounded-[10px] py-2 mt-1 w-full transition-colors hover:bg-(--sidebar-bg-elevated)"
            style="color: var(--sidebar-text)"
            [class.px-2]="!collapsed()" [class.justify-center]="collapsed()"
            [attr.aria-expanded]="!collapsed()" aria-label="Réduire ou étendre le menu"
            (click)="toggleCollapsed()"
          >
            <fa-icon
              [icon]="collapseIcon" class="shrink-0 transition-transform" style="font-size: 13px"
              [style.transform]="collapsed() ? 'rotate(180deg)' : 'none'"
            ></fa-icon>
            @if (!collapsed()) { <span class="text-xs font-medium">Réduire</span> }
          </button>
        }
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly closeMobile = output<void>();
  readonly allowCollapse = input(true);

  protected readonly groups: NavGroup[] = GROUP_DEFS.map((g) => ({
    labelKey: g.labelKey,
    items: NAV_ITEMS.filter((i) => g.paths.includes(i.path)),
  }));
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
