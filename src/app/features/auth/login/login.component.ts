import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ProblemDetails } from '../../../core/models';
import { digitCode, emailAddress } from '../../../core/utils/validators';
import { AlertBannerComponent, FormFieldComponent, FormFeedbackService,
} from '../../../shared/ui';
import { PasswordToggleComponent } from '../../../shared/ui/password-toggle/password-toggle.component';

type Step = 'CREDENTIALS' | 'MFA';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, AlertBannerComponent, PasswordToggleComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feedback = inject(FormFeedbackService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);

  protected readonly step = signal<Step>('CREDENTIALS');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly currentYear = new Date().getFullYear();

  protected readonly credentialsForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, emailAddress()]],
    password: ['', [Validators.required]],
  });

  protected readonly mfaForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, digitCode(6)]],
  });

  submitCredentials(): void {
    if (this.credentialsForm.invalid) {
      this.feedback.invalid(this.credentialsForm);
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    const { email, password } = this.credentialsForm.getRawValue();
    this.auth.login(email, password).subscribe({
      next: ({ outcome }) => {
        this.submitting.set(false);
        // Internal accounts must enter the emailed second-factor code; mobile-type
        // accounts (clients, partner members…) get their session straight away.
        if (outcome === 'MFA') this.step.set('MFA');
        else this.redirectAfterLogin();
      },
      error: (err: ProblemDetails) => {
        this.submitting.set(false);
        this.errorMessage.set(err.detail);
      },
    });
  }

  submitMfa(): void {
    if (this.mfaForm.invalid) {
      this.feedback.invalid(this.mfaForm);
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    const email = this.credentialsForm.getRawValue().email;
    this.auth.verifyMfa(email, this.mfaForm.getRawValue().code).subscribe({
      next: () => {
        this.submitting.set(false);
        this.redirectAfterLogin();
      },
      error: (err: ProblemDetails) => {
        this.submitting.set(false);
        // The one-time challenge is gone (expired / lost) — only a fresh login can issue a new one.
        if (err.status === 440) this.backToCredentials();
        this.errorMessage.set(err.detail);
      },
    });
  }

  backToCredentials(): void {
    this.step.set('CREDENTIALS');
    this.mfaForm.reset();
    this.errorMessage.set('');
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(returnUrl || '/');
  }
}
