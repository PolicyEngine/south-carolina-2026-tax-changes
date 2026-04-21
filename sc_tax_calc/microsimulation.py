"""Aggregate impact calculations for the 2026 South Carolina tax changes.

Uses the South Carolina state-level microsimulation dataset
(``hf://policyengine/policyengine-us-data/states/SC.h5``) to calculate
the impact of H.4216 (Act 110): new flat-ish brackets (1.99% / 5.21%),
the new SC Income Adjusted Deduction (SCIAD), and the $200 cap on the
SC EITC.

Because PolicyEngine-US already encodes the 2026 changes in the baseline
(PR #7917), the reform in ``reform.json`` reverts those parameters to
their pre-2026 (2025) values. The impact is therefore defined as::

    impact = current_law_outcome - reverted_outcome

The flipped sign (relative to a conventional reform-vs-baseline diff) is
deliberate — it lets the dashboard show the benefit or cost of the
policy as currently enacted.

Pulls ``sc_income_tax``, ``income_tax`` (federal), and
``household_net_income``; all distributional analysis (winners/losers,
deciles, intra-decile) runs off ``household_net_income``.
"""

import numpy as np
from policyengine_us import Microsimulation
from policyengine_core.reforms import Reform

from .reforms import load_reform


# South Carolina state-level dataset on HuggingFace
SC_DATASET = "hf://policyengine/policyengine-us-data/states/SC.h5"

# Intra-decile bounds and labels (same as app-v2)
_INTRA_BOUNDS = [-np.inf, -0.05, -1e-3, 1e-3, 0.05, np.inf]
_INTRA_LABELS = [
    "Lose more than 5%",
    "Lose less than 5%",
    "No change",
    "Gain less than 5%",
    "Gain more than 5%",
]


def create_sc_reverted_reform() -> Reform:
    """Build the inverse reform that reverts SC parameters to pre-2026 values."""
    return Reform.from_dict(load_reform(), country_id="us")


def _poverty_metrics(baseline_rate: float, reform_rate: float):
    """Return rate change and percent change for a poverty metric.

    ``baseline_rate`` is the current-law rate; ``reform_rate`` is the
    rate under the reverted parameters. The returned change is
    current_law - reverted, matching the impact sign convention.
    """
    rate_change = baseline_rate - reform_rate
    percent_change = (
        rate_change / reform_rate * 100 if reform_rate > 0 else 0.0
    )
    return rate_change, percent_change


