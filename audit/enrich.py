"""Day 2: semantic enrichment of the audit cell store.

Reads every per-release parquet under data/cells/, computes additional
semantic columns, and writes a single consolidated parquet at
data/cells_enriched.parquet that DuckDB views via `cells_enriched`.

Added columns:
    sheet_family    Normalized prefix: 'bilsysban', 'sysratfinclé', 'posinette',
                    'suffondspropres', 'apparentés', 'non apparentés',
                    'secteur d_activité', 'somfin*', '<bank>résult', etc.
    period_year     Year from sheet name (where parseable). Null for sheets
    period_month    Month   without an embedded date (single-sheet families).
    period_resolution_method
                    How period_year/month was determined. CRITICAL for any
                    cross-release query — see "Period resolution methods" below.
    row_label       Column-1 text of the row this cell belongs to. The line-
                    item label (e.g. 'Encaisse', 'Avoirs à la BRH').
    col_label       Header-row text of the column this cell belongs to. The
                    column header (e.g. 'UNIBNK', 'BNC', 'SOUS-TOTAL').
    bank            normalize_bank_name(col_label) — canonical ticker for
                    actual banks; null otherwise (e.g. for 'SOUS-TOTAL').

Period resolution methods (the key safety rail, added after the BPHRÉSULT
false-positive incident):

    'sheet_name'         Period is in the sheet name (e.g. 'bilsysbandéc. 23').
                         Same (sheet_name, row, col) coordinate across releases
                         refers to the same logical period. SAFE for cross-
                         release joins by coordinate.
    'in_sheet_header'    Period is encoded in column headers within the sheet
                         (e.g. BPHRÉSULT, partdemarc, panel sheets, posinette).
                         The sheet rolls over annually or has multi-block
                         layouts. Same coordinate across releases does NOT
                         guarantee same period. UNSAFE — cross-release
                         queries must skip these or use per-family resolvers.
    'unresolved'         Sheet name has no date AND we have no per-family rule
                         (orphan / one-off sheets). UNSAFE.

Audit queries that compare values across releases by coordinate must filter
WHERE period_resolution_method = 'sheet_name' to avoid the BPHRÉSULT-class
of false positive (comparing values that look like the same coordinate but
represent different periods).

Bank-header-row detection:
    For each (release, sheet), we scan rows 1-15 looking for the row with the
    most non-null cells whose normalized text matches a known bank ticker.
    That row is taken as the bank-header row; col_label / bank are populated
    from it. This handles BRH's varying layouts — they shift the header row
    by ±1 or ±2 between vintages — without any hardcoded row numbers.

Unit inference is deferred to a later pass. Adding it requires per-family
logic and produces noisy results; the existing 8 audit queries don't depend
on it.
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).parent
INPUT_GLOB = SCRIPT_DIR / "data" / "cells" / "*.parquet"
OUTPUT_FILE = SCRIPT_DIR / "data" / "cells_enriched.parquet"

# Reuse _brh_io.normalize_bank_name + parse_sheet_date.
BRH_DASHBOARD_SCRIPTS = (SCRIPT_DIR / ".." / ".." / "FM Test" / "brh-dashboard"
                         / "scripts").resolve()
sys.path.insert(0, str(BRH_DASHBOARD_SCRIPTS))
from _brh_io import normalize_bank_name, parse_sheet_date, BANK_ALIASES  # noqa: E402


# ── Sheet-family classification ───────────────────────────────────────────────

# Order matters: longest / most specific prefixes first.
_FAMILY_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"^bilsysban", re.IGNORECASE),       "bilsysban"),
    (re.compile(r"^sysratfincl", re.IGNORECASE),     "sysratfinclé"),
    (re.compile(r"^suffondsprop", re.IGNORECASE),    "suffondspropres"),
    (re.compile(r"^posinette", re.IGNORECASE),       "posinette"),
    (re.compile(r"^somfinbilsys", re.IGNORECASE),    "somfinbilsys"),
    (re.compile(r"^somfinrésys", re.IGNORECASE),     "somfinrésys"),
    (re.compile(r"^somfindétvan", re.IGNORECASE),    "somfindétvan"),
    (re.compile(r"^somfindétfsfin", re.IGNORECASE),  "somfindétfsfin"),
    (re.compile(r"^somfin", re.IGNORECASE),          "somfin_other"),
    (re.compile(r"^sofibilcompsys", re.IGNORECASE),  "sofibilcompsys"),
    (re.compile(r"^sofibilgdes", re.IGNORECASE),     "sofibilgdes"),
    (re.compile(r"^sofiinfisys", re.IGNORECASE),     "sofiinfisys"),
    (re.compile(r"^apparentés", re.IGNORECASE),      "apparentés"),
    (re.compile(r"^non apparentés", re.IGNORECASE),  "non apparentés"),
    (re.compile(r"^secteur d['' ]?activit", re.IGNORECASE), "secteur_activité"),
    (re.compile(r"^partdemarc", re.IGNORECASE),      "partdemarc"),
    (re.compile(r"résult\s*$", re.IGNORECASE),       "résult_per_bank"),
    (re.compile(r"^résult\s*$", re.IGNORECASE),      "résultsyst"),
    (re.compile(r"^résultsyst", re.IGNORECASE),      "résultsyst"),
    (re.compile(r"^pageint", re.IGNORECASE),         "page_section"),
    (re.compile(r"^page", re.IGNORECASE),            "page_other"),
    (re.compile(r"^tabmat", re.IGNORECASE),          "tabmat"),
    (re.compile(r"^noteutili", re.IGNORECASE),       "noteutili"),
    (re.compile(r"^xxxx", re.IGNORECASE),            "placeholder_xxxx"),
    (re.compile(r"^sheet\d+\s*$", re.IGNORECASE),    "blank_sheetN"),
    # Per-indicator panels (single-sheet time-series of one indicator)
    (re.compile(r"^actifs", re.IGNORECASE),          "panel_actifs"),
    (re.compile(r"^dispo", re.IGNORECASE),           "panel_dispo"),
    (re.compile(r"^bonsbrh", re.IGNORECASE),         "panel_bonsbrh"),
    (re.compile(r"^prêts nets", re.IGNORECASE),      "panel_prets_nets"),
    (re.compile(r"^dépôts", re.IGNORECASE),          "panel_dépôts"),
    (re.compile(r"^bénef", re.IGNORECASE),           "panel_bénef"),
    (re.compile(r"^revint", re.IGNORECASE),          "panel_revint"),
    (re.compile(r"^aut\.rev", re.IGNORECASE),        "panel_aut_rev"),
    (re.compile(r"^m\.net", re.IGNORECASE),          "panel_m_net"),
    (re.compile(r"^frais", re.IGNORECASE),           "panel_frais"),
    (re.compile(r"^f\.d", re.IGNORECASE),            "panel_f_d"),
    (re.compile(r"^av\.des", re.IGNORECASE),         "panel_av_desact"),
    (re.compile(r"^employés", re.IGNORECASE),        "panel_employés"),
    (re.compile(r"^nbre", re.IGNORECASE),            "panel_nbre"),
]


def classify_family(sheet_name: str) -> str:
    """Return canonical sheet-family for a raw sheet name. Unmatched -> 'other'."""
    s = sheet_name.strip()
    for pat, fam in _FAMILY_RULES:
        if pat.search(s):
            return fam
    return "other"


# ── Period extraction ─────────────────────────────────────────────────────────

def extract_period(sheet_name: str) -> tuple[int | None, int | None, str]:
    """Resolve a sheet's period. Returns (year, month, resolution_method).

    resolution_method is one of:
        'sheet_name'      — period parsed from the sheet name (safe)
        'in_sheet_header' — sheet has no date in name; period must come from
                            in-sheet column headers and may roll over each
                            release (unsafe for cross-release coordinate joins)
        'unresolved'      — neither (currently same as 'in_sheet_header' but
                            kept distinct for future per-family resolver work)

    See the module docstring for the safety rail this column unlocks.
    """
    try:
        ts = parse_sheet_date(sheet_name)
    except Exception:
        ts = None
    if ts is not None:
        return int(ts.year), int(ts.month), "sheet_name"
    # No date in sheet name → period must be resolved per-cell from in-sheet
    # headers (BPHRÉSULT, partdemarc, panel sheets, posinette, etc.).
    # We do not have per-family resolvers yet, so leave year/month null and
    # mark the cell as unsafe for cross-release coordinate joins.
    return None, None, "in_sheet_header"


# ── Bank-header-row detection ─────────────────────────────────────────────────

# Set of known bank tickers (canonical names + their aliases). Used to score
# candidate rows for "this is the bank-header row."
_KNOWN_BANK_TOKENS: set[str] = (
    set(BANK_ALIASES.keys())
    | set(BANK_ALIASES.values())
    | {"UNIBK", "UNIBNK", "SOGEBK", "BNC", "CAPITALBK", "BUH", "SOGEBL",
       "CBNA", "BPH", "BHD", "PROMOBK", "SCOTIA", "SOCABK", "BICH",
       "SYSTÈME", "TOTAL", "SOUS-TOTAL"}
)


def vectorized_header_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Vectorized: for every (release_file, sheet_name) group, return the row_idx
    of the most likely bank-header row. ~100× faster than groupby.apply."""
    cand = df[
        (df["row_idx"] <= 15) &
        df["value_text"].notna()
    ][["release_file", "sheet_name", "row_idx", "value_text"]].copy()
    if cand.empty:
        return pd.DataFrame(columns=["release_file", "sheet_name", "header_row"])

    # Pre-cache normalize_bank_name results across the full set of distinct text values.
    distinct_texts = cand["value_text"].astype(str).unique()
    norm_cache = {t: normalize_bank_name(t) for t in distinct_texts}
    cand["normalized"] = cand["value_text"].astype(str).map(norm_cache)
    cand["is_bank"] = cand["normalized"].isin(_KNOWN_BANK_TOKENS)

    # Hits per (release, sheet, row).
    hits = (
        cand.groupby(["release_file", "sheet_name", "row_idx"], observed=True)
            ["is_bank"].sum().reset_index(name="n_bank_hits")
    )
    hits = hits[hits["n_bank_hits"] >= 3]

    # Pick the row with the most bank hits per (release, sheet).
    idx = (
        hits.sort_values(["release_file", "sheet_name", "n_bank_hits", "row_idx"],
                         ascending=[True, True, False, True])
            .drop_duplicates(["release_file", "sheet_name"], keep="first")
    )
    return idx.rename(columns={"row_idx": "header_row"})[
        ["release_file", "sheet_name", "header_row"]
    ]


