import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from '@lvb/http/auth.interceptor';
import { requestContextInterceptor } from '@lvb/http/request-context.interceptor';
import { errorNormalizationInterceptor } from '@lvb/http/error-normalization.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([
      requestContextInterceptor,
      errorNormalizationInterceptor,
      authInterceptor,
    ])),
  ],
};
