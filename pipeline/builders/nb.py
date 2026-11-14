"""Small helper that writes a notebook from a list of cells and executes it.

The notebooks in pipeline/notebooks are the deliverables. These builder scripts keep
their source under version control in plain Python so that the markdown and code can
be reviewed in one diff. Run a builder, then open the executed notebook.
"""
from pathlib import Path
import sys

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

PROJECT_ROOT = Path(__file__).resolve().parents[2]
NOTEBOOK_DIR = PROJECT_ROOT / "pipeline" / "notebooks"


def md(text):
    return ("md", text.strip("\n"))


def code(text):
    return ("code", text.strip("\n"))


def build(filename, cells, execute=True, timeout=1800):
    nb = nbformat.v4.new_notebook()
    nb.metadata["kernelspec"] = {"name": "pharmashield", "display_name": "PharmaShield (3.11)", "language": "python"}
    nb.metadata["language_info"] = {"name": "python"}
    for kind, text in cells:
        if kind == "md":
            nb.cells.append(nbformat.v4.new_markdown_cell(text))
        else:
            nb.cells.append(nbformat.v4.new_code_cell(text))
    path = NOTEBOOK_DIR / filename
    if execute:
        client = ExecutePreprocessor(timeout=timeout, kernel_name="pharmashield")
        try:
            client.preprocess(nb, {"metadata": {"path": str(NOTEBOOK_DIR)}})
        except Exception:
            nbformat.write(nb, path.with_suffix(".failed.ipynb"))
            raise
    nbformat.write(nb, path)
    return path


def dump_outputs(path, max_chars=1500):
    """Print every code cell's text output, used to read results while writing interpretations."""
    nb = nbformat.read(path, as_version=4)
    for i, cell in enumerate(nb.cells):
        if cell.cell_type != "code":
            continue
        texts = []
        for out in cell.get("outputs", []):
            if out.get("output_type") == "stream":
                texts.append(out.get("text", ""))
            elif "data" in out and "text/plain" in out["data"]:
                texts.append(out["data"]["text/plain"])
        joined = "".join(texts).strip()
        if joined:
            print(f"--- cell {i}")
            print(joined[:max_chars])


if __name__ == "__main__":
    dump_outputs(Path(sys.argv[1]))
