import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { buildFriendlyProblem } from '../errors/problem-message';
import { ProblemDetails } from '../models/common.model';

/**
 * API-05: normalizes any transport failure into the RFC 9457 `ProblemDetails`
 * shape so components downstream never need to branch on "is this
 * HttpErrorResponse or ProblemDetails".
 *
 * `detail` is rewritten into a plain, actionable message in the active
 * language (catalogue of every `ERR-xxxx`, per-field reasons for
 * validation failures, distinct wording for offline / session / permission /
 * rate-limit / server faults) — see `problem-message.ts`. For faults the user
 * cannot fix (5xx, unknown codes) the short request reference is appended so
 * support can trace it in the backend logs.
 */
export const errorNormalizationInterceptor: HttpInterceptorFn = (req, next) => {
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      // A proxy/CDN error page arrives as an HTML/text string, not problem+json.
      const body = err.error !== null && typeof err.error === 'object' ? (err.error as Partial<ProblemDetails>) : null;
      const friendly = buildFriendlyProblem(
        { status: err.status, code: body?.code, detail: body?.detail, errors: body?.errors },
        i18n.locale(),
      );

      const requestId = body?.request_id || req.headers.get('X-Request-Id') || '';
      const reference = requestId && friendly.needsReference ? ` (${i18n.t('feedback.error.ref', { ref: requestId.slice(0, 8) })})` : '';
      const retryAfter = Number.parseInt(err.headers?.get('Retry-After') ?? '', 10);

      const problem: ProblemDetails = {
        type: body?.type ?? 'about:blank',
        title: body?.title ?? err.statusText,
        status: err.status,
        code: body?.code ?? (err.status === 0 ? 'ERR-NETWORK' : 'ERR-5000'),
        detail: `${friendly.message}${reference}`,
        detail_raw: body?.detail,
        instance: req.urlWithParams,
        request_id: requestId,
        errors: body?.errors,
        field_errors: friendly.fieldErrors,
        kind: friendly.kind,
        retry_after: Number.isFinite(retryAfter) ? retryAfter : undefined,
      };

      if (isDevMode()) {
        console.error(`[API ${req.method} ${req.url}] ${err.status} ${problem.code}`, {
          request_id: requestId, detail_raw: body?.detail, errors: body?.errors,
        });
      }
      return throwError(() => problem);
    }),
  );
};
