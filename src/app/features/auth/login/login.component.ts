import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService, DEMO_MFA_CODE, DEMO_PASSWORD } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ProblemDetails } from '../../../core/models';
import { digitCode } from '../../../core/utils/validators';
import { AlertBannerComponent, FormFieldComponent } from '../../../shared/ui';

type Step = 'CREDENTIALS' | 'MFA';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, AlertBannerComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);

  protected readonly step = signal<Step>('CREDENTIALS');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly demoPassword = DEMO_PASSWORD;
  protected readonly demoMfaCode = DEMO_MFA_CODE;
  protected readonly currentYear = new Date().getFullYear();

  protected readonly demoAccounts = [
    { email: 'estelle.manga@lvb.cm', role: 'Administrateur' },
    { email: 'regis.owona@lvb.cm', role: 'Superviseur Opérations' },
    { email: 'cyrille.ateba@lvb.cm', role: 'Responsable Financier' },
    { email: 'larissa.mvondo@lvb.cm', role: 'Téléconseillère' },
  ];

  protected readonly credentialsForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly mfaForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, digitCode(6)]],
  });

  fillDemo(email: string): void {
    this.credentialsForm.patchValue({ email, password: DEMO_PASSWORD });
  }

  submitCredentials(): void {
    if (this.credentialsForm.invalid) {
      this.credentialsForm.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    const { email, password } = this.credentialsForm.getRawValue();
    this.auth.login(email, password).subscribe({
      next: ({ step }) => {
        this.submitting.set(false);
        if (step === 'MFA') this.step.set('MFA');
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
      this.mfaForm.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    this.auth.verifyMfa(this.mfaForm.getRawValue().code).subscribe({
      next: () => {
        this.submitting.set(false);
        this.redirectAfterLogin();
      },
      error: (err: ProblemDetails) => {
        this.submitting.set(false);
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
