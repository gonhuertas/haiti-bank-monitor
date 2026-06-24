"""Rebuild haiti-bank-monitor/data.json from the brh-dashboard processed CSVs.

Reads:
  ../FM Test/brh-dashboard/data/processed/brh_balance.csv
  ../FM Test/brh-dashboard/data/processed/brh_capital.csv
  ../FM Test/brh-dashboard/data/processed/brh_ratios.csv

Writes:
  data.json

Each top-level key is one indicator with shape:
  { "banks": [...], "series": [ {"date": "YYYY-MM-DD", "BANK_A": value, ...}, ... ] }

Mappings (verified against the prior data.json for 2025-12-31):
  capital_to_assets        = cap.regulatory_capital  / cap.assets_net_deductions
  car                      = cap.car                                              (ratio)
  regulatory_capital       = cap.regulatory_capital / 1e6                         (HTG bn)
  rwa                      = cap.rwa                / 1e6                         (HTG bn)
  total_assets             = bal.total_assets / 1e6                               (HTG bn)
  net_loans                = bal.net_loans / 1e6                                  (HTG bn)
  gross_loans              = bal.gross_loans / 1e6                                (HTG bn)
  total_deposits           = bal.total_deposits / 1e6                             (HTG bn)
  shareholder_equity       = bal.shareholder_equity / 1e6                         (HTG bn)
  liquidity_to_assets      = bal.liquidity_to_assets                              (ratio)
  liquidity_to_deposits    = bal.liquidity_to_deposits                            (ratio)
  npl_ratio                = ratios.npl_ratio_gross                               (ratio)
  provision_coverage       = ratios.provision_coverage / 100                      (ratio)
  net_npl_to_equity        = ratios.net_npl_to_equity                             (ratio)
  roa                      = ratios.roa_cumul                                     (ratio)
  roe                      = ratios.roe_cumul                                     (ratio)
  share_of_system_assets         = total_assets[bank] / total_assets[SYSTÈME]
  share_of_loans_plus_deposits   = (net_loans[bank] + total_deposits[bank])
                                 / (net_loans[SYSTÈME] + total_deposits[SYSTÈME])
  share_of_deposits              = total_deposits[bank] / total_deposits[SYSTÈME]
  system_npl_weighted      = cap-of-system NPL: from CSV bank='SYSTÈME', npl_ratio_gross
  system_car_weighted      = cap.car for bank='SYSTÈME'
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT       = Path(__file__).parent
CSV_DIR    = ROOT.parent / "FM Test" / "brh-dashboard" / "data" / "processed"
OUT_PATH   = ROOT / "data.json"

# Convert HTG (CSV unit) → HTG billions for dashboard display
ABS_TO_BN  = 1.0 / 1_000_000.0


def _load() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    bal    = pd.read_csv(CSV_DIR / "brh_balance.csv")
    cap    = pd.read_csv(CSV_DIR / "brh_capital.csv")
    ratios = pd.read_csv(CSV_DIR / "brh_ratios.csv")
    return bal, cap, ratios


def _pivot(df: pd.DataFrame, metric: str, scale: float = 1.0) -> pd.DataFrame:
    """Long → wide on (date, bank). Returns DataFrame indexed by date, columns = banks."""
    sub = df[df["metric"] == metric][["date", "bank", "value"]].copy()
    sub["value"] = sub["value"] * scale
    wide = sub.pivot_table(index="date", columns="bank", values="value", aggfunc="first")
    wide.index = pd.to_datetime(wide.index).strftime("%Y-%m-%d")
    return wide.sort_index(ascending=False)


def _to_indicator(wide: pd.DataFrame) -> dict:
    """Convert a wide DataFrame to the {banks, series} shape used by data.json.
    Drops NaN and +/-Inf cells (Inf comes from divide-by-zero in computed shares /
    capital_to_assets when the denominator is missing or zero for a given period)."""
    banks = list(wide.columns)
    series = []
    for date, row in wide.iterrows():
        rec = {"date": date}
        for bank in banks:
            v = row[bank]
            if v is None:
                continue
            if isinstance(v, float) and not math.isfinite(v):
                continue
            rec[bank] = float(v)
        series.append(rec)
    return {"banks": banks, "series": series}


def build_capital_to_assets(cap: pd.DataFrame) -> dict:
    rc = _pivot(cap, "regulatory_capital")
    ad = _pivot(cap, "assets_net_deductions")
    common_cols = [c for c in rc.columns if c in ad.columns]
    rc = rc[common_cols]; ad = ad[common_cols]
    wide = rc / ad
    # Drop banks that are entirely NaN across all dates
    wide = wide.dropna(axis=1, how="all")
    return _to_indicator(wide)


def build_share(numer_wide: pd.DataFrame, denom_wide: pd.DataFrame,
                system_bank: str = "SYSTÈME") -> dict:
    """Compute share = numer[bank] / denom[system_bank] per date.
    Excludes SYSTÈME from the bank list (it's not a meaningful share)."""
    if system_bank not in denom_wide.columns:
        return {"banks": [], "series": []}
    sys_series = denom_wide[system_bank]
    bank_cols = [c for c in numer_wide.columns if c != system_bank]
    wide = numer_wide[bank_cols].div(sys_series, axis=0)
    wide = wide.dropna(axis=1, how="all")
    return _to_indicator(wide)


def build_share_loans_plus_deposits(net_loans: pd.DataFrame,
                                    deposits: pd.DataFrame,
                                    system_bank: str = "SYSTÈME") -> dict:
    sums = net_loans.add(deposits, fill_value=0)
    if system_bank not in sums.columns:
        return {"banks": [], "series": []}
    sys_total = sums[system_bank]
    bank_cols = [c for c in sums.columns if c != system_bank]
    wide = sums[bank_cols].div(sys_total, axis=0)
    wide = wide.dropna(axis=1, how="all")
    return _to_indicator(wide)


def build_system_weighted(wide: pd.DataFrame, label: str,
                          system_bank: str = "SYSTÈME") -> dict:
    """Pull the SYSTÈME column from a wide pivot and re-label as the indicator."""
    if system_bank not in wide.columns:
        return {"banks": [label], "series": []}
    series = []
    for date in wide.index:
        v = wide.loc[date, system_bank]
        if v is None:
            continue
        if isinstance(v, float) and not math.isfinite(v):
            continue
        series.append({"date": date, label: float(v)})
    return {"banks": [label], "series": series}


def main() -> None:
    bal, cap, ratios = _load()

    # Wide pivots used by multiple indicators
    total_assets_bn    = _pivot(bal, "total_assets",    scale=ABS_TO_BN)
    net_loans_bn       = _pivot(bal, "net_loans",       scale=ABS_TO_BN)
    gross_loans_bn     = _pivot(bal, "gross_loans",     scale=ABS_TO_BN)
    total_deposits_bn  = _pivot(bal, "total_deposits",  scale=ABS_TO_BN)
    shareholder_eq_bn  = _pivot(bal, "shareholder_equity", scale=ABS_TO_BN)
    liq_to_assets      = _pivot(bal, "liquidity_to_assets")
    liq_to_deposits    = _pivot(bal, "liquidity_to_deposits")

    reg_cap            = _pivot(cap, "regulatory_capital", scale=ABS_TO_BN)
    rwa                = _pivot(cap, "rwa",                scale=ABS_TO_BN)
    car                = _pivot(cap, "car")

    npl_ratio          = _pivot(ratios, "npl_ratio_gross")
    prov_cov           = _pivot(ratios, "provision_coverage", scale=0.01)
    net_npl_to_eq      = _pivot(ratios, "net_npl_to_equity")
    roa_c              = _pivot(ratios, "roa_cumul")
    roe_c              = _pivot(ratios, "roe_cumul")

    out = {
        "capital_to_assets":             build_capital_to_assets(cap),
        "car":                           _to_indicator(car),
        "liquidity_to_assets":           _to_indicator(liq_to_assets),
        "liquidity_to_deposits":         _to_indicator(liq_to_deposits),
        "total_assets":                  _to_indicator(total_assets_bn),
        "net_loans":                     _to_indicator(net_loans_bn),
        "gross_loans":                   _to_indicator(gross_loans_bn),
        "total_deposits":                _to_indicator(total_deposits_bn),
        "shareholder_equity":            _to_indicator(shareholder_eq_bn),
        "regulatory_capital":            _to_indicator(reg_cap),
        "rwa":                           _to_indicator(rwa),
        "share_of_system_assets":        build_share(total_assets_bn, total_assets_bn),
        "share_of_loans_plus_deposits":  build_share_loans_plus_deposits(net_loans_bn, total_deposits_bn),
        "share_of_deposits":             build_share(total_deposits_bn, total_deposits_bn),
        "npl_ratio":                     _to_indicator(npl_ratio),
        "provision_coverage":            _to_indicator(prov_cov),
        "net_npl_to_equity":             _to_indicator(net_npl_to_eq),
        "roa":                           _to_indicator(roa_c),
        "roe":                           _to_indicator(roe_c),
        "system_npl_weighted":           build_system_weighted(npl_ratio, "SYSTÈME (weighted)"),
        "system_car_weighted":           build_system_weighted(car, "SYSTÈME (weighted)"),
    }

    # allow_nan=False makes us hard-fail if any NaN/Inf slipped past the filters;
    # the dashboard's fetch parses with the strict spec and would die otherwise.
    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )

    # Summary
    print(f"Wrote {OUT_PATH}")
    print(f"  Indicators: {len(out)}")
    latest = max(out["total_assets"]["series"][0]["date"] for _ in [None])
    print(f"  Latest period: {latest}")
    for name, ind in out.items():
        n_dates = len(ind["series"])
        n_banks = len(ind["banks"])
        latest_d = ind["series"][0]["date"] if ind["series"] else "(empty)"
        print(f"    {name:32s}  {n_dates:>3} dates  {n_banks:>2} banks  latest={latest_d}")


if __name__ == "__main__":
    main()
