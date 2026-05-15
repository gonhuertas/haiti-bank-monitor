"""Sheet shape changes: same sheet name has materially different cell count
between adjacent releases.

For each (sheet_name) appearing in 2+ releases, compute cells per release and
flag releases where the cell count jumped >25% from the previous release.
This catches structural changes mid-stream (rows added, sub-blocks dropped).
"""

from db import q


def run():
    df = q("""
        WITH per_sheet_release AS (
            SELECT sheet_name, release_year, release_quarter, release_file,
                   COUNT(*) AS n_cells
            FROM cells_enriched
            GROUP BY 1, 2, 3, 4
        ),
        ordered AS (
            SELECT *,
                   LAG(n_cells) OVER (
                       PARTITION BY sheet_name
                       ORDER BY release_year, release_quarter
                   ) AS prev_n_cells,
                   LAG(release_file) OVER (
                       PARTITION BY sheet_name
                       ORDER BY release_year, release_quarter
                   ) AS prev_release
            FROM per_sheet_release
        )
        SELECT sheet_name, prev_release, release_file,
               prev_n_cells, n_cells,
               (n_cells - prev_n_cells) AS delta,
               ROUND((n_cells - prev_n_cells) * 1.0 / NULLIF(prev_n_cells, 0), 3)
                   AS pct_change
        FROM ordered
        WHERE prev_n_cells IS NOT NULL
          AND prev_n_cells >= 30  -- ignore tiny sheets
          AND ABS(n_cells - prev_n_cells) * 1.0 / prev_n_cells >= 0.25
        ORDER BY ABS(pct_change) DESC
        LIMIT 200
    """)
    summary = (
        f"{len(df)} (sheet, release-pair) instances where a sheet's cell "
        f"count changed by ≥25% between consecutive releases."
    )
    return df, summary
