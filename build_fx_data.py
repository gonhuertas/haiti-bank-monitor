"""Build fx_data.json for the Haiti Banking Monitor dashboard.

Reads the upstream BRH FX positions CSV produced by
`FM Test/brh-dashboard/scripts/parse_brh_fx.py`, aggregates the monthly
observations into quarterly snapshots, and writes a JSON file in the
shape the dashboard's FX Open Positions tab expects.

Source CSV layout (one row per bank-month):
    date, bank, fx_position, days_exceeded
    - fx_position: net open FX position as a fraction of regulatory capital
                   (e.g. 0.04 = 4%). Sign convention: positive = long FX.
    - days_exceeded: number of calendar days in that month the limit was
                     breached on a daily basis.

Quarterly aggregation rules:
    - Position: end-of-quarter snapshot (March / June / September / December).
                We take the value at the quarter-end month directly; if the
                quarter-end is missing we fall back to the latest month within
                the quarter that has data.
    - Breach days: sum of monthly counts across the three months in the quarter.

Output JSON shape (matches the dashboard's existing FX-tab consumer):

    {
      "limit": 0.20,
      "banks": ["UNIBK", "SOGEBK", ...],
      "dates": ["2024-03-31", "2024-06-30", ...],
      "data": {
        "UNIBK": {
          "positions":  [{"date": "2024-03-31", "value": 0.005}, ...],
          "breachDays": [{"date": "2024-03-31", "value": 0}, ...]
        },
        ...
      }
    }

The dashboard's `fx.jsx` reads `window.__FX_DATA` (loaded by `app.jsx` via
fetch). The bank ordering follows `BANK_ORDER` from `utils.jsx`, filtered to
banks that have at least one non-null position in the selected window.

To refresh after a new BRH report lands:
    1. cd "C:/Users/Gon/Documents/GitHub/FM Test/brh-dashboard"
       python scripts/refresh_all.py     # downloads + parses; writes data/processed/brh_fx_positions.csv
    2. cd "C:/Users/Gon/Documents/GitHub/haiti-bank-monitor"
       python build_fx_data.py            # converts CSV -> fx_data.json
       git add fx_data.json && git commit -m "Refresh FX positions data" && git push

Configuration: the constants at the top of this file control the source
path and how many trailing quarters to expose.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd

# ── Configuration ─────────────────────────────────────────────────────────────

# Source CSV produced by `parse_brh_fx.py` in the brh-dashboard pipeline.
# Default assumes the two repos are siblings under GitHub/.
SCRIPT_DIR = Path(__file__).parent
SOURCE_CSV = (
    SCRIPT_DIR.parent / "FM Test" / "brh-dashboard" / "data" / "processed"
    / "brh_fx_positions.csv"
).resolve()

OUTPUT_JSON = SCRIPT_DIR / "fx_data.json"

# How many trailing quarters of data to ship to the dashboard.
# The FX tab shows "Position trajectory · 8 quarters" and "Last 4 quarters"
# breach days, so 8 is the natural default.
N_QUARTERS = 8

# BRH Circulaire 81-6 (in force since 10 June 2019) limit on the cumulative
# net structural FX open position, as a fraction of accounting equity.
# The current regime supersedes Circulaires 81-2 / 81-3 / 81-4 / 81-5 — the
# posinette sheet header still cites "Circulaire 81-3" but the threshold
# applied is 81-6's 0.50%. Editable in the dashboard's Thresholds panel;
# this value is the default the JSON declares for the corridor band.
REGULATORY_LIMIT = 0.005

# Bank display order — must match `BANK_ORDER` in utils.jsx.
BANK_ORDER: list[str] = [
    "UNIBK", "SOGEBK", "BNC", "CAPITALBK", "BUH", "SOGEBL",
    "CBNA", "BPH", "BHD", "PROMOBK", "SCOTIA", "SOCABK",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def quarter_end(ts: pd.Timestamp) -> pd.Timestamp:
    """Snap any timestamp to the last day of its calendar quarter."""
    return (ts + pd.offsets.QuarterEnd(0)).normalize()


def aggregate_to_quarters(df: pd.DataFrame) -> pd.DataFrame:
    """Convert monthly rows -> one row per (bank, quarter-end).

    For position: take the value at the quarter-end month if present;
    otherwise fall back to the most recent non-null month in the quarter.
    For days_exceeded: sum across the three months in the quarter.
    """
    df = df.copy()
    df["quarter"] = df["date"].apply(quarter_end)

    # Position: find the row in each (bank, quarter) group that's closest to
    # the quarter-end and has a non-null position. Sort so the quarter-end
    # row (if non-null) wins; otherwise the latest non-null month in the
    # quarter wins.
    df_pos = df.dropna(subset=["fx_position"]).copy()
    df_pos["is_qend"] = (df_pos["date"] == df_pos["quarter"]).astype(int)
    df_pos = df_pos.sort_values(["bank", "quarter", "is_qend", "date"])
    pos_q = (
        df_pos
        .groupby(["bank", "quarter"], as_index=False)
        .last()[["bank", "quarter", "fx_position"]]
    )

    # Breach days: sum within each (bank, quarter).
    days_q = (
        df.groupby(["bank", "quarter"], as_index=False)["days_exceeded"]
        .sum()
    )

    # Outer-join so quarters with breach days but no position still appear.
    out = pos_q.merge(days_q, on=["bank", "quarter"], how="outer")
    out = out.sort_values(["bank", "quarter"]).reset_index(drop=True)
    return out


def select_banks(df_q: pd.DataFrame, dates: list[pd.Timestamp]) -> list[str]:
    """Banks to expose: any bank with at least one non-null position
    in the selected window, ordered per BANK_ORDER."""
    in_window = df_q[df_q["quarter"].isin(dates)]
    has_data = (
        in_window.dropna(subset=["fx_position"])
        .groupby("bank")["fx_position"].count()
    )
    active = set(has_data[has_data > 0].index)
    # Preserve canonical ordering; drop banks not in BANK_ORDER (e.g. legacy
    # tickers like 'BICH' that the dashboard doesn't model).
    return [b for b in BANK_ORDER if b in active]


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if not SOURCE_CSV.exists():
        raise SystemExit(
            f"Source CSV not found: {SOURCE_CSV}\n\n"
            "Run the upstream pipeline first:\n"
            '  cd "C:/Users/Gon/Documents/GitHub/FM Test/brh-dashboard"\n'
            "  python scripts/refresh_all.py"
        )

    print(f"Reading {SOURCE_CSV.name} ...")
    df = pd.read_csv(SOURCE_CSV, parse_dates=["date"])
    print(f"  {len(df):,} monthly observations, "
          f"{df['date'].min().date()} -> {df['date'].max().date()}")

    df_q = aggregate_to_quarters(df)

    # Pick the trailing N_QUARTERS based on the latest quarter that has any
    # data anywhere in the dataset.
    all_quarters = sorted(df_q["quarter"].unique())
    selected = all_quarters[-N_QUARTERS:]
    banks = select_banks(df_q, selected)

    print(f"  selected window: {selected[0].date()} -> {selected[-1].date()} "
          f"({len(selected)} quarters)")
    print(f"  active banks: {banks}")

    # Build the per-bank arrays. Each bank gets one entry per selected quarter,
    # in order. Missing position -> null; missing breach days -> 0.
    payload_data = {}
    for bank in banks:
        sub = df_q[df_q["bank"] == bank].set_index("quarter")
        positions = []
        breach_days = []
        for q in selected:
            iso = q.strftime("%Y-%m-%d")
            if q in sub.index:
                row = sub.loc[q]
                pos_val = row["fx_position"]
                days_val = row["days_exceeded"]
                positions.append({
                    "date": iso,
                    "value": None if pd.isna(pos_val) else float(pos_val),
                })
                breach_days.append({
                    "date": iso,
                    "value": int(days_val) if pd.notna(days_val) else 0,
                })
            else:
                positions.append({"date": iso, "value": None})
                breach_days.append({"date": iso, "value": 0})
        payload_data[bank] = {
            "positions": positions,
            "breachDays": breach_days,
        }

    payload = {
        "_meta": {
            "source": "BRH posinette monthly publications, aggregated to quarter-end",
            "limit_citation": (
                "BRH Circulaire 81-6 (in force 10 June 2019) — cumulative net "
                "structural FX open position must not exceed 0.50% of accounting "
                "equity. The position cambiste (intraday trading desk) must be zero "
                "at end of each business day. Source-sheet header still cites "
                "Circulaire 81-3, the original framework."
            ),
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "n_quarters": N_QUARTERS,
            "aggregation": (
                "Position = end-of-quarter month value (or latest non-null month "
                "in the quarter if quarter-end is missing). Breach days = sum of "
                "monthly counts across the three months in the quarter. End-of-month "
                "position can be inside the corridor while breach days > 0 if the "
                "bank overshot intra-month and closed back within the limit."
            ),
        },
        "limit": REGULATORY_LIMIT,
        "banks": banks,
        "dates": [q.strftime("%Y-%m-%d") for q in selected],
        "data": payload_data,
    }

    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTPUT_JSON.name} ({OUTPUT_JSON.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
