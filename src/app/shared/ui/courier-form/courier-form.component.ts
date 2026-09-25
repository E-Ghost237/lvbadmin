import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateCourierRequest } from '../../../core/models/courier.model';
import { ProblemDetails } from '../../../core/models/common.model';
import { cmMobilePhone, emailAddress, personName } from '../../../core/utils/validators';
import { CmPhoneDirective } from '../cm-phone/cm-phone.directive';
import { FormFeedbackService } from '../form-feedback/form-feedback.service';
import { FormFieldComponent } from '../field/form-field.component';

/**
 * Courier (livreur) account form shared by the admin app (`POST /admin/drivers`)
 * and the partner portal (`POST /partner/couriers`). The backend generates the
 * password and emails it, and the courier finishes the KYC dossier themselves,
 * so no password field exists here.
 */
@Component({
  selector: 'app-courier-form',
  imports: [ReactiveFormsModule, FormFieldComponent, CmPhoneDirective],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <app-field label="Nom" [control]="form.controls.nom" required><input class="input" formControlName="nom" autocomplete="off" /></app-field>
      <app-field label="Prénom" [control]="form.controls.prenom"><input class="input" formControlName="prenom" autocomplete="off" /></app-field>
      <app-field label="Téléphone" [control]="form.controls.telephone" required>
        <input class="input" appCmPhone formControlName="telephone" placeholder="+237 6 51 23 45 67" />
      </app-field>
      <app-field label="Email" [control]="form.controls.email" required hint="Le mot de passe temporaire y sera envoyé.">
        <input type="email" class="input" formControlName="email" placeholder="livreur@exemple.cm" autocomplete="off" />
      </app-field>
      <div class="sm:col-span-2 flex items-center justify-between gap-3">
        <p class="text-xs" style="color: var(--text-muted)">Le compte est créé « en attente de validation » : le livreur complète son dossier KYC, puis LVB l’approuve.</p>
        <button type="submit" class="btn btn-primary shrink-0" [disabled]="saving()">Créer le livreur</button>
      </div>
    </form>
  `,
})
export class CourierFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);

  readonly saving = input(false);
  readonly save = output<CreateCourierRequest>();

  protected readonly form = this.fb.nonNullable.group({
    nom: ['', [Validators.required, personName(), Validators.maxLength(100)]],
    prenom: ['', [personName(), Validators.maxLength(100)]],
    telephone: ['', [Validators.required, cmMobilePhone(), Validators.maxLength(32)]],
    email: ['', [Validators.required, emailAddress(), Validators.maxLength(255)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.feedback.invalid(this.form);
      return;
    }
    const v = this.form.getRawValue();
    this.save.emit({ nom: v.nom.trim(), prenom: v.prenom.trim() || null, telephone: v.telephone, email: v.email.trim().toLowerCase(), langue: 'fr' });
  }

  reset(): void {
    this.form.reset({ nom: '', prenom: '', telephone: '', email: '' });
  }

  /** Pins backend field errors under the matching inputs and toasts the message. */
  showServerError(title: string, err: ProblemDetails): void {
    this.feedback.serverError(this.form, title, err);
  }
}
