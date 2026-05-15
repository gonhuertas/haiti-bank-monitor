"""Bulk cell extractor for the BRH audit pipeline (Day 1).

Iterates every brh_trim*.xls{,x} file in the BRH source folder, opens each via
_brh_io.BRHFile (which handles both xls and xlsx), and dumps every non-empty
cell of every sheet into a long-format parquet.

One parquet file per release. DuckDB then queries them as a single table via
read_parquet('audit/data/cells/*.parquet').

Schema per cell:
    release_file        e.g. 'brh_trim4_2023.xlsx'
    release_year        int  (e.g. 2023)
    release_quarter     int  (1-4)
    sheet_name          as-is, preserves trailing spaces / typos
    sheet_idx           position in workbook (0-indexed)
    row_idx, col_idx    1-indexed (matches _brh_io convention)
    value_num           float | null (if cell is numeric)
    value_text          str   | null (if cell is text/datetime/formula error)

Design choices:
    * One parquet per release (incremental writes, easy retry on failure)
    * Skip empty cells (BRHFile.cells already does this; saves ~70% of space)
    * value_num and value_text are mutually exclusive (one is always null)
    * Numeric bool values go to value_text ("True"/"False") to keep value_num
      truly numeric
    * datetime cells are ISO-stringified into value_text (cleaner than mixing
      types in value_num)
    * Formula error strings ("#DIV/0!", "#REF!", etc.) end up in value_text
      naturally — useful for the audit
"""

from __future__ import annotations

import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

# ── Path setup ────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
BRH_SOURCE = (SCRIPT_DIR / ".." / ".." / "FM Test" / "brh-dashboard"
              / "data" / "raw").resolve()
OUTPUT_DIR = SCRIPT_DIR / "data" / "cells"

# Reuse _brh_io.BRHFile from the brh-dashboard pipeline (handles xls + xlsx).
BRH_DASHBOARD_SCRIPTS = (SCRIPT_DIR / ".." / ".." / "FM Test" / "brh-dashboard"
                         / "scripts").resolve()
sys.path.insert(0, str(BRH_DASHBOARD_SCRIPTS))
from _brh_io import BRHFile  # noqa: E402


# ── Scope ─────────────────────────────────────────────────────────────────────

# Year range (inclusive) per user requirement.
YEAR_MIN = 2019
YEAR_MAX = 2026

# Match brh_trim<N>_<YYYY>.xls{,x}. Excludes the trim_*_2019 duplicates
# (verified byte-identical to brh_trim*_2019) and any non-quarterly files.
RELEASE_RE = re.compile(r"^brh_trim(\d)_(\d{4})\.xlsx?$")


def discover_releases() -> list[tuple[Path, int, int]]:
    """Return [(path, year, quarter), ...] for in-scope releases, chronological."""
    out = []
    for p in BRH_SOURCE.iterdir():
        m = RELEASE_RE.match(p.name)
        if not m:
            continue
        quarter, year = int(m.group(1)), int(m.group(2))
        if YEAR_MIN <= year <= YEAR_MAX:
            out.append((p, year, quarter))
    out.sort(key=lambda t: (t[1], t[2]))
    return out


# ── Cell value classification ─────────────────────────────────────────────────

def classify(value: object) -> tuple[float | None, str | None]:
    """Split a cell value into (value_num, value_text). Mutually exclusive.

    - Numbers (int, float, but NOT bool) -> value_num
    - bool, datetime, str, anything else -> value_text
    - None / empty string -> (None, None) — caller filters these out
    """
    if value is None:
        return None, None
    # bool is a subclass of int — handle before numeric check.
    if isinstance(value, bool):
        return None, "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        # Filter NaN to keep value_num clean.
        if isinstance(value, float) and value != value:  # NaN check
            return None, None
        return float(value), None
    # datetime -> ISO 8601 string
    if isinstance(value, datetime):
        return None, value.isoformat()
    # Everything else -> string
    s = str(value)
    if s.strip() == "":
        return None, None
    return None, s


# ── Per-release extraction ────────────────────────────────────────────────────

def extract_release(path: Path, year: int, quarter: int) -> pd.DataFrame:
    """Open one release, dump every non-empty cell to a long DataFrame."""
    rows: list[dict] = []
    with BRHFile(path) as bf:
        sheet_names = bf.sheet_names
        for sheet_idx, sheet_name in enumerate(sheet_names):
            try:
                cells = bf.cells(sheet_name)
            except Exception as e:
                print(f"    ! sheet {sheet_idx:3d} {sheet_name!r}: "
                      f"failed to read ({type(e).__name__}: {e})",
                      flush=True)
                continue
            for (r, c), val in cells.items():
                vn, vt = classify(val)
                if vn is None and vt is None:
                    continue
                rows.append({
                    "release_file":    path.name,
                    "release_year":    year,
                    "release_quarter": quarter,
                    "sheet_name":      sheet_name,
                    "sheet_idx":       sheet_idx,
                    "row_idx":         r,
                    "col_idx":         c,
                    "value_num":       vn,
                    "value_text":      vt,
                })
    return pd.DataFrame(rows)


def write_release_parquet(df: pd.DataFrame, release_file: str) -> Path:
    """Write a release's DataFrame to parquet with explicit dtypes."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Cast for compactness; null-safe via nullable dtypes where needed.
    df = df.astype({
        "release_year":    "int16",
        "release_quarter": "int8",
        "sheet_idx":       "int16",
        "row_idx":         "int32",
        "col_idx":         "int16",
        # value_num / value_text already correct types from classify()
    })
    out_path = OUTPUT_DIR / f"{Path(release_file).stem}.parquet"
    df.to_parquet(out_path, index=False, compression="zstd")
    return out_path


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if not BRH_SOURCE.exists():
        sys.exit(f"BRH source folder not found: {BRH_SOURCE}")

    releases = discover_releases()
    if not releases:
        sys.exit(f"No matching releases found in {BRH_SOURCE} for years "
                 f"{YEAR_MIN}-{YEAR_MAX}.")

    print(f"Audit extractor — Day 1 (values only, no formulas)")
    print(f"Source: {BRH_SOURCE}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Scope: {len(releases)} releases, "
          f"{releases[0][1]}-Q{releases[0][2]} → "
          f"{releases[-1][1]}-Q{releases[-1][2]}\n")

    total_rows = 0
    total_cells_skipped = 0
    t_start = time.monotonic()

    for i, (path, year, quarter) in enumerate(releases, 1):
        t0 = time.monotonic()
        try:
            df = extract_release(path, year, quarter)
        except Exception as e:
            print(f"  [{i:2d}/{len(releases)}] {path.name}: "
                  f"FAILED ({type(e).__name__}: {e})", flush=True)
            continue
        n_rows = len(df)
        n_sheets = df["sheet_name"].nunique() if n_rows else 0
        out_path = write_release_parquet(df, path.name)
        size_mb = out_path.stat().st_size / (1024 * 1024)
        elapsed = time.monotonic() - t0
        print(f"  [{i:2d}/{len(releases)}] {path.name:25s} "
              f"{n_rows:>9,} cells  {n_sheets:>3d} sheets  "
              f"{size_mb:5.1f} MB  ({elapsed:5.1f}s)",
              flush=True)
        total_rows += n_rows

    t_total = time.monotonic() - t_start
    print(f"\nDone. {total_rows:,} cells extracted across {len(releases)} releases "
          f"in {t_total:.1f}s.")
    print(f"Output: {OUTPUT_DIR}/*.parquet")


if __name__ == "__main__":
    main()
