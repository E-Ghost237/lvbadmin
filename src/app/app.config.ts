import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './core/http/auth.interceptor';
import { requestContextInterceptor } from './core/http/request-context.interceptor';
import { errorNormalizationInterceptor } from './core/http/error-normalization.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    // Wired for when Http*Service implementations replace the mock layer (§9 API spec).
    provideHttpClient(withFetch(), withInterceptors([
      requestContextInterceptor,
      errorNormalizationInterceptor,
      authInterceptor,
    ])),
  ]
};
