"""Reporting gaps: (period × bank × indicator) tuples that are MISSING from
releases that ought to have them.

For each (sheet_family, row_label) "indicator," derive the set of
(period, bank) tuples observed across all releases. Then flag releases that
"should" carry a given (period, bank) but don't.

The "should" rule: a release published in year Y/quarter Q should carry every
period from the family's earliest published period through the just-finished
quarter (Y, Q-1 with appropriate roll-over).

Simpler proxy used here: for each (sheet_family, period), if the period
appears in some release that's chronologically AFTER the release we're
checking, it should appear in the later release too. We flag any
(release, sheet_family, period, bank, row_label) that's missing while the
SAME period appears in a NEIGHBOURING release of the same family.
"""

from db import q


def run():
    df = q("""
        WITH dated_facts AS (
            SELECT release_file, release_year, release_quarter,
                   sheet_family, period_year, period_month,
                   bank, row_label
            FROM cells_enriched
            WHERE bank IS NOT NULL
              AND value_num IS NOT NULL
              AND row_label IS NOT NULL
              AND period_year IS NOT NULL
              AND period_resolution_method = 'sheet_name'  -- safety rail
              AND sheet_family IN ('bilsysban', 'sysratfinclé')
        ),
        all_keys AS (
            SELECT DISTINCT sheet_family, period_year, period_month, bank, row_label
            FROM dated_facts
        ),
        all_releases AS (
            SELECT DISTINCT release_file, release_year, release_quarter
            FROM cells_enriched
        ),
        -- For each (release, sheet_family, period), did the parser see it?
        observed AS (
            SELECT release_file, sheet_family, period_year, period_month, bank, row_label
            FROM dated_facts
        ),
        expected AS (
            -- A (release, period, bank, indicator) tuple is "expected" if the
            -- period appears in some release AT OR LATER THAN this one
            -- (i.e. we'd expect later releases to keep the historical row).
            SELECT
                ar.release_file,
                ar.release_year,
                ar.release_quarter,
                ak.sheet_family,
                ak.period_year,
                ak.period_month,
                ak.bank,
                ak.row_label
            FROM all_releases ar
            CROSS JOIN all_keys ak
            -- only "expected" if the period was first published in or before
            -- this release's quarter (i.e. this release came AFTER first publication)
            WHERE EXISTS (
                SELECT 1 FROM dated_facts df
                WHERE df.sheet_family = ak.sheet_family
                  AND df.period_year = ak.period_year
                  AND df.period_month = ak.period_month
                  AND (df.release_year * 4 + df.release_quarter)
                       <= (ar.release_year * 4 + ar.release_quarter)
            )
        )
        SELECT
            e.release_file, e.sheet_family, e.period_year, e.period_month,
            e.bank, e.row_label
        FROM expected e
        LEFT JOIN observed o
          ON  e.release_file = o.release_file
          AND e.sheet_family = o.sheet_family
          AND e.period_year = o.period_year
          AND e.period_month = o.period_month
          AND e.bank = o.bank
          AND e.row_label = o.row_label
        WHERE o.release_file IS NULL
        ORDER BY e.release_file, e.sheet_family, e.period_year, e.period_month, e.bank
        LIMIT 500
    """)
    summary = (
        f"{len(df)} (release, sheet_family, period, bank, indicator) tuples "
        f"that are missing from a release where they should be present "
        f"(based on the period being published in earlier-or-equal releases)."
    )
    return df, summary
