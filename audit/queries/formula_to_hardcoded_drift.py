"""Formula-to-hardcoded drift: a logical cell that is a FORMULA in some releases
and a HARDCODED VALUE in others.

This catches the silent corruption pattern: someone manually overrode a
calculated total with a typed-in number, breaking the formula chain. The
cached value may look fine but the underlying logic is gone.

A "logical cell" here = (sheet_name, row_idx, col_idx). For each, we check:
  - in how many releases is there a formula at that location?
  - in how many releases is there a non-null cached value but no formula?

Cells that flip back and forth between formula and hardcoded are suspicious.

SAFETY RAIL: filters period_resolution_method = 'sheet_name'. The original
version of this query produced a major false positive on BPHRÉSULT — the
sheet rolls over annually, so the same (sheet, row, col) across releases
represents different periods, and the pattern of "formula in some releases,
hardcoded in others" reflected the natural progression of populating new
quarters and snapshotting old ones, NOT human override. Filtering to
sheet_name-resolved sheets avoids this class of false positive.
"""

from db import q


def run():
    df = q("""
        WITH joined AS (
            SELECT
                c.release_file, c.sheet_name, c.row_idx, c.col_idx,
                c.value_num, c.value_text,
                f.formula
            FROM cells_enriched c
            LEFT JOIN formulas f
                   ON c.release_file = f.release_file
                  AND c.sheet_name   = f.sheet_name
                  AND c.row_idx      = f.row_idx
                  AND c.col_idx      = f.col_idx
            WHERE c.release_file LIKE '%.xlsx'  -- formulas only available for xlsx
              AND c.period_resolution_method = 'sheet_name'  -- safety rail
        ),
        per_loc AS (
            SELECT sheet_name, row_idx, col_idx,
                   COUNT(*) AS n_releases_present,
                   SUM(CASE WHEN formula IS NOT NULL THEN 1 ELSE 0 END) AS n_formula,
                   SUM(CASE WHEN formula IS NULL AND value_num IS NOT NULL THEN 1 ELSE 0 END) AS n_hardcoded_num,
                   STRING_AGG(DISTINCT formula, ' | ') AS formulas_seen
            FROM joined
            GROUP BY 1, 2, 3
        )
        SELECT *
        FROM per_loc
        WHERE n_formula >= 1
          AND n_hardcoded_num >= 1
          AND n_releases_present >= 5  -- only flag cells with enough history
        ORDER BY (n_formula + n_hardcoded_num) DESC, sheet_name, row_idx, col_idx
        LIMIT 500
    """)
    summary = (
        f"{len(df)} (sheet, row, col) locations that are sometimes a formula "
        f"and sometimes a hardcoded number across releases. Likely manual "
        f"overrides of calculated cells."
    )
    return df, summary
