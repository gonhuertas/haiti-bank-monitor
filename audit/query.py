"""Ad-hoc inspection of the audit cell store.

Run with no arguments to see a default overview:
    python audit/inspect.py

Or pass a SQL query directly (single argument; quote per your shell):
    python audit/inspect.py "SELECT release_file, COUNT(*) FROM cells GROUP BY 1"

Or use the helper flags to sidestep shell-quoting hassles:
    python audit/inspect.py --sheet "bilsysbandéc. 23"
    python audit/inspect.py --sheet "bilsysbandéc. 23" --release brh_trim1_2026.xlsx
    python audit/inspect.py --sheets-like bilsysban
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from db import con, q  # noqa: E402

import pandas as pd
pd.set_option("display.max_rows", 200)
pd.set_option("display.max_colwidth", 80)
pd.set_option("display.width", 220)


def default_overview() -> None:
    print("=== Cells per release ===")
    print(q("""
        SELECT release_year, release_quarter, release_file,
               COUNT(*) AS cells, COUNT(DISTINCT sheet_name) AS sheets
        FROM cells GROUP BY 1,2,3 ORDER BY 1,2
    """).to_string(index=False))

    print("\n=== Top 10 sheets by total cells across releases ===")
    print(q("""
        SELECT sheet_name, COUNT(*) AS cells,
               COUNT(DISTINCT release_file) AS in_releases
        FROM cells GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    """).to_string(index=False))


def dump_sheet(sheet: str, release: str | None) -> None:
    """Print every cell of a given sheet, optionally limited to one release.
    Uses parameterised SQL to avoid quoting issues with French/special chars."""
    if release:
        df = con.execute(
            """SELECT release_file, row_idx, col_idx, value_num, value_text
               FROM cells WHERE sheet_name = ? AND release_file = ?
               ORDER BY release_file, row_idx, col_idx""",
            [sheet, release],
        ).fetchdf()
    else:
        df = con.execute(
            """SELECT release_file, row_idx, col_idx, value_num, value_text
               FROM cells WHERE sheet_name = ?
               ORDER BY release_file, row_idx, col_idx""",
            [sheet],
        ).fetchdf()
    if df.empty:
        print(f"(no rows for sheet {sheet!r}"
              + (f" in release {release!r}" if release else "")
              + ")")
    else:
        print(f"({len(df):,} cells)\n")
        print(df.to_string(index=False))


def list_sheets(fragment: str) -> None:
    """List every sheet whose name contains `fragment` (case-insensitive)."""
    df = con.execute(
        """SELECT sheet_name, COUNT(DISTINCT release_file) AS in_releases,
                  COUNT(*) AS total_cells
           FROM cells
           WHERE LOWER(sheet_name) LIKE LOWER(?)
           GROUP BY 1
           ORDER BY in_releases DESC, sheet_name""",
        [f"%{fragment}%"],
    ).fetchdf()
    print(df.to_string(index=False))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("sql", nargs="?", help="Raw SQL to run.")
    p.add_argument("--sheet", help="Dump rows for this sheet.")
    p.add_argument("--release", help="Limit --sheet to this release file.")
    p.add_argument("--sheets-like", help="List sheet names containing this substring.")
    args = p.parse_args()

    if args.sheet:
        dump_sheet(args.sheet, args.release)
    elif args.sheets_like:
        list_sheets(args.sheets_like)
    elif args.sql:
        print(q(args.sql).to_string(index=False))
    else:
        default_overview()


if __name__ == "__main__":
    main()
