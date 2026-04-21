"""
Reform definitions for the 2026 South Carolina tax changes dashboard.

The 2026 South Carolina tax changes enacted by H.4216 (Act 110) — new
flat-ish brackets (1.99% on the first $30,000 of taxable income, 5.21%
above), a new SC Income Adjusted Deduction (SCIAD) replacing federal
standard/itemized deductions, and a $200 cap on the SC EITC — are
already merged into PolicyEngine-US's baseline parameters (PR #7917).
To measure their impact we therefore run an *inverse* reform that
restores the pre-2026 (2025) parameter values: 0%/3%/6% rate schedule
with bracket thresholds at $3,560 and $17,830, no SCIAD (federal-style
deductions), and an uncapped EITC at 125% of the federal credit.

The reform parameters live in ``reform.json`` at the repository root.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


# Path to the reform.json file at the repository root
REFORM_PATH = Path(__file__).resolve().parent.parent / "reform.json"


def load_reform() -> Dict[str, Any]:
    """Load the South Carolina 2026 inverse reform dictionary from ``reform.json``.

    The returned dictionary reverts the H.4216 (Act 110) rate schedule,
    SCIAD deduction, and EITC cap to their 2025 values. Pass the result
    to ``Reform.from_dict(load_reform(), country_id="us")`` to build a
    reform whose effect is the opposite sign of current law.

    Returns:
        A reform dictionary suitable for PolicyEngine's ``Reform.from_dict``.
    """
    with open(REFORM_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_reform_provisions() -> Dict[str, Dict[str, Any]]:
    """Return a description of the South Carolina 2026 tax change provisions.

    Useful for documentation and display in the dashboard. Values describe
    the *current-law* 2026 parameters (enacted by H.4216); the reverted-to
    pre-2026 values are encoded in reform.json.
    """
    return {
        "h4216_bracket0_rate": {
            "description": (
                "H.4216 replaces the 2025 0%/3%/6% rate schedule with a "
                "flat-ish structure: 1.99% on the first $30,000 of taxable "
                "income (pre-2026: 0% below $3,560)."
            ),
            "parameter": "gov.states.sc.tax.income.rates.brackets[0].rate",
            "pre_2026_value": 0.0,
            "current_law_value": 0.0199,
        },
        "h4216_bracket1_rate": {
            "description": (
                "Second bracket rate under H.4216 (pre-2026: 3% on income "
                "between $3,560 and $17,830)."
            ),
            "parameter": "gov.states.sc.tax.income.rates.brackets[1].rate",
            "pre_2026_value": 0.03,
        },
        "h4216_bracket2_rate": {
            "description": (
                "Top bracket rate under H.4216 is 5.21% on income above "
                "$30,000 (pre-2026: 6% on income above $17,830)."
            ),
            "parameter": "gov.states.sc.tax.income.rates.brackets[2].rate",
            "pre_2026_value": 0.06,
            "current_law_value": 0.0521,
        },
        "h4216_sciad_in_effect": {
            "description": (
                "H.4216 replaces federal standard/itemized deductions with "
                "a new South Carolina Income Adjusted Deduction (SCIAD). "
                "Pre-2026 South Carolina used the federal-style deduction."
            ),
            "parameter": "gov.states.sc.tax.income.deductions.sciad.in_effect",
            "pre_2026_value": False,
            "current_law_value": True,
        },
        "h4216_eitc_cap": {
            "description": (
                "H.4216 caps the South Carolina EITC at $200 per filer. "
                "Pre-2026 the state credit was 125% of the federal EITC "
                "with no dollar cap."
            ),
            "parameter": "gov.states.sc.tax.income.credits.eitc.max",
            "pre_2026_value": 999_999_999,
            "current_law_value": 200,
        },
    }
