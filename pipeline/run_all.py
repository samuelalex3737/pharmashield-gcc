"""Re-runs the whole PharmaShield pipeline headless in one command.

    python pipeline/run_all.py

1. Executes notebooks 01 to 04 in order, in place (outputs saved inside each notebook).
   Notebook 04 re-exports every JSON file in web/data.
2. Validates every exported JSON file against its contract (pipeline/validate_contract.py).
Stops at the first failing notebook and prints which cell failed.
"""
import sys
import time
from pathlib import Path

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

ROOT = Path(__file__).resolve().parent
NOTEBOOKS = ["01_scms_eda_cleaning.ipynb", "02_scoring_panel_2026.ipynb",
             "03_risk_models_xgb_iforest_nlp.ipynb", "04_mcdm_topsis_milp.ipynb"]


def run(name):
    path = ROOT / "notebooks" / name
    nb = nbformat.read(path, as_version=4)
    start = time.time()
    ExecutePreprocessor(timeout=1800, kernel_name="pharmashield").preprocess(nb, {"metadata": {"path": str(path.parent)}})
    nbformat.write(nb, path)
    print(f"ok   {name} ({time.time() - start:.0f} s)")


def main():
    for name in NOTEBOOKS:
        try:
            run(name)
        except Exception as exc:  # report the failing notebook clearly, then stop
            print(f"FAIL {name}: {str(exc)[:2000]}")
            return 1
    sys.path.insert(0, str(ROOT))
    from validate_contract import validate_all
    return 0 if validate_all() else 1


if __name__ == "__main__":
    sys.exit(main())
