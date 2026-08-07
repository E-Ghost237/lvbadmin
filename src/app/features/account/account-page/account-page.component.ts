import { KeyValuePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountService, ConsentType } from '../../../core/services/account.service';
import { DeviceSessionSummary, ProblemDetails } from '../../../core/models';
import { formatDateTime } from '../../../core/utils/formatters';
import {
  AlertBannerComponent, BreadcrumbsComponent, ConfirmService, FormFieldComponent, TabDef, TabsComponent,
  ToggleComponent, ToastService,
} from '../../../shared/ui';

@Component({
  selector: 'app-account-page',
  imports: [KeyValuePipe, ReactiveFormsModule, BreadcrumbsComponent, TabsComponent, FormFieldComponent, ToggleComponent, AlertBannerComponent],
  templateUrl: './account-page.component.html',
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly email = this.auth.identity()?.email ?? '';
  protected readonly tabs: TabDef[] = [
    { id: 'profil', label: 'Profil' }, { id: 'securite', label: 'Sécurité' },
    { id: 'notifications', label: 'Notifications' }, { id: 'confidentialite', label: 'Confidentialité' },
  ];
  protected readonly activeTab = signal('profil');

  // --- Profil -----------------------------------------------------------
  protected readonly profileForm = this.fb.nonNullable.group({
    prenom: [''],
    nom: [''],
    langue: [''],
  });
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
      error: (err: ProblemDetails) => {
        this.savingProfile.set(false);
        this.toast.error('Échec', err.detail);
      },
    });
  }

  // --- Sécurité -----------------------------------------------------------
  protected readonly sessions = signal<DeviceSessionSummary[]>([]);
  protected readonly loadingSessions = signal(true);
  protected readonly requestingReset = signal(false);

  selectTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'securite' && this.sessions().length === 0) this.fetchSessions();
    if (id === 'notifications' && this.prefs() === null) this.fetchPrefs();
  }

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
  protected readonly prefs = signal<Record<string, boolean> | null>(null);
  protected readonly loadingPrefs = signal(true);

  fetchPrefs(): void {
    this.loadingPrefs.set(true);
    this.account.notificationPreferences().subscribe({
      next: (p) => { this.loadingPrefs.set(false); this.prefs.set(p); },
      error: (err: ProblemDetails) => { this.loadingPrefs.set(false); this.toast.error('Chargement impossible', err.detail); },
    });
  }

  togglePref(category: string, enabled: boolean): void {
    this.account.updateNotificationPreference(category, enabled).subscribe({
      next: () => {
        this.prefs.update((p) => (p ? { ...p, [category]: enabled } : p));
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

  sessionActivity(session: DeviceSessionSummary): string {
    return formatDateTime(`${session.derniereActiviteLe.date.replace(' ', 'T')}Z`);
  }
}
