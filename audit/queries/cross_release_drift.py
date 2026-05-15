"""Cross-release drift: same logical fact reported with different values across releases.

For every (period, bank, sheet_family, row_label, col_idx) tuple that appears
in 3+ releases, count distinct rounded values and report the worst drift.

SAFETY RAIL: filters period_resolution_method = 'sheet_name'. This excludes
sheets where the same coordinate across releases may represent DIFFERENT
periods (BPHRÉSULT-class roll-over sheets, panel sheets, etc.) — those
require per-family period resolvers we don't have yet.

Worst-case findings expected:
  - The Dec 2023 'overwrite-with-latest-Dec' bug (UNIBK total_assets etc.)
  - Any other systematic restatements of historical values
"""

from db import q


def run():
    df = q("""
        WITH facts AS (
            SELECT period_year, period_month, bank, sheet_family, row_label, col_idx,
                   release_file, value_num
            FROM cells_enriched
            WHERE bank IS NOT NULL
              AND value_num IS NOT NULL
              AND row_label IS NOT NULL
              AND period_year IS NOT NULL
              AND period_resolution_method = 'sheet_name'  -- safety rail
              AND ABS(value_num) > 0.0001  -- ignore zeros/near-zeros (noisy)
        ),
        agg AS (
            SELECT period_year, period_month, bank, sheet_family, row_label, col_idx,
                   COUNT(DISTINCT release_file) AS n_releases,
                   COUNT(DISTINCT ROUND(value_num, 4)) AS n_distinct_values,
                   MIN(value_num) AS min_v,
                   MAX(value_num) AS max_v,
                   AVG(value_num) AS avg_v
            FROM facts
            GROUP BY 1,2,3,4,5,6
        )
        SELECT *,
               (max_v - min_v) AS abs_range,
               CASE WHEN avg_v != 0
                    THEN (max_v - min_v) / ABS(avg_v) ELSE NULL END AS rel_range
        FROM agg
        WHERE n_releases >= 3
          AND n_distinct_values >= 2
        ORDER BY rel_range DESC NULLS LAST
        LIMIT 300
    """)
    summary = (
        f"{len(df)} (period, bank, indicator) tuples reporting different values "
        f"across 3+ releases. Sorted by relative range (max-min)/|avg| desc."
    )
    return df, summary
