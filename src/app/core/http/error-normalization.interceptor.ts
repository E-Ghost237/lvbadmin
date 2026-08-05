import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ProblemDetails } from '../models';

/**
 * API-05: normalizes any transport failure into the RFC 9457 `ProblemDetails`
 * shape our mock services already throw, so components downstream never
 * need to branch on "is this HttpErrorResponse or ProblemDetails".
 */
export const errorNormalizationInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as Partial<ProblemDetails> | null;
        const problem: ProblemDetails = {
          type: body?.type ?? 'about:blank',
          title: body?.title ?? err.statusText,
          status: err.status,
          code: body?.code ?? 'ERR-5000',
          detail: body?.detail ?? 'Une erreur inattendue est survenue.',
          instance: req.urlWithParams,
          request_id: body?.request_id ?? '',
          errors: body?.errors,
        };
        return throwError(() => problem);
      }
      return throwError(() => err);
    }),
  );
