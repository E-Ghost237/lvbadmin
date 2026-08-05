import { PricingGrid, PricingSimulationInput, PricingSimulationResult } from '../models';

/**
 * Deterministic re-implementation of RG-010 → RG-016 (moteur de tarification).
 * §6.1: "le calcul fait autorité côté serveur" — this module exists purely so
 * the admin console can preview/audit a grid before activation and so demo
 * data is generated with realistic, reproducible prices. The real pricing
 * decision always comes from the backend once wired.
 */

function ceilToMultiple(value: number, step: number): number {
  if (step <= 0) return Math.ceil(value);
  return Math.ceil(value / step) * step;
}

function hourlyCoefficient(grid: PricingGrid, hhmm: string): number {
  const [h] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return 1;
  if (h >= 21 || h < 6) return grid.coef_horaire_nuit;
  if (h >= 18) return grid.coef_horaire_soir;
  return 1;
}

/** RG-015 — coefficient de demande, plafonné, désactivable globalement. */
export function demandCoefficient(grid: PricingGrid, ratio: number): number {
  if (!grid.demande_dynamique_active) return 1;
  let coef = 1;
  if (ratio >= 4) coef = 1.5;
  else if (ratio >= 2.5) coef = 1.3;
  else if (ratio >= 1.5) coef = 1.15;
  return Math.min(coef, grid.demande_plafond, 1.5);
}

export function computeQuote(grid: PricingGrid, input: PricingSimulationInput): PricingSimulationResult {
  const prixBase = grid.frais_prise_en_charge
    + input.distance_km * grid.tarif_par_km
    + input.duree_min * grid.tarif_par_minute;
  const prixAjuste = Math.max(prixBase, grid.prix_minimum);
  const minimumApplied = prixAjuste > prixBase;

  const coefUrgence = input.urgence === 'EXPRESS' ? grid.coef_urgence_express : 1;
  const coefHoraire = hourlyCoefficient(grid, input.heure);
  const coefDemande = demandCoefficient(grid, input.ratio_demande);

  const majUrgence = prixAjuste * (coefUrgence - 1);
  const majHoraire = prixAjuste * (coefHoraire - 1);
  const majDemande = prixAjuste * (coefDemande - 1);
  const supplementPoids = input.poids_kg > 5 ? Math.ceil(input.poids_kg - 5) * grid.supplement_poids_kg : 0;
  const supplementFragile = input.fragile ? grid.supplement_fragile : 0;

  const majorations = majUrgence + majHoraire + majDemande + supplementPoids + supplementFragile;
  const prixAvantRemise = prixAjuste + majorations;
  const prixFinal = ceilToMultiple(prixAvantRemise, grid.arrondi);

  return {
    prix_base: Math.round(prixBase),
    prix_ajuste: Math.round(prixAjuste),
    majorations: Math.round(majorations),
    supplements: Math.round(supplementPoids + supplementFragile),
    prix_avant_remise: Math.round(prixAvantRemise),
    prix_final: prixFinal,
    decomposition: [
      { libelle: 'Frais de prise en charge', montant: grid.frais_prise_en_charge },
      { libelle: `Distance (${input.distance_km.toFixed(1)} km × ${grid.tarif_par_km} XAF)`, montant: Math.round(input.distance_km * grid.tarif_par_km) },
      { libelle: `Durée (${Math.round(input.duree_min)} min × ${grid.tarif_par_minute} XAF)`, montant: Math.round(input.duree_min * grid.tarif_par_minute) },
      ...(minimumApplied ? [{ libelle: 'Ajustement au prix minimum de zone', montant: Math.round(prixAjuste - prixBase) }] : []),
      ...(coefUrgence > 1 ? [{ libelle: `Majoration urgence EXPRESS (+${Math.round((coefUrgence - 1) * 100)} %)`, montant: Math.round(majUrgence) }] : []),
      ...(coefHoraire > 1 ? [{ libelle: `Majoration horaire (+${Math.round((coefHoraire - 1) * 100)} %)`, montant: Math.round(majHoraire) }] : []),
      ...(coefDemande > 1 ? [{ libelle: `Forte demande (+${Math.round((coefDemande - 1) * 100)} %)`, montant: Math.round(majDemande) }] : []),
      ...(supplementPoids > 0 ? [{ libelle: 'Supplément poids (> 5 kg)', montant: supplementPoids }] : []),
      ...(supplementFragile > 0 ? [{ libelle: 'Supplément fragile', montant: supplementFragile }] : []),
      { libelle: `Arrondi supérieur (${grid.arrondi} XAF)`, montant: prixFinal - Math.round(prixAvantRemise) },
    ],
  };
}
