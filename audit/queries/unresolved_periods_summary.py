"""Diagnostic: what's NOT being audited.

After the BPHRÉSULT false-positive incident, several cross-release queries
gained a `period_resolution_method = 'sheet_name'` filter. That filter
SAFELY excludes sheets where period is encoded in column headers rather
than the sheet name (BPHRÉSULT-class roll-over sheets).

This query is the explicit accounting of what that filter excludes — so we
know what's being skipped and can prioritize per-family resolvers.

Output: per sheet_family, how many cells have safe vs unsafe period
resolution, and how many distinct sheet names fall in each bucket.
"""

from db import q


def run():
    df = q("""
        SELECT
            sheet_family,
            period_resolution_method,
            COUNT(*) AS n_cells,
            COUNT(DISTINCT sheet_name) AS n_sheets,
            COUNT(DISTINCT release_file) AS in_n_releases
        FROM cells_enriched
        GROUP BY 1, 2
        ORDER BY sheet_family, period_resolution_method
    """)

    # Pivot for at-a-glance summary
    summary_df = q("""
        SELECT
            sheet_family,
            SUM(CASE WHEN period_resolution_method = 'sheet_name'
                     THEN n_cells ELSE 0 END) AS safe_cells,
            SUM(CASE WHEN period_resolution_method = 'in_sheet_header'
                     THEN n_cells ELSE 0 END) AS unsafe_cells,
            SUM(n_cells) AS total_cells,
            ROUND(100.0 * SUM(CASE WHEN period_resolution_method = 'sheet_name'
                                   THEN n_cells ELSE 0 END) / NULLIF(SUM(n_cells), 0), 1)
                AS pct_safe
        FROM (
            SELECT sheet_family, period_resolution_method, COUNT(*) AS n_cells
            FROM cells_enriched
            GROUP BY 1, 2
        )
        GROUP BY sheet_family
        ORDER BY total_cells DESC
    """)

    summary = (
        f"Period-resolution coverage by sheet_family. {len(summary_df)} families. "
        f"Cells with period_resolution_method='sheet_name' are SAFE for "
        f"cross-release coordinate joins; 'in_sheet_header' cells are excluded "
        f"from those audits and need per-family resolvers."
    )
    return summary_df, summary
