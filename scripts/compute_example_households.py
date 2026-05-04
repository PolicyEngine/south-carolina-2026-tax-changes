"""Pre-compute a handful of representative South Carolina households so
the household tab can show example impacts without hitting the PE API
on page load.

Hits https://api.policyengine.org/us/calculate twice per profile —
once with no override (gives current 2026 SC law), once with the SC
2026 revert reform applied (gives pre-2026 law) — and writes the diff
into ``frontend/public/data/example_households.json``.

Sign convention matches the dashboard:

    impact = current law (baseline) - pre-2026 (reform)

so positive numbers mean the household gains under the 2026 changes.

The example profiles are picked to surface different provisions:

  - Single parent, $35k, 2 kids ages 4 and 7: EITC range, sees the
    rate-table and EITC-cap effects.
  - Married couple, $80k, 1 kid: middle of the rate-bracket changes,
    no itemization.
  - Married couple, $200k, 2 kids, itemizer ($12k property tax /
    $20k mortgage interest / $5k charitable): high earner whose
    itemization triggers SCAID interaction.

Usage:
    uv run --with requests scripts/compute_example_households.py
"""

import json
from pathlib import Path

import requests

PE_API = "https://api.policyengine.org/us/calculate"
YEAR = 2026
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "frontend" / "public" / "data" / "example_households.json"

PROFILES = [
    {
        "label": "Single parent, $35k, 2 kids (EITC range)",
        "income": 35_000,
        "age_head": 30,
        "married": False,
        "dependents": [4, 7],
    },
    {
        "label": "Married couple, $80k, 1 kid",
        "income": 80_000,
        "age_head": 36,
        "married": True,
        "dependents": [9],
    },
    {
        "label": "Married couple, $200k, 2 kids, itemizer",
        "income": 200_000,
        "age_head": 45,
        "married": True,
        "dependents": [11, 14],
        "real_estate_taxes": 12_000,
        "home_mortgage_interest": 20_000,
        "charitable_cash_donations": 5_000,
    },
]


def reform_policy() -> dict:
    """Revert SC's 2026 tax parameters to 2025 values."""
    period = "2026-01-01.2100-12-31"
    return {
        "gov.states.sc.tax.income.rates[0].rate": {period: 0},
        "gov.states.sc.tax.income.rates[1].threshold": {period: 3_560},
        "gov.states.sc.tax.income.rates[1].rate": {period: 0.03},
        "gov.states.sc.tax.income.rates[2].threshold": {period: 17_830},
        "gov.states.sc.tax.income.rates[2].rate": {period: 0.06},
        "gov.states.sc.tax.income.deductions.sciad.in_effect": {period: False},
        "gov.states.sc.tax.income.credits.eitc.max": {period: 999_999_999},
    }


def build_household(profile: dict, with_axes: bool = False) -> dict:
    """Build a PolicyEngine household situation for the given profile.

    If ``with_axes`` is True, sweeps employment_income from $0 to a
    profile-derived max so we can pre-compute the full net-income chart.

    The SC household builder accepts itemization-related fields
    (real_estate_taxes, home_mortgage_interest, charitable_cash_donations) on
    the tax unit so the high-income example can trigger SCAID
    interaction.
    """
    year = str(YEAR)
    income_for_baseline = None if with_axes else profile["income"]
    you_attrs: dict = {
        "age": {year: profile["age_head"]},
        "employment_income": {year: income_for_baseline},
    }
    # Itemization-relevant variables live on the person, not the tax unit.
    for var in ("real_estate_taxes", "home_mortgage_interest", "charitable_cash_donations"):
        if var in profile:
            you_attrs[var] = {year: profile[var]}
    people: dict = {"you": you_attrs}
    members = ["you"]
    marital_units: dict = {"your marital unit": {"members": ["you"]}}

    if profile["married"]:
        people["your partner"] = {"age": {year: 35}}
        members.append("your partner")
        marital_units["your marital unit"]["members"].append("your partner")

    for i, age in enumerate(profile["dependents"]):
        cid = (
            "your first dependent"
            if i == 0
            else "your second dependent"
            if i == 1
            else f"dependent_{i + 1}"
        )
        people[cid] = {"age": {year: age}}
        members.append(cid)
        marital_units[f"{cid}'s marital unit"] = {"members": [cid]}

    tax_unit: dict = {
        "members": members,
        "adjusted_gross_income": {year: None},
        "income_tax": {year: None},
        "sc_income_tax": {year: None},
    }

    situation: dict = {
        "people": people,
        "families": {"your family": {"members": members}},
        "marital_units": marital_units,
        "spm_units": {"your household": {"members": members}},
        "tax_units": {"your tax unit": tax_unit},
        "households": {
            "your household": {
                "members": members,
                "state_code": {year: "SC"},
                "household_net_income": {year: None},
            }
        },
    }

    if with_axes:
        axis_max = max(profile["income"] * 2, 100_000)
        situation["axes"] = [
            [
                {
                    "name": "employment_income",
                    "min": 0,
                    "max": axis_max,
                    "count": 201,
                    "period": year,
                    "target": "person",
                }
            ]
        ]
    return situation


