import { Component, ElementRef, HostListener, computed, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';

type Theme = 'light' | 'dark' | 'system';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink],
  template: `
    <header class="lvb-topbar flex items-center gap-3 h-16 px-4 lg:px-6 shrink-0 relative z-30">
      <button type="button" class="lg:hidden btn btn-ghost btn-sm !px-1.5 topbar-icon-btn" (click)="openMobileMenu.emit()" aria-label="Ouvrir le menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <p class="hidden md:block text-[13px] font-medium" style="color: var(--text-muted)">{{ todayLabel() }}</p>

      <div class="ml-auto flex items-center gap-1.5">
        <button type="button" class="btn btn-ghost btn-sm topbar-icon-btn" (click)="i18n.toggle()" aria-label="Changer de langue">
          {{ i18n.isEnglish() ? 'FR' : 'EN' }}
        </button>

        <button type="button" class="btn btn-ghost btn-sm !px-2 topbar-icon-btn" (click)="cycleTheme()" [attr.aria-label]="'Changer de thème'" [attr.title]="themeLabel()">
          @switch (theme()) {
            @case ('light') { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg> }
            @case ('dark') { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg> }
            @default { <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 20h8M12 16v4" /></svg> }
          }
        </button>

        <span class="mx-1 h-5 w-px" style="background: var(--border-strong)"></span>

        <div class="relative">
          <button type="button" class="flex items-center gap-2 rounded-full p-1 topbar-icon-btn" (click)="toggleProfile()">
            <span class="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ring-offset-2" style="background: var(--grad-brand); color: #fff; --tw-ring-color: var(--brand-100); --tw-ring-offset-color: var(--surface-1)">{{ userInitials() }}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hidden sm:block" style="color: var(--text-muted)"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          @if (profileOpen()) {
            <div class="absolute right-0 mt-2 w-60 card shadow-(--shadow-lg) z-40 overflow-hidden">
              <div class="px-4 py-3" style="border-bottom: 1px solid var(--border); background: var(--surface-2)">
                <p class="text-sm font-semibold truncate">{{ userLabel() }}</p>
                <p class="text-xs truncate" style="color: var(--text-muted)">{{ userEmail() }}</p>
              </div>
              <a routerLink="/account" class="block px-4 py-2.5 text-sm font-medium hover:bg-(--surface-2)" (click)="profileOpen.set(false)">{{ i18n.t('nav.account') }}</a>
              <button type="button" class="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-(--status-critical-bg)" style="color: var(--status-critical)" (click)="logout()">
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly openMobileMenu = output<void>();

  protected readonly profileOpen = signal(false);
  protected readonly theme = signal<Theme>(this.readTheme());

  protected readonly userEmail = computed(() => this.auth.identity()?.email ?? '');
  protected readonly userLabel = computed(() => {
    const id = this.auth.identity();
    const name = [id?.prenom, id?.nom].filter(Boolean).join(' ').trim();
    return name || id?.email || '';
  });
  protected readonly userInitials = computed(() => (this.userLabel().slice(0, 2) || '?').toUpperCase());
  protected readonly themeLabel = computed(() => ({ light: 'Thème clair', dark: 'Thème sombre', system: 'Thème automatique' })[this.theme()]);

  protected readonly todayLabel = computed(() => {
    const locale = this.i18n.isEnglish() ? 'en-GB' : 'fr-FR';
    const label = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

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
