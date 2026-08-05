import { Component, ElementRef, HostListener, computed, inject, output, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ROLE_LABELS } from '../../../core/auth/rbac';
import { formatRelative } from '../../../core/utils/formatters';

type Theme = 'light' | 'dark' | 'system';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink],
  template: `
    <header class="flex items-center gap-3 h-16 px-4 lg:px-6 shrink-0" style="background: var(--surface-1); border-bottom: 1px solid var(--border)">
      <button type="button" class="lg:hidden btn btn-ghost btn-sm !px-1.5" (click)="openMobileMenu.emit()" aria-label="Ouvrir le menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <form class="hidden md:flex flex-1 max-w-md" (submit)="onSearchSubmit($event)">
        <div class="relative w-full">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-muted)" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input #searchInput type="search" class="input !pl-9" placeholder="Rechercher une commande, un livreur, un client…" />
        </div>
      </form>

      <div class="ml-auto flex items-center gap-1.5">
        <button type="button" class="btn btn-ghost btn-sm" (click)="i18n.toggle()" [attr.aria-label]="'Changer de langue'">
          {{ i18n.isEnglish() ? 'FR' : 'EN' }}
        </button>

        <button type="button" class="btn btn-ghost btn-sm !px-2" (click)="cycleTheme()" [attr.aria-label]="'Changer de thème'" [attr.title]="themeLabel()">
          @switch (theme()) {
            @case ('light') { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg> }
            @case ('dark') { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg> }
            @default { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 20h8M12 16v4" /></svg> }
          }
        </button>

        <div class="relative">
          <button type="button" class="btn btn-ghost btn-sm !px-2 relative" (click)="toggleNotif()" aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
            @if (notifications.unreadCount() > 0) {
              <span class="absolute top-0.5 right-0.5 h-2 w-2 rounded-full" style="background: var(--status-critical)"></span>
            }
          </button>
          @if (notifOpen()) {
            <div class="absolute right-0 mt-2 w-80 card shadow-(--shadow-lg) z-40 overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid var(--border)">
                <p class="text-sm font-semibold">Notifications</p>
                @if (notifications.unreadCount() > 0) {
                  <button type="button" class="text-xs link" (click)="notifications.markAllNotificationsRead()">Tout marquer comme lu</button>
                }
              </div>
              <div class="max-h-80 overflow-y-auto thin-scroll">
                @for (n of notifications.notifications(); track n.id) {
                  <button type="button" class="w-full text-left px-4 py-3 flex gap-2.5 hover:bg-(--surface-2) transition-colors" [style.opacity]="n.lue ? 0.6 : 1" (click)="notifications.markNotificationRead(n.id)" style="border-bottom: 1px solid var(--border)">
                    <span class="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" [style.background]="n.lue ? 'transparent' : 'var(--brand)'"></span>
                    <span class="min-w-0">
                      <span class="block text-xs font-medium">{{ n.titre }}</span>
                      <span class="block text-[11px] mt-0.5" style="color: var(--text-muted)">{{ n.message }}</span>
                      <span class="block text-[10px] mt-1" style="color: var(--text-muted)">{{ relative(n.cree_le) }}</span>
                    </span>
                  </button>
                } @empty {
                  <p class="text-xs text-center py-6" style="color: var(--text-muted)">Aucune notification</p>
                }
              </div>
            </div>
          }
        </div>

        <div class="relative">
          <button type="button" class="flex items-center gap-2 rounded-(--radius-sm) px-1.5 py-1 hover:bg-(--surface-2)" (click)="toggleProfile()">
            <span class="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style="background: var(--brand)">{{ userInitials() }}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hidden sm:block" style="color: var(--text-muted)"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          @if (profileOpen()) {
            <div class="absolute right-0 mt-2 w-56 card shadow-(--shadow-lg) z-40 overflow-hidden">
              <div class="px-4 py-3" style="border-bottom: 1px solid var(--border)">
                <p class="text-sm font-medium truncate">{{ userName() }}</p>
                <p class="text-xs truncate" style="color: var(--text-muted)">{{ userRole() }}</p>
              </div>
              <a routerLink="/account" class="block px-4 py-2.5 text-sm hover:bg-(--surface-2)" (click)="profileOpen.set(false)">{{ i18n.t('nav.account') }}</a>
              <button type="button" class="w-full text-left px-4 py-2.5 text-sm hover:bg-(--surface-2)" style="color: var(--status-critical)" (click)="logout()">
                {{ i18n.t('action.logout') }}
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly notifications = inject(NotificationsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly openMobileMenu = output<void>();

  protected readonly notifOpen = signal(false);
  protected readonly profileOpen = signal(false);
  protected readonly theme = signal<Theme>(this.readTheme());

  protected readonly userInitials = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.prenom?.[0] ?? ''}${u.nom[0] ?? ''}`.toUpperCase() || '?' : '?';
  });
  protected readonly userName = computed(() => {
    const u = this.auth.currentUser();
    return u ? `${u.prenom} ${u.nom}` : '';
  });
  protected readonly userRole = computed(() => {
    const u = this.auth.currentUser();
    return u ? ROLE_LABELS[u.role] : '';
  });
  protected readonly themeLabel = computed(() => ({ light: 'Thème clair', dark: 'Thème sombre', system: 'Thème automatique' })[this.theme()]);

  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.notifOpen.set(false);
      this.profileOpen.set(false);
    }
  }

  toggleNotif(): void {
    this.notifOpen.update((v) => !v);
    this.profileOpen.set(false);
  }

  toggleProfile(): void {
    this.profileOpen.update((v) => !v);
    this.notifOpen.set(false);
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    const value = this.searchInputRef()?.nativeElement.value.trim();
    if (value) this.router.navigate(['/orders'], { queryParams: { search: value } });
  }

  relative(iso: string): string {
    return formatRelative(iso, this.i18n.locale());
  }

  private readTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'system';
    return (localStorage.getItem('lvb.theme') as Theme) || 'system';
  }

  cycleTheme(): void {
    const order: Theme[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(this.theme()) + 1) % order.length];
    this.theme.set(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem('lvb.theme', next);
    if (typeof document !== 'undefined') {
      if (next === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', next);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
