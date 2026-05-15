"""Audit pipeline orchestrator.

Subcommands:
    extract           Day 1: dump every cell to parquet (one file per release)
    enrich            Day 2: add semantic columns (sheet_family, period, bank, ...)
    extract-formulas  Day 3: dump every formula string from xlsx releases
    audit             run every query under queries/ and write findings to findings/
    all               extract → enrich → extract-formulas → audit, in sequence

Usage:
    python audit/run.py extract
    python audit/run.py enrich
    python audit/run.py extract-formulas
    python audit/run.py audit
    python audit/run.py all
"""

from __future__ import annotations

import importlib
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
QUERIES_DIR = SCRIPT_DIR / "queries"
FINDINGS_DIR = SCRIPT_DIR / "findings"

USAGE = "Usage: python audit/run.py {extract|enrich|extract-formulas|audit|all}"


def cmd_extract() -> None:
    from extract import main as extract_main
    extract_main()


def cmd_enrich() -> None:
    from enrich import main as enrich_main
    enrich_main()


def cmd_extract_formulas() -> None:
    from extract_formulas import main as extract_formulas_main
    extract_formulas_main()


def _discover_queries() -> list[Path]:
    return sorted(
        p for p in QUERIES_DIR.glob("*.py")
        if p.name != "__init__.py" and not p.name.startswith("_")
    )


def cmd_audit() -> None:
    py_files = _discover_queries()
    if not py_files:
        print("audit: no queries in audit/queries/. Nothing to do.")
        return

    FINDINGS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    summary_lines: list[str] = [
        f"# Audit run — {stamp}",
        "",
        f"Queries: {len(py_files)}",
        "",
    ]

    print(f"\nRunning {len(py_files)} audit queries  (stamp = {stamp})\n")

    # Make queries/ importable as a package so they can `from db import q`.
    sys.path.insert(0, str(SCRIPT_DIR))
    sys.path.insert(0, str(QUERIES_DIR))

    for i, py in enumerate(py_files, 1):
        name = py.stem
        t0 = time.monotonic()
        try:
            mod = importlib.import_module(name)
            df, summary = mod.run()
        except Exception as e:
            print(f"  [{i:2d}/{len(py_files)}] {name:35s}  FAILED ({type(e).__name__}: {e})")
            summary_lines.append(f"## ❌ {name}\n\nFailed: `{type(e).__name__}: {e}`\n")
            continue

        elapsed = time.monotonic() - t0
        n_rows = len(df)
        csv_path = FINDINGS_DIR / f"{name}__{stamp}.csv"
        md_path  = FINDINGS_DIR / f"{name}__{stamp}.md"
        df.to_csv(csv_path, index=False)

        # Markdown summary: query name, summary line, head of findings.
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(f"# {name}\n\n")
            f.write(f"**{summary}**\n\n")
            f.write(f"- Rows returned: **{n_rows}**\n")
            f.write(f"- Run time: {elapsed:.1f}s\n")
            f.write(f"- Full output: `{csv_path.name}`\n\n")
            if n_rows > 0:
                f.write("## First 25 rows\n\n")
                f.write(df.head(25).to_markdown(index=False))
                f.write("\n")

        marker = "★" if n_rows > 0 else " "
        print(f"  [{i:2d}/{len(py_files)}] {marker} {name:35s}  "
              f"{n_rows:>5} rows  ({elapsed:5.1f}s)  → {md_path.name}")
        summary_lines.append(
            f"## {marker} {name}\n\n"
            f"{summary}\n\n"
            f"- Rows: {n_rows}, runtime: {elapsed:.1f}s\n"
            f"- Files: [{md_path.name}]({md_path.name}), [{csv_path.name}]({csv_path.name})\n"
        )

    # Combined run summary
    combined = FINDINGS_DIR / f"_run__{stamp}.md"
    combined.write_text("\n".join(summary_lines), encoding="utf-8")
    print(f"\nCombined summary: {combined.name}")


def main() -> None:
    sys.path.insert(0, str(SCRIPT_DIR))
    if len(sys.argv) != 2:
        sys.exit(USAGE)
    cmd = sys.argv[1]
    if cmd == "extract":
        cmd_extract()
    elif cmd == "enrich":
        cmd_enrich()
    elif cmd in ("extract-formulas", "extract_formulas"):
        cmd_extract_formulas()
    elif cmd == "audit":
        cmd_audit()
    elif cmd == "all":
        cmd_extract()
        cmd_enrich()
        cmd_extract_formulas()
        cmd_audit()
    else:
        sys.exit(USAGE)


if __name__ == "__main__":
    main()
