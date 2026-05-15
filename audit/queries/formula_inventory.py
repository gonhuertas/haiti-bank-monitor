"""Formula inventory: sanity counts of formulas per family / per release.

Not really a "finding" query — it establishes the baseline of how many cells
are formulas vs hardcoded across the BRH workbook. Useful context for
interpreting other formula-related audits.
"""

from db import q


def run():
    df = q("""
        WITH joined AS (
            SELECT
                c.release_file, c.release_year, c.release_quarter,
                c.sheet_family,
                c.value_num, c.value_text,
                f.formula
            FROM cells_enriched c
            LEFT JOIN formulas f
                   ON c.release_file = f.release_file
                  AND c.sheet_name   = f.sheet_name
                  AND c.row_idx      = f.row_idx
                  AND c.col_idx      = f.col_idx
            WHERE c.release_file LIKE '%.xlsx'
        )
        SELECT
            release_year, release_quarter, sheet_family,
            COUNT(*) AS total_cells,
            SUM(CASE WHEN formula IS NOT NULL THEN 1 ELSE 0 END) AS formula_cells,
            SUM(CASE WHEN formula IS NULL AND value_num IS NOT NULL THEN 1 ELSE 0 END) AS hardcoded_num_cells,
            ROUND(100.0 * SUM(CASE WHEN formula IS NOT NULL THEN 1 ELSE 0 END)
                  / NULLIF(COUNT(*), 0), 1) AS pct_formula
        FROM joined
        GROUP BY 1, 2, 3
        HAVING SUM(CASE WHEN formula IS NOT NULL THEN 1 ELSE 0 END) > 0
        ORDER BY release_year DESC, release_quarter DESC, total_cells DESC
        LIMIT 500
    """)
    summary = (
        f"{len(df)} (release, family) groups with formula coverage. Sets the "
        f"baseline for which families are calculated vs hardcoded."
    )
    return df, summary
