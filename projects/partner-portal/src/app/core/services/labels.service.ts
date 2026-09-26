import { Injectable, inject, signal } from '@angular/core';
import { FleetService } from './fleet.service';
import { OfferService } from './offer.service';
import { RatePlanService } from './rate-plan.service';
import { WalletService } from './wallet.service';

export type LabelKind = 'vehicle' | 'driver' | 'offer' | 'ratePlan' | 'payoutAccount';

const PROVIDER: Record<string, string> = { MTN_MOMO: 'MTN Mobile Money', ORANGE_MONEY: 'Orange Money', BANK: 'Compte bancaire' };

/**
 * Turns the identifiers the API hands back (uuids) into names people recognise — a vehicle's plate,
 * a driver's name, an offer's title, a payout account's operator and last digits. Lists are loaded once,
 * on demand; a role without access to a list simply gets no label (never a raw uuid).
 */
@Injectable({ providedIn: 'root' })
export class LabelsService {
  private readonly fleet = inject(FleetService);
  private readonly offers = inject(OfferService);
  private readonly ratePlans = inject(RatePlanService);
  private readonly wallet = inject(WalletService);

  private readonly maps = signal<Record<LabelKind, Record<string, string>>>({ vehicle: {}, driver: {}, offer: {}, ratePlan: {}, payoutAccount: {} });
  private readonly requested = new Set<LabelKind>();

  /** Human label for `uuid`, or `fallback` when unknown / not loaded yet. Reading it in a template is reactive. */
  label(kind: LabelKind, uuid: string | null | undefined, fallback = '—'): string {
    if (!uuid) return fallback;
    return this.maps()[kind][uuid] ?? fallback;
  }

  /** Loads the list behind a kind once (safe to call repeatedly). */
  ensure(...kinds: LabelKind[]): void {
    for (const k of kinds) {
      if (this.requested.has(k)) continue;
      this.requested.add(k);
      this.load(k);
    }
  }

  /** Forget a loaded list so the next `ensure` refetches (after creating/editing something). */
  refresh(kind: LabelKind): void {
    this.requested.delete(kind);
    this.ensure(kind);
  }

  private put(kind: LabelKind, entries: [string, string][]): void {
    this.maps.update((m) => ({ ...m, [kind]: { ...m[kind], ...Object.fromEntries(entries) } }));
  }

  private load(kind: LabelKind): void {
    const ignore = () => undefined; // no access to this list for the current role → no labels
    switch (kind) {
      case 'vehicle': this.paged((c) => this.fleet.listVehicles({ cursor: c, limit: 100 }), (v) => [v.uuid, `${v.registration}${v.brand ? ' — ' + v.brand + (v.model ? ' ' + v.model : '') : ''}`], 'vehicle'); break;
      case 'driver': this.paged((c) => this.fleet.listDrivers({ cursor: c, limit: 100 }), (d) => [d.uuid, `${d.first_name} ${d.last_name}`], 'driver'); break;
      case 'ratePlan': this.paged((c) => this.ratePlans.list({ cursor: c, limit: 100 }), (r) => [r.uuid, r.name], 'ratePlan'); break;
      case 'offer': {
        const step = (cursor?: string, pages = 0): void => {
          this.offers.list({ cursor, limit: 100 }).subscribe({
            next: (p) => { this.put('offer', p.items.map((o): [string, string] => [o.uuid, o.title])); if (p.next_cursor && pages < 4) step(p.next_cursor, pages + 1); },
            error: ignore,
          });
        };
        step();
        break;
      }
      case 'payoutAccount':
        this.wallet.listPayoutAccounts().subscribe({
          next: (p) => this.put('payoutAccount', p.items.map((a): [string, string] => [a.uuid, `${PROVIDER[a.provider] ?? a.provider} •••• ${a.account_last_four} — ${a.holder_name}`])),
          error: ignore,
        });
        break;
    }
  }

  private paged<T extends { uuid: string }>(
    call: (cursor?: number) => import('rxjs').Observable<{ items: T[]; next_cursor: number | null }>,
    entry: (item: T) => [string, string], kind: LabelKind,
  ): void {
    const step = (cursor?: number, pages = 0): void => {
      call(cursor).subscribe({
        next: (p) => { this.put(kind, p.items.map(entry)); if (p.next_cursor && pages < 4) step(p.next_cursor, pages + 1); },
        error: () => undefined,
      });
    };
    step();
  }
}