# ── Main enrichment pipeline ──────────────────────────────────────────────────

def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main() -> None:
    parquet_files = sorted(Path(SCRIPT_DIR / "data" / "cells").glob("*.parquet"))
    if not parquet_files:
        sys.exit("No parquet files found under data/cells/. Run extract first.")

    print(f"Audit enrichment — Day 2 (semantic columns)", flush=True)
    print(f"Input:  {len(parquet_files)} parquet files", flush=True)
    print(f"Output: {OUTPUT_FILE.relative_to(SCRIPT_DIR.parent)}", flush=True)

    t0 = time.monotonic()
    _log(f"Loading all parquet files into memory...")
    df = pd.concat([pd.read_parquet(p) for p in parquet_files], ignore_index=True)
    print(f"  loaded {len(df):,} cells", flush=True)

    # 1. sheet_family — vectorized across unique sheet names (cheap)
    _log("Classifying sheet families...")
    unique_sheets = df["sheet_name"].unique()
    family_map = {s: classify_family(s) for s in unique_sheets}
    df["sheet_family"] = df["sheet_name"].map(family_map)
    print(f"  {len(set(family_map.values()))} distinct families across "
          f"{len(unique_sheets):,} sheet names", flush=True)

    # 2. period_year / period_month / period_resolution_method
    # Vectorized via map() on unique sheet names. The resolution_method column
    # is the key safety rail — see module docstring.
    _log("Extracting period from sheet names...")
    period_map = {s: extract_period(s) for s in unique_sheets}
    df["period_year"]  = df["sheet_name"].map(
        lambda s: period_map[s][0]).astype("Int16")
    df["period_month"] = df["sheet_name"].map(
        lambda s: period_map[s][1]).astype("Int8")
    df["period_resolution_method"] = df["sheet_name"].map(
        lambda s: period_map[s][2]).astype("category")
    n_dated = sum(1 for v in period_map.values() if v[0] is not None)
    print(f"  {n_dated:,}/{len(period_map):,} sheets have parseable period in name "
          f"(resolution_method='sheet_name')", flush=True)
    n_in_header = len(period_map) - n_dated
    print(f"  {n_in_header:,} sheets have no parseable date in name → marked "
          f"'in_sheet_header' (unsafe for cross-release coordinate joins)",
          flush=True)

    # 3. row_label — col-1 text of each row, joined back via merge (NOT dict+zip)
    _log("Computing row_label via merge...")
    col1 = df.loc[df["col_idx"] == 1, ["release_file", "sheet_name", "row_idx",
                                        "value_text", "value_num"]].copy()
    # Prefer text; fall back to numeric for the rare numeric-label case.
    col1["row_label"] = col1["value_text"].where(
        col1["value_text"].notna(),
        col1["value_num"].astype("string"),
    )
    df = df.merge(
        col1[["release_file", "sheet_name", "row_idx", "row_label"]],
        on=["release_file", "sheet_name", "row_idx"],
        how="left",
    )

    # 4. col_label + bank — auto-detect bank-header row per (release, sheet) (vectorized)
    _log("Detecting bank-header rows (vectorized)...")
    families_with_bank_columns = {
        "bilsysban", "sysratfinclé", "suffondspropres", "somfinbilsys",
        "somfinrésys", "somfindétvan", "somfindétfsfin", "somfin_other",
        "sofibilcompsys", "sofibilgdes", "apparentés", "non apparentés",
        "secteur_activité", "partdemarc",
    }
    bankcol_df = df[df["sheet_family"].isin(families_with_bank_columns)]
    header_rows = vectorized_header_rows(bankcol_df)
    print(f"  bank-header row detected for {len(header_rows):,} sheets", flush=True)

    # Materialize per-cell col_label by joining: header row's text values become
    # col_label for every cell in the same (release, sheet) at the same col_idx.
    _log("Materializing col_label + bank via merge...")
    header_cells = df.merge(
        header_rows.rename(columns={"header_row": "row_idx"}),
        on=["release_file", "sheet_name", "row_idx"],
        how="inner",
    )[["release_file", "sheet_name", "col_idx", "value_text"]].rename(
        columns={"value_text": "col_label"}
    )
    # Some header cells are numeric — drop those.
    header_cells = header_cells.dropna(subset=["col_label"])
    df = df.merge(
        header_cells, on=["release_file", "sheet_name", "col_idx"], how="left",
    )

    # Resolve bank from col_label.
    distinct_labels = df["col_label"].dropna().astype(str).unique()
    bank_map = {lbl: normalize_bank_name(lbl) for lbl in distinct_labels}
    df["bank"] = df["col_label"].astype(object).map(bank_map)
    # Drop non-bank aggregates so `bank` only carries actual bank tickers.
    df.loc[df["bank"].isin({"SOUS-TOTAL", "SYSTÈME", "TOTAL"}), "bank"] = None
    n_with_bank = df["bank"].notna().sum()
    print(f"  bank resolved on {n_with_bank:,} / {len(df):,} cells "
          f"({100*n_with_bank/len(df):.1f}%)", flush=True)

    _log(f"Writing {OUTPUT_FILE.name}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_FILE, index=False, compression="zstd")
    size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"  wrote {len(df):,} rows × {len(df.columns)} cols  ({size_mb:.1f} MB)",
          flush=True)
    print(f"\nDone in {time.monotonic() - t0:.1f}s.", flush=True)


if __name__ == "__main__":
    main()