def calc(situation: dict, policy: dict | None) -> dict:
    body: dict = {"household": situation}
    if policy:
        body["policy"] = policy
    response = requests.post(
        PE_API, json=body, headers={"Content-Type": "application/json"}, timeout=180
    )
    if not response.ok:
        raise RuntimeError(f"{response.status_code}: {response.text[:500]}")
    return response.json()["result"]


def extract(result: dict) -> dict:
    yr = str(YEAR)
    hh = result["households"]["your household"]
    tu = result["tax_units"]["your tax unit"]
    return {
        "household_net_income": hh["household_net_income"][yr],
        "sc_income_tax": tu["sc_income_tax"][yr],
        "income_tax": tu["income_tax"][yr],
    }


def compute_profile(profile: dict) -> dict:
    """Run baseline (current 2026 law) + reform (revert to 2025) at the
    user's income point and as an income sweep, so the page can render
    the full net-income chart instantly."""
    yr = str(YEAR)

    # Point estimate.
    point_situation = build_household(profile, with_axes=False)
    baseline_pt = extract(calc(point_situation, None))
    reform_pt = extract(calc(point_situation, reform_policy()))

    # Income sweep for the chart.
    sweep_situation = build_household(profile, with_axes=True)
    base_sweep = calc(sweep_situation, None)
    ref_sweep = calc(sweep_situation, reform_policy())

    income_range = base_sweep["people"]["you"]["employment_income"][yr]
    base_net = base_sweep["households"]["your household"]["household_net_income"][yr]
    ref_net = ref_sweep["households"]["your household"]["household_net_income"][yr]
    base_state = base_sweep["tax_units"]["your tax unit"]["sc_income_tax"][yr]
    ref_state = ref_sweep["tax_units"]["your tax unit"]["sc_income_tax"][yr]
    base_fed = base_sweep["tax_units"]["your tax unit"]["income_tax"][yr]
    ref_fed = ref_sweep["tax_units"]["your tax unit"]["income_tax"][yr]

    # Impact = current law (baseline) - pre-2026 (reform), so positive
    # means the household gains under the 2026 changes.
    net_income_change = [b - r for b, r in zip(base_net, ref_net)]
    state_tax_change = [b - r for b, r in zip(base_state, ref_state)]
    federal_tax_change = [b - r for b, r in zip(base_fed, ref_fed)]

    return {
        **profile,
        "baseline": baseline_pt,
        "reform": reform_pt,
        "net_income_change": baseline_pt["household_net_income"]
        - reform_pt["household_net_income"],
        "sc_tax_change": baseline_pt["sc_income_tax"]
        - reform_pt["sc_income_tax"],
        "chart": {
            "income_range": income_range,
            "net_income_change": net_income_change,
            "state_tax_change": state_tax_change,
            "federal_tax_change": federal_tax_change,
        },
    }


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for profile in PROFILES:
        print(f"  Computing: {profile['label']}...")
        rows.append(compute_profile(profile))

    with OUTPUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump({"year": YEAR, "households": rows}, fh, indent=2)
    print(f"Saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
