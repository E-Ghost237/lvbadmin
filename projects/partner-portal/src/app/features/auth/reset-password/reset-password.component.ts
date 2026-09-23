import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@lvb/auth/auth.service';
import { I18nService } from '@lvb/i18n/i18n.service';
import { ProblemDetails } from '@lvb/models/common.model';
import { matchControls, passwordPolicy } from '@lvb/utils/validators';
import { AlertBannerComponent } from '@lvb/ui/alert-banner/alert-banner.component';
import { FormFieldComponent } from '@lvb/ui/field/form-field.component';

/** UC-AUT-05 — second half: completing the reset from the signed link's `?token=`. */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, AlertBannerComponent],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);

  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, passwordPolicy()]],
    password_confirmation: ['', [Validators.required]],
  }, { validators: matchControls('password', 'password_confirmation') });

  submit(): void {
    if (!this.token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    const { password, password_confirmation } = this.form.getRawValue();
    this.auth.resetPassword(this.token, password, password_confirmation).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: (err: ProblemDetails) => {
        this.submitting.set(false);
        this.errorMessage.set(err.detail);
      },
    });
  }
}
