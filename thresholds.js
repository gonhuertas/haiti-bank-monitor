// BRH (Banque de la République d'Haïti) supervisory thresholds.
// Sources noted per indicator. Where BRH minimums aren't published in a form
// the analyst can cite, we fall back to international FSI / Basel norms and
// LABEL them as such. Every flag in the UI cites its source.
//
// User can override via the Thresholds panel; values persist to localStorage.

window.BRH_THRESHOLDS = /*EDITMODE-BEGIN*/{
  "car_min": 0.12,
  "car_watch": 0.14,
  "capital_to_assets_min": 0.05,
  "capital_to_assets_watch": 0.06,
  "liquidity_to_deposits_min": 0.30,
  "liquidity_to_deposits_watch": 0.35,
  "liquidity_to_assets_watch": 0.20,
  "npl_watch": 0.05,
  "npl_breach": 0.10,
  "provision_coverage_min": 1.00,
  "provision_coverage_watch": 1.20,
  "net_npl_to_equity_watch": 0.25,
  "net_npl_to_equity_breach": 0.50,
  "fx_open_position_limit": 0.005
}/*EDITMODE-END*/;

// Provenance for each threshold so we can show source next to flags.
window.THRESHOLD_PROVENANCE = {
  car_min:                  { label: "BRH Circulaire 88 — Capital Adequacy", source: "BRH" },
  car_watch:                { label: "Supervisory buffer (CAR floor +200bp)", source: "Convention" },
  capital_to_assets_min:    { label: "Leverage floor — Basel III ≥3% / BRH custom", source: "Basel III" },
  capital_to_assets_watch:  { label: "Analyst watch — leverage <6%", source: "Convention" },
  liquidity_to_deposits_min:{ label: "BRH liquidity coverage minimum", source: "BRH" },
  liquidity_to_deposits_watch:{label:"Analyst watch — 5pp above BRH floor", source: "Convention" },
  liquidity_to_assets_watch:{ label: "IMF FSI watch — liquid/total <20%", source: "IMF FSI" },
  npl_watch:                { label: "IMF FSI watch — NPL ratio >5%", source: "IMF FSI" },
  npl_breach:               { label: "IMF FSI elevated — NPL ratio >10%", source: "IMF FSI" },
  provision_coverage_min:   { label: "BRH — provisions ≥ NPLs (100% coverage)", source: "BRH" },
  provision_coverage_watch: { label: "Analyst watch — coverage <120%", source: "Convention" },
  net_npl_to_equity_watch:  { label: "IMF FSI — Net NPL/Capital >25%", source: "IMF FSI" },
  net_npl_to_equity_breach: { label: "IMF FSI elevated — Net NPL/Capital >50%", source: "IMF FSI" },
  fx_open_position_limit:   { label: "BRH Circulaire 81-6 — net structural FX open position ≤ 0.50% of equity", source: "BRH" }
};

// Evaluate a single value against an indicator's threshold structure.
// Returns {status: 'ok'|'watch'|'breach', threshold, label, source, direction}
// direction: 'floor' (value must be ≥) or 'ceiling' (value must be ≤)
window.evaluate = function(indicator, value, T) {
  T = T || window.BRH_THRESHOLDS;
  if (value === undefined || value === null || isNaN(value)) {
    return { status: 'na' };
  }
  const P = window.THRESHOLD_PROVENANCE;
  switch (indicator) {
    case 'car': {
      if (value < T.car_min) return { status:'breach', threshold:T.car_min, ...P.car_min, direction:'floor' };
      if (value < T.car_watch) return { status:'watch', threshold:T.car_min, ...P.car_min, direction:'floor' };
      return { status:'ok', threshold:T.car_min, ...P.car_min, direction:'floor' };
    }
    case 'capital_to_assets': {
      if (value < T.capital_to_assets_min) return { status:'breach', threshold:T.capital_to_assets_min, ...P.capital_to_assets_min, direction:'floor' };
      if (value < T.capital_to_assets_watch) return { status:'watch', threshold:T.capital_to_assets_min, ...P.capital_to_assets_min, direction:'floor' };
      return { status:'ok', threshold:T.capital_to_assets_min, ...P.capital_to_assets_min, direction:'floor' };
    }
    case 'liquidity_to_deposits': {
      if (value < T.liquidity_to_deposits_min) return { status:'breach', threshold:T.liquidity_to_deposits_min, ...P.liquidity_to_deposits_min, direction:'floor' };
      if (value < T.liquidity_to_deposits_watch) return { status:'watch', threshold:T.liquidity_to_deposits_min, ...P.liquidity_to_deposits_min, direction:'floor' };
      return { status:'ok', threshold:T.liquidity_to_deposits_min, ...P.liquidity_to_deposits_min, direction:'floor' };
    }
    case 'liquidity_to_assets': {
      if (value < T.liquidity_to_assets_watch) return { status:'watch', threshold:T.liquidity_to_assets_watch, ...P.liquidity_to_assets_watch, direction:'floor' };
      return { status:'ok', threshold:T.liquidity_to_assets_watch, ...P.liquidity_to_assets_watch, direction:'floor' };
    }
    case 'npl_ratio': {
      if (value > T.npl_breach) return { status:'breach', threshold:T.npl_breach, ...P.npl_breach, direction:'ceiling' };
      if (value > T.npl_watch) return { status:'watch', threshold:T.npl_watch, ...P.npl_watch, direction:'ceiling' };
      return { status:'ok', threshold:T.npl_watch, ...P.npl_watch, direction:'ceiling' };
    }
    case 'provision_coverage': {
      if (value < T.provision_coverage_min) return { status:'breach', threshold:T.provision_coverage_min, ...P.provision_coverage_min, direction:'floor' };
      if (value < T.provision_coverage_watch) return { status:'watch', threshold:T.provision_coverage_min, ...P.provision_coverage_min, direction:'floor' };
      return { status:'ok', threshold:T.provision_coverage_min, ...P.provision_coverage_min, direction:'floor' };
    }
    case 'net_npl_to_equity': {
      if (value > T.net_npl_to_equity_breach) return { status:'breach', threshold:T.net_npl_to_equity_breach, ...P.net_npl_to_equity_breach, direction:'ceiling' };
      if (value > T.net_npl_to_equity_watch) return { status:'watch', threshold:T.net_npl_to_equity_watch, ...P.net_npl_to_equity_watch, direction:'ceiling' };
      return { status:'ok', threshold:T.net_npl_to_equity_watch, ...P.net_npl_to_equity_watch, direction:'ceiling' };
    }
    default:
      return { status: 'na' };
  }
};
