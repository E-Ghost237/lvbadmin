import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AlertBannerComponent, FormFieldComponent, FormFeedbackService,
} from '../../../shared/ui';

/** UC-AUT-05 (web) — lien signé à usage unique, réponse anti-énumération identique dans tous les cas. */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, AlertBannerComponent],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.feedback.invalid(this.form);
      return;
    }
    this.submitting.set(true);
    this.auth.requestPasswordReset(this.form.getRawValue().email).subscribe(() => {
      this.submitting.set(false);
      this.sent.set(true);
    });
  }
}
