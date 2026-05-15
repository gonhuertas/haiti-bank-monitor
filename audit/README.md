# BRH data audit

Infrastructure for auditing every cell of every sheet of every quarterly BRH
release for errors and inconsistencies. **This is a separate analysis pipeline,
not a dashboard runtime input** — the dashboard's `data.json`, `fx_data.json`,
and `cpi_data.json` are produced by the dashboard's own scripts. This `audit/`
folder is for finding bugs in the BRH source data, not for shipping anything.

## Architecture

```
audit/
├── extract.py         Day 1: dump every cell of every sheet to parquet
├── enrich.py          Day 2: add semantic columns (sheet_family, period, bank, …)
├── db.py              DuckDB connection helper
├── run.py             Orchestrator (subcommands: extract / enrich / audit)
├── queries/           Audit query library (Day 2)
└── data/              Output store (gitignored — ~300-500 MB)
    └── cells/         One parquet per release, queried as a single table
```

Plus `findings/` (gitignored) where audit query outputs land as CSV + markdown.

## Why long-format parquet + DuckDB

The dashboard's `brh-dashboard/data/processed/*.csv` files are **targeted
extractions** — they only carry the indicators the parsers were written to
look for (~15-20 indicators × 12 banks × ~100 quarters). For an audit that
needs to catch errors in cells the parsers never touch (Apparentés sheets,
sectoral tables, cross-sheet aggregates, etc.), we need every cell in a
single queryable store.

- **Long-format parquet**: every cell becomes one row with columns
  `(release, sheet, row_idx, col_idx, value_num, value_text, …)`. Compresses
  well (columnar) and supports incremental writes (one file per release).
- **DuckDB**: columnar SQL engine that queries parquet directly without loading
  it all into RAM. Typical audit queries run in 1-2 seconds on 30M rows.

## Scope

Reports from **2019 Q1 through 2026 Q1** (29 quarterly releases). Mix of `.xls`
(2019 Q1-Q3, 2020 Q1) and `.xlsx` (rest). Both formats handled via
`_brh_io.BRHFile` from `brh-dashboard/scripts/`.

## How to run

```powershell
# One-time: install duckdb
pip install duckdb

# Day 1: extract every cell from every sheet (~10 min, writes 29 parquet files)
python audit/run.py extract

# Day 2: add semantic enrichment columns (~5 min)
python audit/run.py enrich

# Run all audit queries; writes CSV + .md summaries to findings/
python audit/run.py audit

# Or all at once:
python audit/run.py all
```

To inspect the data interactively, use the bundled query helper (avoids
shell-quoting headaches with French characters and spaces):

```powershell
# Default overview
python audit/query.py

# Run arbitrary SQL (single argument, your shell does the quoting)
python audit/query.py "SELECT release_file, COUNT(*) FROM cells GROUP BY 1 ORDER BY 2 DESC"

# Dump every cell of a sheet
python audit/query.py --sheet "bilsysbandéc. 23"
python audit/query.py --sheet "bilsysbandéc. 23" --release brh_trim1_2026.xlsx

# Find every sheet whose name contains a substring
python audit/query.py --sheets-like bilsysban
```

Or from a Python script / REPL:

```python
import sys; sys.path.insert(0, 'audit')
from db import q
q("SELECT release_file, COUNT(*) FROM cells GROUP BY 1 ORDER BY 2 DESC")
```

## Schema

### `cells.parquet` (after extract)
| Column | Type | Notes |
|---|---|---|
| `release_file` | str | e.g. `brh_trim4_2023.xlsx` |
| `release_year` | int16 | parsed from filename |
| `release_quarter` | int8 | 1-4 |
| `sheet_name` | str | as-is, preserves trailing spaces and typos |
| `sheet_idx` | int16 | position in workbook (0-indexed) |
| `row_idx` | int32 | 1-indexed (matches `_brh_io` convention) |
| `col_idx` | int16 | 1-indexed |
| `value_num` | float64 \| null | non-null if cell is numeric |
| `value_text` | str \| null | non-null if cell is text / datetime / formula error |

