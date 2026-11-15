"""Decision engine: AHP, entropy blending, TOPSIS and the MILP order split.

The same formulas are ported to TypeScript in web/lib/engine.ts. The parity tests in
web/tests compare both implementations on the exported inputs, so any change here must
be mirrored there.
"""
import numpy as np
import pandas as pd
import pulp

CRITERIA = ["C1", "C2", "C3", "C4", "C5"]
TIE_BREAK = 1e-3  # USD per vial per unit of (1 - S); changes cost by at most 10 USD a month
RANDOM_INDEX = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45}  # Saaty


def ahp(matrix):
    """Principal-eigenvector weights and consistency ratio of a pairwise comparison matrix."""
    a = np.asarray(matrix, dtype=float)
    n = a.shape[0]
    values, vectors = np.linalg.eig(a)
    k = int(np.argmax(values.real))
    w = np.abs(vectors[:, k].real)
    w = w / w.sum()
    lambda_max = float(values[k].real)
    ci = (lambda_max - n) / (n - 1)
    cr = ci / RANDOM_INDEX[n] if RANDOM_INDEX[n] > 0 else 0.0
    return w, lambda_max, ci, cr


def entropy_weights(columns):
    """Shannon entropy weights for a dict {criterion: 1-D array of non-negative values}.

    Guards: a column that is all zero, constant, or has fewer than 2 values gets a
    divergence of 0. If every divergence is 0 the function returns None and the caller
    falls back to the AHP weights.
    """
    divergence = {}
    for name, values in columns.items():
        x = np.asarray(values, dtype=float)
        x = x[~np.isnan(x)]
        if len(x) < 2 or x.sum() <= 0 or np.allclose(x, x[0]):
            divergence[name] = 0.0
            continue
        p = x / x.sum()
        nz = p[p > 0]
        e = -(nz * np.log(nz)).sum() / np.log(len(x))
        divergence[name] = max(0.0, 1.0 - e)
    total = sum(divergence.values())
    if total <= 0:
        return None, divergence
    return {k: v / total for k, v in divergence.items()}, divergence


def blend_weights(ahp_w, entropy_w, data_criteria, share=0.5):
    """Final weight = AHP outside the data-derived set; inside it,
    share x AHP + (1 - share) x (AHP mass of the set) x entropy weight.
    The result always sums to 1."""
    w = dict(ahp_w)
    if entropy_w is None:
        return w
    mass = sum(ahp_w[c] for c in data_criteria)
    for c in data_criteria:
        w[c] = share * ahp_w[c] + (1 - share) * mass * entropy_w[c]
    return w


def topsis(matrix, weights):
    """Closeness S for a matrix of lower-is-better criteria. Column norm 0 gives r = 0."""
    x = np.asarray(matrix, dtype=float)
    norm = np.sqrt((x ** 2).sum(axis=0))
    r = np.divide(x, norm, out=np.zeros_like(x), where=norm > 0)
    v = r * np.asarray(weights, dtype=float)
    best = v.min(axis=0)
    worst = v.max(axis=0)
    d_plus = np.sqrt(((v - best) ** 2).sum(axis=1))
    d_minus = np.sqrt(((v - worst) ** 2).sum(axis=1))
    return d_minus / (d_plus + d_minus + 1e-12)


def risk_closeness(matrix_c2_c5, final_weights):
    """S_risk: TOPSIS closeness on C2-C5 only, with the mode's final weights renormalised.
    Used in the MILP objective so that cost (C1) is not counted twice (it is already the
    landed-cost term of the objective)."""
    w = np.array([final_weights[c] for c in ["C2", "C3", "C4", "C5"]], dtype=float)
    return topsis(matrix_c2_c5, w / w.sum())


def allocate_milp(df, demand, lam=1.0, compliance_gate=True, **kwargs):
    """MILP order split with the compliance gate (assumption A34).

    df columns: landed_cost, S (use S_risk), is_probation, trial_gate_pass, capacity, gated (bool).
    A gated established maker (C4 above the threshold) cannot be primary or backup. If the gated
    solution needs a spot buy (no feasible alternative), the MILP is re-solved without the gate
    and the gated makers that receive volume are reported in summary["gate_relaxed"].
    """
    blocked = []
    if compliance_gate and "gated" in df.columns:
        blocked = [m for m in df.index if bool(df.loc[m, "gated"]) and not bool(df.loc[m, "is_probation"])]
    alloc, summary = _solve_milp(df, demand, lam, blocked=blocked, **kwargs)
    summary["gated_blocked"] = blocked
    summary["gate_relaxed"] = []
    if blocked and (summary["status"] != "Optimal" or summary["spot_buy_vials"] > 0):
        alloc, summary = _solve_milp(df, demand, lam, blocked=[], **kwargs)
        summary["gated_blocked"] = []
        summary["gate_relaxed"] = [m for m in blocked if alloc.loc[m, "vials"] > 0]
    return alloc, summary


