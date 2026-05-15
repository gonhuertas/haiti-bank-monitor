"""Within-release cross-sheet inconsistency: same fact reported in multiple sheets,
disagreeing values within the same workbook.

For each (release, period, bank, row_label) appearing in 2+ different sheets
in the same release, check whether the values agree.

SAFETY RAIL: filters period_resolution_method = 'sheet_name'. Without this,
two sheets with the same period in their NAME (e.g. bilsysbandéc.23 and
sysratfincléd déc. 23) would correctly group together, but a sheet like
BPHRÉSULT (period from in-sheet headers) would group its (row, col)
coordinates with whatever same-(row,col) found in another sheet — even
though those are unrelated. Skipping the in-sheet-header sheets is the
safer behaviour until per-family resolvers exist.
"""

from db import q


def run():
    df = q("""
        WITH facts AS (
            SELECT release_file, period_year, period_month, bank, row_label, sheet_name,
                   value_num
            FROM cells_enriched
            WHERE bank IS NOT NULL
              AND value_num IS NOT NULL
              AND row_label IS NOT NULL
              AND period_year IS NOT NULL
              AND period_resolution_method = 'sheet_name'  -- safety rail
              AND ABS(value_num) > 0.0001
        ),
        agg AS (
            SELECT release_file, period_year, period_month, bank, row_label,
                   COUNT(DISTINCT sheet_name) AS n_sheets,
                   COUNT(DISTINCT ROUND(value_num, 4)) AS n_distinct_values,
                   MIN(value_num) AS min_v,
                   MAX(value_num) AS max_v,
                   AVG(value_num) AS avg_v,
                   STRING_AGG(DISTINCT sheet_name, ' | ') AS sheets
            FROM facts
            GROUP BY 1,2,3,4,5
        )
        SELECT *,
               (max_v - min_v) AS abs_range,
               CASE WHEN avg_v != 0
                    THEN (max_v - min_v) / ABS(avg_v) ELSE NULL END AS rel_range
        FROM agg
        WHERE n_sheets >= 2
          AND n_distinct_values >= 2
        ORDER BY rel_range DESC NULLS LAST
        LIMIT 300
    """)
    summary = (
        f"{len(df)} (release, period, bank, indicator) tuples reported in "
        f"multiple sheets within one workbook with disagreeing values."
    )
    return df, summary
