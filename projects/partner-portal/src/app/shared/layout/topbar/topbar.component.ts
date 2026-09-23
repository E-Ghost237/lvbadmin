import { Component, ElementRef, HostListener, computed, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@lvb/auth/auth.service';
import { I18nService } from '@lvb/i18n/i18n.service';

type Theme = 'light' | 'dark' | 'system';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink],
  template: `
    <header class="flex items-center gap-3 h-18 px-4 lg:px-6 shrink-0" style="background: var(--sidebar-bg)">
      <button type="button" class="lg:hidden btn btn-ghost btn-sm !px-1.5 topbar-icon-btn" (click)="openMobileMenu.emit()" aria-label="Ouvrir le menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <div class="ml-auto flex items-center gap-1.5">
        <button type="button" class="btn btn-ghost btn-sm topbar-icon-btn" (click)="i18n.toggle()" [attr.aria-label]="'Changer de langue'">
          {{ i18n.isEnglish() ? 'FR' : 'EN' }}
        </button>

        <button type="button" class="btn btn-ghost btn-sm !px-2 topbar-icon-btn" (click)="cycleTheme()" [attr.aria-label]="'Changer de thème'" [attr.title]="themeLabel()">
          @switch (theme()) {
            @case ('light') { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg> }
            @case ('dark') { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg> }
            @default { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 20h8M12 16v4" /></svg> }
          }
        </button>

        <div class="relative">
          <button type="button" class="flex items-center gap-2 rounded-(--radius-sm) px-1.5 py-1 topbar-icon-btn" (click)="toggleProfile()">
            <span class="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold" style="background: var(--accent); color: var(--sidebar-bg)">{{ userInitials() }}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hidden sm:block" style="color: var(--sidebar-text)"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          @if (profileOpen()) {
            <div class="absolute right-0 mt-2 w-56 card shadow-(--shadow-lg) z-40 overflow-hidden">
              <div class="px-4 py-3" style="border-bottom: 1px solid var(--border)">
                <p class="text-sm font-medium truncate">{{ userEmail() }}</p>
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
    <style>
      .topbar-icon-btn { color: var(--sidebar-text); }
      .topbar-icon-btn:hover { background: var(--sidebar-bg-elevated); color: var(--sidebar-text-active); }
    </style>
  `,
})
export class TopbarComponent {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly openMobileMenu = output<void>();

  protected readonly profileOpen = signal(false);
  protected readonly theme = signal<Theme>(this.readTheme());

  protected readonly userEmail = computed(() => this.auth.identity()?.email ?? '');
  protected readonly userInitials = computed(() => (this.userEmail().slice(0, 2) || '?').toUpperCase());
  protected readonly themeLabel = computed(() => ({ light: 'Thème clair', dark: 'Thème sombre', system: 'Thème automatique' })[this.theme()]);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.profileOpen.set(false);
    }
  }

  toggleProfile(): void {
    this.profileOpen.update((v) => !v);
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
