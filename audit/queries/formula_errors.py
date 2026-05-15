"""Formula errors: cached cells displaying #DIV/0!, #REF!, #NAME?, #VALUE!, #N/A.

These are formulas that Excel evaluated to an error condition. Each one is a
broken formula sitting inside a published BRH workbook. Most are silent —
quarterly review processes don't usually catch them visually.

Excel error tokens:
    #DIV/0!  — division by zero (denominator hit zero)
    #REF!    — formula references a deleted/moved cell
    #NAME?   — unrecognised function or named range
    #VALUE!  — type mismatch (text vs number, mostly)
    #N/A     — explicit not-available (often from VLOOKUP misses)
    #NULL!   — intersection of non-overlapping ranges
    #NUM!    — invalid numeric arg

We look at value_text since openpyxl stores error tokens as strings when
loaded with data_only=True.
"""

from db import q


def run():
    df = q("""
        SELECT release_file, sheet_family, sheet_name, row_idx, col_idx,
               row_label, col_label, bank, value_text AS error_token
        FROM cells_enriched
        WHERE value_text IN ('#DIV/0!', '#REF!', '#NAME?', '#VALUE!',
                             '#N/A', '#NULL!', '#NUM!')
        ORDER BY release_file, sheet_name, row_idx, col_idx
        LIMIT 500
    """)
    by_token = q("""
        SELECT value_text AS error_token, COUNT(*) AS n_cells
        FROM cells_enriched
        WHERE value_text IN ('#DIV/0!', '#REF!', '#NAME?', '#VALUE!',
                             '#N/A', '#NULL!', '#NUM!')
        GROUP BY 1 ORDER BY 2 DESC
    """)
    summary = (
        f"{len(df)} cells (capped at 500) carrying formula error tokens. "
        f"Breakdown by token: " +
        ", ".join(f"{r['error_token']}={r['n_cells']}" for _, r in by_token.iterrows())
        if not by_token.empty else f"{len(df)} cells with formula errors."
    )
    return df, summary
