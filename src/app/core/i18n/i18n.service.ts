import { Injectable, computed, signal } from '@angular/core';
import { Locale } from '../models';
import { FR } from './translations.fr';
import { EN } from './translations.en';

const DICTS: Record<Locale, Record<string, string>> = { fr: FR, en: EN };
const STORAGE_KEY = 'lvb.locale';

/**
 * Runtime (not build-time) i18n so FR/EN can be toggled without a rebuild —
 * simpler to keep in sync with a fast-moving mock-to-real API wiring effort.
 * CT-06 / ENF-035: French is the default locale; no string is hard-coded
 * outside this service for chrome, statuses and validation messages.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _locale = signal<Locale>(this.readInitialLocale());
  readonly locale = this._locale.asReadonly();
  readonly isEnglish = computed(() => this._locale() === 'en');

  private readInitialLocale(): Locale {
    if (typeof localStorage === 'undefined') return 'fr';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' ? 'en' : 'fr';
  }

  setLocale(locale: Locale): void {
    this._locale.set(locale);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }

  toggle(): void {
    this.setLocale(this._locale() === 'fr' ? 'en' : 'fr');
  }

  /** Looks up `key` in the active dictionary; falls back to French, then the raw key. */
  t(key: string, vars?: Record<string, string | number>): string {
    const dict = DICTS[this._locale()];
    let value = dict[key] ?? FR[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  }
}
