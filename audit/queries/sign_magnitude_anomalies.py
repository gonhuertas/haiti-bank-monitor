"""Sign + magnitude sanity checks.

Flags:
  1. Negative values for known-positive indicators (assets, deposits, equity,
     loans). A bank's total assets cannot be negative.
  2. Ratios > 1 (i.e. > 100%) for known-bounded ratios (liquidity ratios,
     capital ratios, NPL ratio).
     Note: BPH (a wind-down bank) routinely has CAR > 100% and NPL > 90% so
     it's excluded from these specific checks.
  3. Provision coverage > 5x is suspicious (above expected supervisory range).
"""

from db import q


# Patterns matching label text in the source data.
POSITIVE_LABELS = (
    "actif", "passif", "deposit", "dépôt", "loan", "prêt",
    "equity", "capital", "fonds prop", "avoir", "encaisse",
)

# Indicators whose values should be in [0, 1] (or close to it).
RATIO_LABELS = (
    "ratio", "/d", "/a", "couverture", "liquidit", "rentab", "marge",
)


def _likeany(col: str, words: tuple[str, ...]) -> str:
    return "(" + " OR ".join(
        f"LOWER({col}) LIKE '%{w}%'" for w in words
    ) + ")"


def run():
    df = q(f"""
        WITH suspicious AS (
            -- (1) Negative values for positive indicators
            SELECT release_file, sheet_name, sheet_family, row_idx, col_idx,
                   row_label, bank, value_num,
                   'negative_for_positive_indicator' AS issue
            FROM cells_enriched
            WHERE value_num < -1.0  -- ignore tiny rounding noise
              AND row_label IS NOT NULL
              AND {_likeany('row_label', POSITIVE_LABELS)}
              AND NOT (LOWER(row_label) LIKE '%revenu%'    -- revenues can be negative-ish via offsets
                    OR LOWER(row_label) LIKE '%dépense%'
                    OR LOWER(row_label) LIKE '%charge%'
                    OR LOWER(row_label) LIKE '%écart%')

            UNION ALL

            -- (2) Ratios > 100% (excluding BPH which is a special case)
            SELECT release_file, sheet_name, sheet_family, row_idx, col_idx,
                   row_label, bank, value_num,
                   'ratio_gt_100pct' AS issue
            FROM cells_enriched
            WHERE value_num > 1.05
              AND value_num < 50  -- exclude amounts (HTG bn) misclassified as ratios
              AND row_label IS NOT NULL
              AND {_likeany('row_label', RATIO_LABELS)}
              AND (bank IS NULL OR bank != 'BPH')

            UNION ALL

            -- (3) Implausibly large provision coverage
            SELECT release_file, sheet_name, sheet_family, row_idx, col_idx,
                   row_label, bank, value_num,
                   'provision_coverage_gt_5x' AS issue
            FROM cells_enriched
            WHERE value_num > 5
              AND value_num < 1000
              AND row_label IS NOT NULL
              AND LOWER(row_label) LIKE '%provis%couverture%'
        )
        SELECT * FROM suspicious
        ORDER BY issue, release_file, sheet_name, row_idx, col_idx
        LIMIT 500
    """)
    summary = (
        f"{len(df)} cells flagged: negative values where positive expected, "
        f"ratios >100% (excluding BPH), provision coverage >5×."
    )
    return df, summary