def calculate_aggregate_impact(year: int = 2026) -> dict:
    """Calculate the South Carolina-wide aggregate impact of the 2026 tax changes.

    Args:
        year: Tax year (default 2026). Only 2026 is meaningful; prior
            years are before the reform took effect.

    Returns:
        Dictionary with budget, decile, intra_decile, poverty, and
        income-bracket fields. All money amounts are current_law minus
        reverted (positive = gain for households, negative = cost to
        government). State-revenue impact typically reflects the net of
        the rate cut, the new SCIAD deduction, and the EITC cap.
    """
    reform = create_sc_reverted_reform()

    # Both sims use the South Carolina state dataset so aggregates
    # reflect South Carolina only.
    sim_baseline = Microsimulation(dataset=SC_DATASET)
    sim_reform = Microsimulation(dataset=SC_DATASET, reform=reform)

    # ===== FISCAL IMPACT =====
    # South Carolina state income tax
    sc_baseline = sim_baseline.calculate(
        "sc_income_tax", period=year, map_to="household"
    )
    sc_reform = sim_reform.calculate(
        "sc_income_tax", period=year, map_to="household"
    )
    # baseline - reform: under current law, the state collects a
    # different amount of tax; sign depends on the net of the rate cut,
    # SCIAD, and the EITC cap.
    state_tax_revenue_impact = float((sc_baseline - sc_reform).sum())

    # Federal income tax
    fed_baseline = sim_baseline.calculate(
        "income_tax", period=year, map_to="household"
    )
    fed_reform = sim_reform.calculate(
        "income_tax", period=year, map_to="household"
    )
    federal_tax_revenue_impact = float((fed_baseline - fed_reform).sum())

    tax_revenue_impact = federal_tax_revenue_impact + state_tax_revenue_impact
    budgetary_impact = tax_revenue_impact  # no benefit spending

    # household_net_income change for all distributional analysis
    baseline_net_income = sim_baseline.calculate(
        "household_net_income", period=year, map_to="household"
    )
    reform_net_income = sim_reform.calculate(
        "household_net_income", period=year, map_to="household"
    )
    # Positive => household gains under current law vs pre-2026 policy.
    income_change = baseline_net_income - reform_net_income

    total_households = float((income_change * 0 + 1).sum())

    # ===== WINNERS / LOSERS =====
    winners = float((income_change > 1).sum())
    losers = float((income_change < -1).sum())
    beneficiaries = float((income_change > 0).sum())

    affected = abs(income_change) > 1
    affected_count = float(affected.sum())
    avg_benefit = (
        float(income_change[affected].sum() / affected.sum())
        if affected_count > 0
        else 0.0
    )

    winners_rate = winners / total_households * 100 if total_households else 0.0
    losers_rate = losers / total_households * 100 if total_households else 0.0

    # ===== INCOME DECILE ANALYSIS =====
    decile = sim_baseline.calculate(
        "household_income_decile", period=year, map_to="household"
    )

    decile_average = {}
    decile_relative = {}
    for d in range(1, 11):
        dmask = decile == d
        d_count = float(dmask.sum())
        if d_count > 0:
            d_baseline_sum = float(baseline_net_income[dmask].sum())
            d_change_sum = float(income_change[dmask].sum())
            decile_average[str(d)] = d_change_sum / d_count
            decile_relative[str(d)] = (
                d_change_sum / d_baseline_sum
                if d_baseline_sum != 0
                else 0.0
            )
        else:
            decile_average[str(d)] = 0.0
            decile_relative[str(d)] = 0.0

    # Intra-decile requires person-weighted proportions — drop to numpy.
    household_weight = sim_reform.calculate(
        "household_weight", period=year
    )
    people_per_hh = sim_baseline.calculate(
        "household_count_people", period=year, map_to="household"
    )
    capped_baseline = np.maximum(np.array(reform_net_income), 1)
    rel_change_arr = np.array(income_change) / capped_baseline

    decile_arr = np.array(decile)
    weight_arr = np.array(household_weight)
    people_weighted = np.array(people_per_hh) * weight_arr

    intra_decile_deciles = {label: [] for label in _INTRA_LABELS}
    for d in range(1, 11):
        dmask = decile_arr == d
        d_people = people_weighted[dmask]
        d_total_people = d_people.sum()
        d_rel = rel_change_arr[dmask]

        for lower, upper, label in zip(
            _INTRA_BOUNDS[:-1], _INTRA_BOUNDS[1:], _INTRA_LABELS
        ):
            in_group = (d_rel > lower) & (d_rel <= upper)
            proportion = (
                float(d_people[in_group].sum() / d_total_people)
                if d_total_people > 0
                else 0.0
            )
            intra_decile_deciles[label].append(proportion)

    intra_decile_all = {
        label: sum(intra_decile_deciles[label]) / 10
        for label in _INTRA_LABELS
    }

    # ===== POVERTY IMPACT =====
    pov_bl = sim_baseline.calculate(
        "in_poverty", period=year, map_to="person"
    )
    pov_rf = sim_reform.calculate(
        "in_poverty", period=year, map_to="person"
    )
    poverty_baseline_rate = float(pov_bl.mean() * 100)
    poverty_reform_rate = float(pov_rf.mean() * 100)
    poverty_rate_change, poverty_percent_change = _poverty_metrics(
        poverty_baseline_rate, poverty_reform_rate
    )

    # Child / deep poverty need age filtering — numpy required.
    age_arr = np.array(sim_baseline.calculate("age", period=year))
    is_child = age_arr < 18
    pw_arr = np.array(sim_baseline.calculate("person_weight", period=year))
    child_w = pw_arr[is_child]
    total_child_w = child_w.sum()

    pov_bl_arr = np.array(pov_bl).astype(bool)
    pov_rf_arr = np.array(pov_rf).astype(bool)

    def _child_rate(arr):
        return float(
            (arr[is_child] * child_w).sum() / total_child_w * 100
        ) if total_child_w > 0 else 0.0

    child_poverty_baseline_rate = _child_rate(pov_bl_arr)
    child_poverty_reform_rate = _child_rate(pov_rf_arr)
    child_poverty_rate_change, child_poverty_percent_change = (
        _poverty_metrics(
            child_poverty_baseline_rate, child_poverty_reform_rate
        )
    )

    deep_bl = sim_baseline.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )
    deep_rf = sim_reform.calculate(
        "in_deep_poverty", period=year, map_to="person"
    )
    deep_poverty_baseline_rate = float(deep_bl.mean() * 100)
    deep_poverty_reform_rate = float(deep_rf.mean() * 100)
    deep_poverty_rate_change, deep_poverty_percent_change = (
        _poverty_metrics(
            deep_poverty_baseline_rate, deep_poverty_reform_rate
        )
    )

    deep_bl_arr = np.array(deep_bl).astype(bool)
    deep_rf_arr = np.array(deep_rf).astype(bool)
    deep_child_poverty_baseline_rate = _child_rate(deep_bl_arr)
    deep_child_poverty_reform_rate = _child_rate(deep_rf_arr)
    deep_child_poverty_rate_change, deep_child_poverty_percent_change = (
        _poverty_metrics(
            deep_child_poverty_baseline_rate,
            deep_child_poverty_reform_rate,
        )
    )

    # ===== INCOME BRACKET BREAKDOWN =====
    agi = sim_baseline.calculate(
        "adjusted_gross_income", period=year, map_to="household"
    )
    agi_arr = np.array(agi)
    change_arr = np.array(income_change)
    affected_mask = np.abs(change_arr) > 1

    income_brackets = [
        (0, 25_000, "$0 - $25k"),
        (25_000, 50_000, "$25k - $50k"),
        (50_000, 75_000, "$50k - $75k"),
        (75_000, 100_000, "$75k - $100k"),
        (100_000, 150_000, "$100k - $150k"),
        (150_000, 200_000, "$150k - $200k"),
        (200_000, float("inf"), "$200k+"),
    ]

    by_income_bracket = []
    for min_inc, max_inc, label in income_brackets:
        mask = (
            (agi_arr >= min_inc)
            & (agi_arr < max_inc)
            & affected_mask
        )
        bracket_affected = float(weight_arr[mask].sum())
        if bracket_affected > 0:
            bracket_cost = float(
                (change_arr[mask] * weight_arr[mask]).sum()
            )
            bracket_avg = float(
                np.average(change_arr[mask], weights=weight_arr[mask])
            )
        else:
            bracket_cost = 0.0
            bracket_avg = 0.0
        by_income_bracket.append({
            "bracket": label,
            "beneficiaries": bracket_affected,
            "total_cost": bracket_cost,
            "avg_benefit": bracket_avg,
        })

    return {
        "budget": {
            "budgetary_impact": budgetary_impact,
            "federal_tax_revenue_impact": federal_tax_revenue_impact,
            "state_tax_revenue_impact": state_tax_revenue_impact,
            "tax_revenue_impact": tax_revenue_impact,
            "households": total_households,
        },
        "decile": {
            "average": decile_average,
            "relative": decile_relative,
        },
        "intra_decile": {
            "all": intra_decile_all,
            "deciles": intra_decile_deciles,
        },
        "total_cost": -budgetary_impact,
        "beneficiaries": beneficiaries,
        "avg_benefit": avg_benefit,
        "winners": winners,
        "losers": losers,
        "winners_rate": winners_rate,
        "losers_rate": losers_rate,
        "poverty_baseline_rate": poverty_baseline_rate,
        "poverty_reform_rate": poverty_reform_rate,
        "poverty_rate_change": poverty_rate_change,
        "poverty_percent_change": poverty_percent_change,
        "child_poverty_baseline_rate": child_poverty_baseline_rate,
        "child_poverty_reform_rate": child_poverty_reform_rate,
        "child_poverty_rate_change": child_poverty_rate_change,
        "child_poverty_percent_change": child_poverty_percent_change,
        "deep_poverty_baseline_rate": deep_poverty_baseline_rate,
        "deep_poverty_reform_rate": deep_poverty_reform_rate,
        "deep_poverty_rate_change": deep_poverty_rate_change,
        "deep_poverty_percent_change": deep_poverty_percent_change,
        "deep_child_poverty_baseline_rate": deep_child_poverty_baseline_rate,
        "deep_child_poverty_reform_rate": deep_child_poverty_reform_rate,
        "deep_child_poverty_rate_change": deep_child_poverty_rate_change,
        "deep_child_poverty_percent_change": deep_child_poverty_percent_change,
        "by_income_bracket": by_income_bracket,
    }