### Added by enrich.py
| Column | Type | Notes |
|---|---|---|
| `sheet_family` | str | normalized prefix: `bilsysban`, `sysratfinclé`, `posinette`, … |
| `period_year`, `period_month` | int | parsed from sheet name when applicable |
| `period_resolution_method` | str | how period was resolved — see "Period resolution" below |
| `row_label` | str | col-1 text of that row |
| `col_label` | str | header-row text for that column |
| `bank` | str | resolved via `normalize_bank_name(col_label)` |
| `unit` | str | inferred from sheet header rows (best-effort) |

## Period resolution — the safety rail

This is the single most important interpretation rule for the audit. Every
cell carries a `period_resolution_method` column with one of three values:

| Value | Meaning | Safe for cross-release coordinate joins? |
|---|---|---|
| `sheet_name` | Period is in the sheet name (e.g. `bilsysbandéc. 23` → Dec 2023). Same `(sheet_name, row, col)` across releases refers to the same logical period. | ✅ Yes |
| `in_sheet_header` | Period is encoded in column headers within the sheet (e.g. BPHRÉSULT, partdemarc, panel sheets, posinette). The sheet rolls over annually or has multi-block layouts. Same coordinate across releases does NOT guarantee same period. | ❌ No (without per-family resolvers) |
| `unresolved` | Sheet name has no date AND we have no per-family rule. | ❌ No |

**Cross-release queries MUST filter `WHERE period_resolution_method = 'sheet_name'`**
unless they implement per-family period resolvers. This rule was added after
a false-positive incident on BPHRÉSULT — the sheet rolls over annually, so
the same Excel cell coordinate represents different periods in different
releases. Coordinate-based joins on such sheets produce nonsense.

To see what's being EXCLUDED by this filter, run the
`unresolved_periods_summary` query — it reports per-family safe vs unsafe
cell coverage so you know what's not being audited.

## Interpretation checklist — before claiming a finding is real

Audit query output is a **hypothesis**, not a verdict. Patterns that look
clean can equally come from a sheet's intended design that hasn't been
decoded. Before writing up any finding as a bug, do all of the following:

1. **Pick the top 3 rows from the query output.** Get the actual Excel
   cell coordinates: release file, sheet name, row index, column index
   (translated to Excel column letter — A=1, B=2, …).
2. **Verify the period mapping.** For each picked cell, check the IN-SHEET
   headers above it (look at row 6, 7 — and for sheets with multiple blocks,
   look for the block header rows BEFORE the data row). Confirm that the
   query's interpretation of which period the cell represents matches what
   the sheet's headers actually say.
3. **Spot-check at least one cell against Excel.** Open the file, navigate to
   the cell, confirm the value matches what the parquet says.
4. **Only after all 3 spot-checks pass** should the finding be elevated to a
   bug claim.

Use these severity tags accordingly:

- `[unverified]` — pattern detected by the query, structural interpretation
  not yet checked. **Default for any new finding.**
- `[verified-1-cell]` — at least one specific cell spot-checked against
  source.
- `[verified-systematic]` — pattern confirmed at multiple cells AND
  cross-checked against the source workbook structure.

Do not use 🔴 / "critical" / "smoking gun" / "massive finding" framing
until at least `[verified-1-cell]`.

## Adding new audit queries

Drop a new file in `queries/`:

```python
# queries/my_check.py
from audit.db import q

def run():
    df = q("""
        SELECT period_year, period_month, bank, COUNT(DISTINCT value_num) AS variants
        FROM cells_enriched
        WHERE sheet_family = 'bilsysban' AND row_idx = 22
        GROUP BY 1,2,3
        HAVING variants > 1
    """)
    return df, "Cells with cross-release variance for bilsysban row 22"
```

`run.py audit` discovers and runs every `*.py` in `queries/` that exposes a
`run()` function returning `(DataFrame, summary_str)`, and writes the result
to `findings/`.
