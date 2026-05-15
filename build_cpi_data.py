"""Build cpi_data.json for the Haiti Banking Monitor dashboard.

Fetches monthly Haiti CPI from the IMF (SDMX dataset 'CPI', key
'HTI.CPI._T.IX.M'), computes YoY inflation, and writes a JSON file the
dashboard can fetch alongside data.json and fx_data.json.

Why this exists:
    The original dashboard prototype (utils.jsx) had a hand-coded
    SAMPLE_CPI_YOY map of ~30 quarterly inflation guesses going back to
    2017. With Haitian inflation routinely running ~25-50% YoY, using
    fake numbers materially distorts every "real" indicator the
    dashboard derives. This script replaces the placeholder with the
    real series so ROA, ROE, loan-growth, etc. can be deflated honestly.

Source:
    IMF SDMX dataset CPI, key HTI.CPI._T.IX.M
        HTI = Haiti
        CPI = Consumer Price Index
        _T  = total (all items)
        IX  = index (typical base 2010=100 or similar)
        M   = monthly frequency

Output JSON shape:
    {
      "_meta": {...},
      "monthly": [
        {"date": "YYYY-MM-DD", "cpi_index": float, "inflation_yoy": float | null},
        ...
      ],
      "quarterly": [
        {"date": "YYYY-MM-DD", "cpi_index": float, "inflation_yoy": float | null},
        ...
      ]
    }

    inflation_yoy is the standard year-on-year change in the CPI index,
    expressed as a decimal (e.g. 0.30 = 30%). null for the first 12
    months where no YoY can be computed.

    The "monthly" array is the source of truth (every month-end IMF
    publishes). The "quarterly" array is just monthly filtered to
    March/June/September/December month-ends, for convenience when the
    dashboard joins to its quarterly bank panels.

Cache:
    .cpi_cache.json (gitignored) saves the raw IMF response so reruns
    within 30 days don't re-hit the (slow) SDMX server. Delete it to
    force a fresh fetch.

Refresh workflow:
    python build_cpi_data.py     # fetches IMF, writes cpi_data.json
    git add cpi_data.json && git commit -m "Refresh CPI" && git push
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
OUTPUT_JSON = SCRIPT_DIR / "cpi_data.json"
CACHE_FILE = SCRIPT_DIR / ".cpi_cache.json"
CACHE_MAX_AGE_DAYS = 30

# IMF SDMX parameters
IMF_DATASET = "CPI"
IMF_KEY = "HTI.CPI._T.IX.M"
IMF_START = "2010-01"   # plenty of history; YoY will start 12 months in


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _cache_is_fresh() -> bool:
    if not CACHE_FILE.exists():
        return False
    age = datetime.now() - datetime.fromtimestamp(CACHE_FILE.stat().st_mtime)
    return age < timedelta(days=CACHE_MAX_AGE_DAYS)


def _load_cache() -> list[dict] | None:
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_cache(records: list[dict]) -> None:
    CACHE_FILE.write_text(json.dumps(records, indent=2), encoding="utf-8")


# ── IMF fetch ─────────────────────────────────────────────────────────────────

def fetch_haiti_cpi_from_imf() -> list[dict]:
    """Hit IMF SDMX for monthly Haiti CPI. Returns sorted list of
    {date: 'YYYY-MM-DD', cpi_index: float} dicts."""
    try:
        import sdmx
    except ImportError:
        sys.exit(
            "sdmx package not installed. Install with:\n"
            "    pip install sdmx1\n"
            "(the package is named 'sdmx1' on PyPI but imports as 'sdmx'.)"
        )

    print(f"  Querying IMF SDMX (dataset={IMF_DATASET}, key={IMF_KEY}) ...")
    client = sdmx.Client("IMF_DATA")
    end = datetime.now().strftime("%Y-%m")
    msg = client.data(IMF_DATASET, key=IMF_KEY,
                      params={"startPeriod": IMF_START, "endPeriod": end})

    # sdmx.to_pandas returns a Series indexed by (COUNTRY, TIME_PERIOD)
    # or similar; coerce to a flat list of (period, value) pairs.
    import pandas as pd
    s = sdmx.to_pandas(msg)
    if hasattr(s, "reset_index"):
        df = s.reset_index()
    else:
        df = pd.DataFrame({"value": s}).reset_index()

    # Find the time-period and value columns (column names vary by IMF version)
    time_col = next((c for c in df.columns if "TIME" in str(c).upper()), None)
    val_col  = next((c for c in df.columns if str(c).lower() == "value"), None)
    if time_col is None or val_col is None:
        sys.exit(f"Unexpected IMF response shape. Columns: {list(df.columns)}")

    # IMF uses '2024-M03' format; convert to month-end ISO date
    def _to_month_end(p: str) -> str:
        # Handle both '2024-M03' and '2024-03' just in case
        if "M" in str(p):
            ts = pd.to_datetime(str(p), format="%Y-M%m")
        else:
            ts = pd.to_datetime(str(p))
        return (ts + pd.offsets.MonthEnd(0)).strftime("%Y-%m-%d")

    records = [
        {"date": _to_month_end(row[time_col]), "cpi_index": float(row[val_col])}
        for _, row in df.iterrows()
        if pd.notna(row[val_col])
    ]
    records.sort(key=lambda r: r["date"])
    return records


# ── Transformations ───────────────────────────────────────────────────────────

def with_yoy(records: list[dict]) -> list[dict]:
    """Add inflation_yoy = (cpi[t] / cpi[t-12]) - 1 for each row.
    First 12 months (no t-12 partner) get null.

    We look up the t-12 partner by (year-1, same month) string prefix,
    which is robust to leap years (no datetime arithmetic on Feb 29).
    """
    out = []
    for r in records:
        d = datetime.strptime(r["date"], "%Y-%m-%d")
        prev_lookup = f"{d.year - 1}-{d.month:02d}"
        match = next(
            (rr for rr in records if rr["date"].startswith(prev_lookup)),
            None,
        )
        yoy = (r["cpi_index"] / match["cpi_index"] - 1) if match else None
        out.append({
            "date": r["date"],
            "cpi_index": r["cpi_index"],
            "inflation_yoy": yoy,
        })
    return out


def filter_quarterly(records: list[dict]) -> list[dict]:
    """Keep only March/June/September/December month-end observations."""
    return [
        r for r in records
        if r["date"].endswith(("-03-31", "-06-30", "-09-30", "-12-31"))
    ]


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if _cache_is_fresh():
        print(f"Using cache {CACHE_FILE.name} (less than {CACHE_MAX_AGE_DAYS} days old)")
        records = _load_cache()
        if records is None:
            print("  cache unreadable, re-fetching")
            records = fetch_haiti_cpi_from_imf()
            _save_cache(records)
    else:
        print(f"Cache missing or stale; fetching from IMF SDMX ...")
        records = fetch_haiti_cpi_from_imf()
        _save_cache(records)
        print(f"  saved cache to {CACHE_FILE.name}")

    if not records:
        sys.exit("No CPI records fetched.")

    print(f"  {len(records)} monthly observations, "
          f"{records[0]['date']} -> {records[-1]['date']}")

    monthly = with_yoy(records)
    quarterly = filter_quarterly(monthly)

    # Sanity: print latest YoY readings
    latest = [r for r in monthly if r["inflation_yoy"] is not None][-6:]
    print("\n  Latest YoY readings:")
    for r in latest:
        print(f"    {r['date']}  CPI={r['cpi_index']:7.2f}  YoY={r['inflation_yoy']*100:+.2f}%")

    payload = {
        "_meta": {
            "source": (
                f"IMF SDMX dataset '{IMF_DATASET}', key '{IMF_KEY}' "
                "(Haiti, all-items CPI, monthly)."
            ),
            "fetched_at": datetime.now().isoformat(timespec="seconds"),
            "transformation": (
                "inflation_yoy = (cpi_index[t] / cpi_index[t-12]) - 1, "
                "expressed as a decimal (0.30 = 30%). null for the first 12 "
                "months where no t-12 partner exists."
            ),
            "monthly_count": len(monthly),
            "quarterly_count": len(quarterly),
            "cache_ttl_days": CACHE_MAX_AGE_DAYS,
        },
        "monthly":   monthly,
        "quarterly": quarterly,
    }

    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTPUT_JSON.name} ({OUTPUT_JSON.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
