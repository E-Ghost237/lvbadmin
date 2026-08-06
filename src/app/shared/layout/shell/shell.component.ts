import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { ConfirmHostComponent } from '../../ui/confirm/confirm-host.component';
import { ToastContainerComponent } from '../../ui/toast/toast-container.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ConfirmHostComponent, ToastContainerComponent],
  template: `
    <div class="flex h-screen overflow-hidden">
      <div class="hidden lg:block">
        <app-sidebar />
      </div>

      @if (mobileMenuOpen()) {
        <div class="fixed inset-0 z-40 lg:hidden">
          <div class="absolute inset-0 bg-black/40" (click)="mobileMenuOpen.set(false)"></div>
          <div class="absolute inset-y-0 left-0">
            <app-sidebar [allowCollapse]="false" (closeMobile)="mobileMenuOpen.set(false)" />
          </div>
        </div>
      }

      <div class="flex-1 flex flex-col min-w-0">
        <app-topbar (openMobileMenu)="mobileMenuOpen.set(true)" />
        <main class="flex-1 overflow-y-auto thin-scroll">
          <div class="max-w-[1400px] mx-auto p-4 lg:p-6">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
    <app-confirm-host />
    <app-toast-container />
  `,
})
export class ShellComponent {
  protected readonly mobileMenuOpen = signal(false);
}