def _solve_milp(df, demand, lam=1.0, blocked=(), primary_cap=0.70, trial_min=0.05, trial_max=0.15, trial_max_relaxed=0.30,
                backup_min=0.10, max_probation=2, min_established=2, big_m=1e6):
    """Mixed-integer order split (PuLP + CBC).

    df columns: landed_cost, S, is_probation, trial_gate_pass, capacity (index = maker id).
    blocked: established makers that may not be selected (compliance gate).
    Returns (allocation DataFrame, summary dict).
    """
    makers = list(df.index)
    mean_cost = float(df["landed_cost"].mean())
    # TIE_BREAK: makers with identical (imputed) prices would tie at lambda 0; a negligible term on (1 - S)
    # makes every solver pick the higher-ranked maker, so Python (CBC) and TypeScript give the same split.
    unit_cost = {m: float(df.loc[m, "landed_cost"]) + lam * mean_cost * (1.0 - float(df.loc[m, "S"]))
                 + TIE_BREAK * (1.0 - float(df.loc[m, "S"])) for m in makers}
    est = [m for m in makers if not bool(df.loc[m, "is_probation"])]
    prob = [m for m in makers if bool(df.loc[m, "is_probation"])]
    eligible_prob = [m for m in prob if bool(df.loc[m, "trial_gate_pass"])]
    trial_cap = trial_max if len(est) >= 2 else trial_max_relaxed

    model = pulp.LpProblem("carboplatin_order_split_MILP", pulp.LpMinimize)
    x = {m: pulp.LpVariable(f"x_{m}", lowBound=0) for m in makers}
    y = {m: pulp.LpVariable(f"y_{m}", cat="Binary") for m in makers}
    u = pulp.LpVariable("spot_buy", lowBound=0)
    model += pulp.lpSum(unit_cost[m] * x[m] for m in makers) + big_m * u
    model += pulp.lpSum(x.values()) + u == demand, "demand"
    for m in makers:
        model += x[m] <= float(df.loc[m, "capacity"]) * y[m], f"capacity_{m}"
    for m in est:
        model += x[m] <= primary_cap * demand * y[m], f"concentration_cap_{m}"
        model += x[m] >= backup_min * demand * y[m], f"warm_backup_min_{m}"
        if m in blocked:
            model += y[m] == 0, f"compliance_gate_{m}"
    for m in prob:
        if m in eligible_prob:
            model += x[m] >= trial_min * demand * y[m], f"trial_min_{m}"
            model += x[m] <= trial_cap * demand * y[m], f"trial_max_{m}"
        else:
            model += y[m] == 0, f"trial_gate_{m}"
    model += pulp.lpSum(y[m] for m in prob) <= max_probation, "max_probation"
    if eligible_prob:
        model += pulp.lpSum(y[m] for m in eligible_prob) >= 1, "one_trial_per_order"
    model += pulp.lpSum(y[m] for m in est) >= min(min_established, len(est)), "dual_source"
    model.solve(pulp.PULP_CBC_CMD(msg=False))
    status = pulp.LpStatus[model.status]

    alloc = pd.DataFrame({"vials": {m: round(x[m].value() or 0.0, 6) for m in makers},
                          "selected": {m: int(round(y[m].value() or 0)) for m in makers},
                          "unit_objective_cost": unit_cost})
    alloc["vials"] = alloc["vials"].round().astype(int)
    alloc["share"] = alloc["vials"] / demand
    alloc["role"] = "not selected"
    chosen_est = alloc.loc[est].query("vials > 0").sort_values("vials", ascending=False)
    if len(chosen_est):
        alloc.loc[chosen_est.index[0], "role"] = "primary"
        alloc.loc[chosen_est.index[1:], "role"] = "backup"
    alloc.loc[[m for m in prob if alloc.loc[m, "vials"] > 0], "role"] = "probation trial"
    spot = int(round(u.value() or 0.0))
    summary = {"status": status, "objective": float(pulp.value(model.objective)), "spot_buy_vials": spot,
               "purchase_cost_usd": float((alloc["vials"] * df["landed_cost"]).sum()), "lambda": lam, "mean_cost": mean_cost,
               "trial_cap_share": trial_cap}
    return alloc, summary
