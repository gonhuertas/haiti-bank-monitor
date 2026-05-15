"""Bank-column drift: a bank appears at different column positions across
sheets within the same release.

For each (release, sheet_family, bank), look at the col_idx values where
the bank appears. Within a single release-family, banks should be in
consistent positions across all sheets — drift indicates the SOGEBK ↔ BNC
column-swap pattern we caught earlier.
"""

from db import q


def run():
    df = q("""
        WITH bank_positions AS (
            SELECT DISTINCT release_file, sheet_family, sheet_name, bank, col_idx
            FROM cells_enriched
            WHERE bank IS NOT NULL
              AND sheet_family IN ('bilsysban', 'sysratfinclé')
        ),
        agg AS (
            SELECT release_file, sheet_family, bank,
                   COUNT(DISTINCT col_idx) AS n_distinct_cols,
                   COUNT(DISTINCT sheet_name) AS n_sheets,
                   STRING_AGG(DISTINCT col_idx::VARCHAR, ',') AS cols_observed,
                   MIN(col_idx) AS min_col, MAX(col_idx) AS max_col
            FROM bank_positions
            GROUP BY 1,2,3
        )
        SELECT *
        FROM agg
        WHERE n_distinct_cols >= 2
          AND n_sheets >= 2
        ORDER BY n_distinct_cols DESC, release_file, bank
        LIMIT 200
    """)
    summary = (
        f"{len(df)} (release, family, bank) groups where the bank appears at "
        f"multiple column positions across sheets within one release."
    )
    return df, summary
