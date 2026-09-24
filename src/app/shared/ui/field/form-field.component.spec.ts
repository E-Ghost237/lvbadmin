import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldComponent } from './form-field.component';

@Component({
  imports: [FormFieldComponent, ReactiveFormsModule],
  template: `<app-field label="Nom" [control]="control" required><input [formControl]="control" /></app-field>`,
})
class HostComponent {
  control = new FormControl('', [Validators.required]);
}

describe('FormFieldComponent', () => {
  it('shows the error as soon as the control becomes touched and invalid', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();

    fixture.componentInstance.control.markAsTouched();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.field-error')).not.toBeNull();
  });
});
