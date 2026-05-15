"""DuckDB connection helper for the BRH audit.

Exposes a single in-memory DuckDB connection that views every parquet file
under audit/data/cells/ as a single table called `cells`. After enrichment
runs (Day 2), an enriched view is also exposed as `cells_enriched`.

Usage:
    from audit.db import con, q

    df = q("SELECT release_file, COUNT(*) FROM cells GROUP BY 1 ORDER BY 2 DESC")
    df = q("SELECT * FROM cells WHERE sheet_name = 'bilsysbandéc. 23' LIMIT 5")

DuckDB queries parquet files directly — no full load into RAM. Aggregations
on the full ~30M-row dataset typically run in under 2 seconds.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
CELLS_GLOB     = str((SCRIPT_DIR / "data" / "cells"    / "*.parquet").resolve())
FORMULAS_GLOB  = str((SCRIPT_DIR / "data" / "formulas" / "*.parquet").resolve())
ENRICHED_FILE  = SCRIPT_DIR / "data" / "cells_enriched.parquet"
FORMULAS_DIR   = SCRIPT_DIR / "data" / "formulas"


def _build_connection() -> duckdb.DuckDBPyConnection:
    """Create a fresh in-memory DuckDB connection with views over the parquet files.

    Lazy: the views are defined unconditionally where the underlying files
    exist; missing files just mean the view isn't created.
    """
    con = duckdb.connect(":memory:")
    # `cells` — raw values, one parquet per release.
    con.execute(f"CREATE VIEW cells AS SELECT * FROM read_parquet('{CELLS_GLOB}')")

    # `cells_enriched` — values + semantic columns (sheet_family / period / bank / …).
    if ENRICHED_FILE.exists():
        con.execute(
            f"CREATE VIEW cells_enriched AS "
            f"SELECT * FROM read_parquet('{ENRICHED_FILE.as_posix()}')"
        )

    # `formulas` — formula strings, .xlsx releases only.
    if FORMULAS_DIR.exists() and any(FORMULAS_DIR.glob("*.parquet")):
        con.execute(
            f"CREATE VIEW formulas AS SELECT * FROM read_parquet('{FORMULAS_GLOB}')"
        )
        # `cells_with_formulas` — LEFT JOIN of enriched cells to formulas. Cells
        # whose location has no formula attach get formula=null. Useful for any
        # query that wants both the cached value and the formula string.
        if ENRICHED_FILE.exists():
            con.execute("""
                CREATE VIEW cells_with_formulas AS
                SELECT c.*, f.formula
                FROM cells_enriched c
                LEFT JOIN formulas f
                       ON c.release_file = f.release_file
                      AND c.sheet_name   = f.sheet_name
                      AND c.row_idx      = f.row_idx
                      AND c.col_idx      = f.col_idx
            """)
    return con


# Module-level singleton. Created on first import.
con = _build_connection()


def q(sql: str) -> pd.DataFrame:
    """Run SQL, return a pandas DataFrame. Raises on syntax / missing-data errors."""
    return con.execute(sql).fetchdf()


def reset() -> None:
    """Tear down and rebuild the connection — call after re-running extract."""
    global con
    con.close()
    con = _build_connection()
