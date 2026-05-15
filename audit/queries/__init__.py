# Audit query modules. Each *.py file in this folder exposes a `run()` function
# returning (DataFrame, str) — the orchestrator (audit/run.py audit) discovers
# them automatically and writes results to audit/findings/.
