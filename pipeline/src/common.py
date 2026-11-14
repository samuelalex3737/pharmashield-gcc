"""Shared paths, plotting style and small helpers for notebooks 01 to 04."""
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW = PROJECT_ROOT / "data" / "raw"
PROCESSED = PROJECT_ROOT / "data" / "processed"
FIGURES = PROJECT_ROOT / "figures"
OUTPUTS = PROJECT_ROOT / "outputs"
REFERENCE = PROJECT_ROOT / "pipeline" / "reference"
WEB_DATA = PROJECT_ROOT / "web" / "data"
RANDOM_STATE = 42

for folder in (PROCESSED, FIGURES, OUTPUTS, WEB_DATA):
    folder.mkdir(parents=True, exist_ok=True)

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 40)
pd.set_option("display.max_rows", 80)
pd.set_option("display.max_colwidth", 200)

PALETTE = ["#1f4e79", "#c0504d", "#4f8f4f", "#8064a2", "#f39c12", "#2c7a7b", "#7f7f7f"]


def style():
    plt.rcParams.update({
        "figure.dpi": 110,
        "savefig.dpi": 160,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.titleweight": "bold",
        "axes.titlesize": 12,
        "axes.labelsize": 10,
        "font.family": "DejaVu Sans",
    })


def save_fig(fig, name, source):
    """Add a source note under the plot and save it to figures/fig_NN_name.png."""
    fig.text(0.01, 0.005, f"Source: {source}", fontsize=7.5, color="#555555", ha="left", va="bottom")
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    path = FIGURES / f"{name}.png"
    fig.savefig(path, bbox_inches="tight")
    print(f"Saved {path.relative_to(PROJECT_ROOT)}")
    return path


def shape(label, df):
    print(f"{label}: {df.shape[0]:,} rows x {df.shape[1]} columns")
