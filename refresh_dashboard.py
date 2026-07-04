"""One-command refresh for the Haiti Banking Monitor dashboard.

Chains the whole pipeline end-to-end so a newly-published BRH quarter (and the
latest IMF CPI) flows all the way to the three JSON files the dashboard serves:

    1. Upstream BRH pipeline  (FM Test/brh-dashboard/scripts/refresh_all.py)
         · downloads any new BRH quarterly reports from brh.ht
         · parses sysratfinclé / bilsysban / suffondspropres / posinette
           into data/processed/*.csv
         · rebuilds the legacy Financial Monitoring Excel report
    2. build_data.py       processed CSVs           -> data.json
    3. build_fx_data.py    brh_fx_positions.csv     -> fx_data.json
    4. build_cpi_data.py   IMF SDMX (IHSI IPC)      -> cpi_data.json
                           (30-day cache; refetches only when stale)

Each step runs as its own subprocess with the same Python interpreter that runs
this orchestrator. The pipeline aborts on the first failure and says which step.

Usage:
    python refresh_dashboard.py                 # full refresh (download + parse + rebuild)
    python refresh_dashboard.py --offline       # skip BRH download, reparse existing raw files
    python refresh_dashboard.py --skip-upstream # only rebuild the 3 JSONs from existing CSVs
    python refresh_dashboard.py --force-cpi     # ignore the CPI cache and refetch from the IMF

After it finishes, review the diff and push — GitHub Pages redeploys on push:
    git add data.json fx_data.json cpi_data.json && git commit -m "Refresh dashboard data" && git push
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
# The upstream BRH pipeline lives in the sibling "FM Test" checkout. build_*.py
# already assume this same sibling layout for their CSV inputs.
UPSTREAM_REFRESH = (
    SCRIPT_DIR.parent / "FM Test" / "brh-dashboard" / "scripts" / "refresh_all.py"
)


def run_step(name: str, argv: list[str]) -> float:
    """Run one pipeline step as a subprocess; return duration in seconds.

    stdout/stderr are inherited so each step's own progress prints stream
    through in real time. Aborts the whole pipeline on a non-zero exit.
    """
    print(f"\n{'=' * 80}")
    print(f"STEP: {name}")
    print(f"{'=' * 80}")
    start = time.monotonic()
    result = subprocess.run(argv, check=False)
    duration = time.monotonic() - start
    if result.returncode != 0:
        print(f"\n[FAIL] '{name}' exited with code {result.returncode}. Aborting.")
        sys.exit(result.returncode)
    print(f"\n[OK] {name}  ({duration:.1f}s)")
    return duration


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--offline", action="store_true",
                    help="Skip the BRH download; reparse existing files in data/raw/.")
    ap.add_argument("--skip-upstream", action="store_true",
                    help="Skip the whole BRH pipeline; only rebuild the JSONs from existing CSVs.")
    ap.add_argument("--force-cpi", action="store_true",
                    help="Ignore the 30-day CPI cache and refetch from the IMF.")
    args = ap.parse_args()

    py = sys.executable
    step_times: list[tuple[str, float]] = []
    total_start = time.monotonic()

    print("Haiti Banking Monitor — dashboard refresh")
    print(f"Dashboard dir : {SCRIPT_DIR}")
    if args.skip_upstream:
        print("Mode          : skip-upstream (rebuild JSONs from existing CSVs)")
    elif args.offline:
        print("Mode          : offline (reparse existing raw, no download)")

    # ── 1. Upstream BRH pipeline ─────────────────────────────────────────────
    if args.skip_upstream:
        print("\n[SKIP] Upstream BRH pipeline (--skip-upstream)")
    elif not UPSTREAM_REFRESH.exists():
        print(f"\n[FAIL] Upstream pipeline not found at:\n  {UPSTREAM_REFRESH}\n"
              f"Expected the 'FM Test' checkout as a sibling of this repo. "
              f"Use --skip-upstream to rebuild JSONs from whatever CSVs already exist.")
        sys.exit(1)
    else:
        upstream_argv = [py, str(UPSTREAM_REFRESH)]
        if args.offline:
            upstream_argv.append("--offline")
        step_times.append(("Upstream BRH pipeline",
                           run_step("Upstream BRH pipeline (download + parse)", upstream_argv)))

    # ── 2-4. Dashboard JSON builders ─────────────────────────────────────────
    builders = [
        ("Build data.json (bank indicators)", [py, str(SCRIPT_DIR / "build_data.py")]),
        ("Build fx_data.json (FX positions)", [py, str(SCRIPT_DIR / "build_fx_data.py")]),
        ("Build cpi_data.json (IMF CPI)",
         [py, str(SCRIPT_DIR / "build_cpi_data.py")]
         + (["--force"] if args.force_cpi else [])),
    ]
    for name, argv in builders:
        step_times.append((name, run_step(name, argv)))

    # ── Summary ──────────────────────────────────────────────────────────────
    total = time.monotonic() - total_start
    print(f"\n{'=' * 80}")
    print(f"Dashboard refresh complete in {total:.1f}s.")
    print(f"{'=' * 80}")
    for name, dur in step_times:
        print(f"  {dur:>6.1f}s  {name}")
    print("\nReview the diff, then push (GitHub Pages redeploys on push):")
    print("  git add data.json fx_data.json cpi_data.json")
    print('  git commit -m "Refresh dashboard data" && git push')


if __name__ == "__main__":
    main()
