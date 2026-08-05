import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MockDbService } from '../../../core/mock/mock-db.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ProblemDetails, Session } from '../../../core/models';
import { matchControls, passwordPolicy, requiredTrimmed } from '../../../core/utils/validators';
import { formatDateTime, formatRelative } from '../../../core/utils/formatters';
import { ROLE_LABELS } from '../../../core/auth/rbac';
import {
  AlertBannerComponent, AvatarComponent, BreadcrumbsComponent, ConfirmService, FormFieldComponent, TabDef, TabsComponent,
  ToastService, ToggleComponent,
} from '../../../shared/ui';

interface NotificationPref {
  key: string;
  label: string;
  hint: string;
  locked: boolean;
}

@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, TabsComponent, FormFieldComponent, AlertBannerComponent, AvatarComponent, BreadcrumbsComponent, ToggleComponent],
  templateUrl: './account-page.component.html',
})
export class AccountPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly db = inject(MockDbService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationsService);
  protected readonly i18n = inject(I18nService);
  protected readonly roleLabels = ROLE_LABELS;

  protected readonly tabs: TabDef[] = [
    { id: 'profile', label: 'Profil' }, { id: 'security', label: 'Sécurité' },
    { id: 'notifications', label: 'Notifications' }, { id: 'privacy', label: 'Confidentialité' },
  ];
  protected readonly activeTab = signal('profile');

  // --- Profil ---------------------------------------------------------------
  protected readonly profileForm = this.fb.nonNullable.group({
    prenom: [this.auth.currentUser()?.prenom ?? '', [requiredTrimmed()]],
    nom: [this.auth.currentUser()?.nom ?? '', [requiredTrimmed()]],
    langue: [this.auth.currentUser()?.langue ?? 'fr', [Validators.required]],
  });
  protected readonly savingProfile = signal(false);

  // --- Sécurité ---------------------------------------------------------------
  protected readonly passwordForm = this.fb.nonNullable.group({
    current: ['', [Validators.required]],
    next: ['', [Validators.required, passwordPolicy()]],
    confirm: ['', [Validators.required]],
  }, { validators: [matchControls('next', 'confirm')] });
  protected readonly changingPassword = signal(false);

  protected readonly sessions = signal<Session[]>([]);
  protected readonly loadingSessions = signal(true);

  // --- Confidentialité --------------------------------------------------------
  protected readonly notificationPrefs = signal<NotificationPref[]>([
    { key: 'critical', label: 'Alertes critiques', hint: 'Retard SLA, incidents critiques — jamais désactivables.', locked: true },
    { key: 'daily', label: 'Résumé quotidien', hint: 'KPI du jour envoyés chaque matin.', locked: false },
    { key: 'product', label: 'Nouveautés produit', hint: 'Annonces de nouvelles fonctionnalités.', locked: false },
  ]);
  protected readonly prefState = signal<Record<string, boolean>>({ critical: true, daily: true, product: false });

  constructor() {
    this.loadSessions();
  }

  selectTab(id: string): void { this.activeTab.set(id); }

  saveProfile(): void {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.savingProfile.set(true);
    this.auth.updateOwnProfile(this.profileForm.getRawValue()).subscribe(() => {
      this.savingProfile.set(false);
      this.toast.success('Profil mis à jour');
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    const { current, next } = this.passwordForm.getRawValue();
    this.changingPassword.set(true);
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset({ current: '', next: '', confirm: '' });
        this.toast.success('Mot de passe modifié');
      },
      error: (err: ProblemDetails) => { this.changingPassword.set(false); this.toast.error('Échec', err.detail); },
    });
  }

  private loadSessions(): void {
    this.loadingSessions.set(true);
    this.auth.sessions().subscribe((res) => {
      this.sessions.set(res);
      this.loadingSessions.set(false);
    });
  }

  async revokeSession(session: Session): Promise<void> {
    if (session.courante) {
      const ok = await this.confirm.ask({ title: 'Révoquer cette session', danger: true, message: 'Vous serez déconnecté immédiatement. Continuer ?' });
      if (!ok) return;
    }
    this.auth.revokeSession(session.id).subscribe(() => {
      if (session.courante) {
        this.auth.logout();
        this.router.navigate(['/login']);
        return;
      }
      this.loadSessions();
      this.toast.success('Session révoquée');
    });
  }

  togglePref(key: string, value: boolean): void {
    this.prefState.update((s) => ({ ...s, [key]: value }));
    this.toast.info('Préférence enregistrée');
  }

  async requestDataExport(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Exporter mes données', message: 'Un export de vos données personnelles sera préparé et envoyé par email (UC-AUT-08). Continuer ?' });
    if (ok) this.toast.success('Demande enregistrée', 'Vous recevrez un lien de téléchargement sous peu.');
  }

  async requestAccountDeletion(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Demander la suppression du compte', danger: true, confirmLabel: 'Envoyer la demande', message: 'Votre compte sera anonymisé sous 30 jours, hors données à conservation légale (UC-AUT-08). Continuer ?' });
    if (ok) this.toast.info('Demande transmise', 'Traitement sous 30 jours.');
  }

  formatDateTime(v: string): string { return formatDateTime(v); }
  formatRelative(v: string): string { return formatRelative(v, this.i18n.locale()); }
}
