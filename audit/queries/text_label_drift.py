"""Text-label drift: same logical text cell carrying DIFFERENT text in different
releases. Catches the silent typo-fix pattern (e.g. DILAN PAR DANQUE →
BILAN PAR BANQUE).

Coordinates: (sheet_name, row_idx, col_idx). For each such location appearing
across 2+ releases, find cases where the value_text differs.
"""

from db import q


def run():
    df = q("""
        WITH text_cells AS (
            SELECT sheet_name, row_idx, col_idx, release_file, value_text
            FROM cells_enriched
            WHERE value_text IS NOT NULL
              AND row_idx <= 10  -- focus on header/title cells where typo-fixes happen
        ),
        agg AS (
            SELECT sheet_name, row_idx, col_idx,
                   COUNT(DISTINCT release_file) AS n_releases,
                   COUNT(DISTINCT value_text) AS n_distinct_texts,
                   STRING_AGG(DISTINCT value_text, ' ## ') AS texts_observed
            FROM text_cells
            GROUP BY 1, 2, 3
        )
        SELECT *
        FROM agg
        WHERE n_releases >= 3
          AND n_distinct_texts >= 2
        ORDER BY n_distinct_texts DESC, sheet_name, row_idx, col_idx
        LIMIT 200
    """)
    summary = (
        f"{len(df)} (sheet, row, col) text cells in early-row positions whose "
        f"value changed across 3+ releases. Likely silent typo-fixes / template edits."
    )
    return df, summary
