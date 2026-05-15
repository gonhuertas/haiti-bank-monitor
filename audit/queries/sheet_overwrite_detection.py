"""Sheet-overwrite detection: pairs of sheets within the same release whose
NUMERIC content matches at >= 90% of cells.

This is the 'Dec 23 sheet ≡ Dec 25 sheet' detector. Two distinct period sheets
should have very few cells in common (different historical data). When they
match, the template-bug overwrite is in play.
"""

from db import q


def run():
    # Self-join cells_enriched on numeric values within (release, family).
    # Only consider sheets in dated families (per-quarter sheets).
    df = q("""
        WITH dated_sheets AS (
            SELECT DISTINCT release_file, sheet_name, sheet_family,
                   period_year, period_month
            FROM cells_enriched
            WHERE sheet_family IN ('bilsysban', 'sysratfinclé', 'apparentés',
                                    'non apparentés', 'secteur_activité',
                                    'somfinbilsys', 'somfinrésys')
              AND period_year IS NOT NULL
        ),
        sheet_cells AS (
            SELECT c.release_file, c.sheet_name, c.row_idx, c.col_idx, c.value_num
            FROM cells_enriched c
            JOIN dated_sheets d
              ON c.release_file = d.release_file AND c.sheet_name = d.sheet_name
            WHERE c.value_num IS NOT NULL
        ),
        sheet_sizes AS (
            SELECT release_file, sheet_name, COUNT(*) AS n_numeric_cells
            FROM sheet_cells GROUP BY 1, 2
        ),
        pair_matches AS (
            SELECT a.release_file,
                   a.sheet_name AS sheet_a,
                   b.sheet_name AS sheet_b,
                   COUNT(*) AS matching_cells
            FROM sheet_cells a
            JOIN sheet_cells b
              ON a.release_file = b.release_file
             AND a.row_idx = b.row_idx
             AND a.col_idx = b.col_idx
             AND a.value_num = b.value_num
             AND a.sheet_name < b.sheet_name   -- one direction only
            GROUP BY 1, 2, 3
            HAVING COUNT(*) >= 50              -- minimum overlap floor
        )
        SELECT
            p.release_file,
            p.sheet_a,
            p.sheet_b,
            p.matching_cells,
            sa.n_numeric_cells AS cells_in_a,
            sb.n_numeric_cells AS cells_in_b,
            ROUND(p.matching_cells * 1.0 / LEAST(sa.n_numeric_cells, sb.n_numeric_cells), 3)
                AS overlap_ratio
        FROM pair_matches p
        JOIN sheet_sizes sa ON sa.release_file = p.release_file AND sa.sheet_name = p.sheet_a
        JOIN sheet_sizes sb ON sb.release_file = p.release_file AND sb.sheet_name = p.sheet_b
        WHERE p.matching_cells * 1.0 / LEAST(sa.n_numeric_cells, sb.n_numeric_cells) >= 0.85
        ORDER BY overlap_ratio DESC, p.release_file
        LIMIT 200
    """)
    summary = (
        f"{len(df)} pairs of period-dated sheets within the same release with "
        f">=85% numeric overlap. Likely candidates for the overwrite bug."
    )
    return df, summary
