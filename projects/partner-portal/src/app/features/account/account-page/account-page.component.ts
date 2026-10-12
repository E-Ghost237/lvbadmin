import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@lvb/auth/auth.service';
import { AccountService, ConsentType } from '../../../core/services/account.service';
import { NotificationCategory, NotificationPreference } from '../../../core/models';
import { DeviceSessionSummary } from '@lvb/models/user.model';
import { ProblemDetails } from '@lvb/models/common.model';
import { formatDateTime } from '@lvb/utils/formatters';
import { PageHeaderComponent } from '@lvb/ui/page-header/page-header.component';
import { TabDef, TabsComponent } from '@lvb/ui/tabs/tabs.component';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';
import { ToggleComponent } from '@lvb/ui/toggle/toggle.component';
import { AlertBannerComponent } from '@lvb/ui/alert-banner/alert-banner.component';
import { SelectComponent, SelectOption } from '@lvb/ui/select/select.component';
import { ConfirmService } from '@lvb/ui/confirm/confirm.service';
import { ToastService } from '@lvb/ui/toast/toast.service';

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Ne pas modifier' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' },
];

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  TRANSACTIONNEL_CRITIQUE: 'Notifications critiques (codes de livraison, OTP, incidents)',
  TRANSACTIONNEL: 'Notifications transactionnelles',
  SUPPORT: 'Support',
  MARKETING: 'Marketing',
};

/**
 * Personal account settings — `/v1/profile/*` + `/v1/notification-preferences`
 * (Identity + Notifications modules). Distinct from the org's own
 * `/v1/partner/profile` (see the Profil page) — this is "my account", not
 * "my organization". Session management, the password-reset request, and
 * the name/language patch reuse the shared `AuthService` as-is (identical
 * across every app); only consent/export/deletion/notification-preferences
 * are partner-portal-local (`AccountService`), since admin's own copy of
 * that service has the notification-preferences response shape wrong (it
 * expects a bare `Record<string, boolean>`; the real backend returns a
 * list of `{category, enabled, can_disable}` — confirmed by reading the
 * current backend source directly).
 */
@Component({
  selector: 'app-account-page',
  imports: [
  AlertBannerComponent,
  FormFieldComponent,
  PageHeaderComponent,
  ReactiveFormsModule,
  SelectComponent,
  TabsComponent,
  ToggleComponent,
],
  templateUrl: './account-page.component.html',
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly languageOptions = LANGUAGE_OPTIONS;
  protected readonly categoryLabel = CATEGORY_LABEL;
  protected readonly email = this.auth.identity()?.email ?? '';
  protected readonly tabs: TabDef[] = [
    { id: 'profil', label: 'Profil' }, { id: 'securite', label: 'Sécurité' },
    { id: 'notifications', label: 'Notifications' }, { id: 'confidentialite', label: 'Confidentialité' },
  ];
  protected readonly activeTab = signal('profil');

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'securite' && this.sessions().length === 0) this.fetchSessions();
    if (id === 'notifications' && this.prefs().length === 0) this.fetchPrefs();
  }

  sessionActivity(session: DeviceSessionSummary): string {
    return formatDateTime(`${session.derniereActiviteLe.date.replace(' ', 'T')}Z`);
  }

  // --- Profil -----------------------------------------------------------

  protected readonly profileForm = this.fb.nonNullable.group({ prenom: [''], nom: [''], langue: [''] });
  protected readonly savingProfile = signal(false);

  saveProfile(): void {
    const v = this.profileForm.getRawValue();
    const patch: { nom?: string; prenom?: string; langue?: 'fr' | 'en' } = {};
    if (v.nom.trim()) patch.nom = v.nom.trim();
    if (v.prenom.trim()) patch.prenom = v.prenom.trim();
    if (v.langue) patch.langue = v.langue as 'fr' | 'en';
    if (Object.keys(patch).length === 0) return;
    this.savingProfile.set(true);
    this.auth.updateProfile(patch).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success('Profil mis à jour');
        this.profileForm.reset({ prenom: '', nom: '', langue: '' });
      },
      error: (err: ProblemDetails) => { this.savingProfile.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Sécurité -----------------------------------------------------------

  protected readonly sessions = signal<DeviceSessionSummary[]>([]);
  protected readonly loadingSessions = signal(true);
  protected readonly requestingReset = signal(false);

  fetchSessions(): void {
    this.loadingSessions.set(true);
    this.auth.sessions().subscribe({
      next: (s) => { this.loadingSessions.set(false); this.sessions.set(s); },
      error: (err: ProblemDetails) => { this.loadingSessions.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  revokeSession(session: DeviceSessionSummary): void {
    this.auth.revokeSession(session.id).subscribe({
      next: () => { this.toast.success('Session révoquée'); this.fetchSessions(); },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  requestPasswordReset(): void {
    this.requestingReset.set(true);
    this.auth.requestPasswordReset(this.email).subscribe({
      next: () => { this.requestingReset.set(false); this.toast.success('Lien envoyé', 'Consultez votre messagerie professionnelle.'); },
      error: (err: ProblemDetails) => { this.requestingReset.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  // --- Notifications ------------------------------------------------------

  protected readonly prefs = signal<NotificationPreference[]>([]);
  protected readonly loadingPrefs = signal(true);

  fetchPrefs(): void {
    this.loadingPrefs.set(true);
    this.account.notificationPreferences().subscribe({
      next: (r) => { this.loadingPrefs.set(false); this.prefs.set(r.preferences); },
      error: (err: ProblemDetails) => { this.loadingPrefs.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  togglePref(pref: NotificationPreference, enabled: boolean): void {
    if (!pref.can_disable && !enabled) return;
    this.account.updateNotificationPreference(pref.category, enabled).subscribe({
      next: () => {
        this.prefs.update((list) => list.map((p) => (p.category === pref.category ? { ...p, enabled } : p)));
        this.toast.success('Préférence mise à jour');
      },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  // --- Confidentialité --------------------------------------------------

  protected readonly consents: { type: ConsentType; label: string }[] = [
    { type: 'MARKETING', label: 'Communications marketing' },
    { type: 'PARTAGE_POSITION', label: 'Partage de position' },
  ];
  protected readonly consentState = signal<Partial<Record<ConsentType, boolean>>>({});
  protected readonly exporting = signal(false);
  protected readonly requestingDeletion = signal(false);

  toggleConsent(type: ConsentType, accepte: boolean): void {
    this.account.updateConsent(type, accepte).subscribe({
      next: () => {
        this.consentState.update((s) => ({ ...s, [type]: accepte }));
        this.toast.success('Consentement enregistré');
      },
      error: (err: ProblemDetails) => this.toast.error('Échec', err.detail),
    });
  }

  exportData(): void {
    this.exporting.set(true);
    this.account.exportData().subscribe({
      next: (data) => {
        this.exporting.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mes-donnees.json';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err: ProblemDetails) => { this.exporting.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  async requestDeletion(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Supprimer mon compte ?', message: 'Anonymisation sous 30 jours, sauf commande en cours ou solde non nul.', danger: true });
    if (!ok) return;
    this.requestingDeletion.set(true);
    this.account.requestDeletion().subscribe({
      next: (res) => { this.requestingDeletion.set(false); this.toast.success(res.message); },
      error: (err: ProblemDetails) => { this.requestingDeletion.set(false); this.toast.error('Échec', err.detail); },
    });
  }
}
