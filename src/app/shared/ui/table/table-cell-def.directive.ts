import { Directive, TemplateRef, input } from '@angular/core';

/** `<ng-template appCell="numero" let-row>{{ row.numero }}</ng-template>` — rich cell content for a column key. */
@Directive({ selector: 'ng-template[appCell]' })
export class TableCellDefDirective {
  readonly appCell = input.required<string>();
  constructor(public readonly templateRef: TemplateRef<{ $implicit: unknown; row: unknown }>) {}
}
