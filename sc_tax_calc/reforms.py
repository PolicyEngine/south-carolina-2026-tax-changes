"""Reform definitions for the South Carolina 2026 tax changes dashboard.

PolicyEngine-US current law already includes H.4216 (Act 110). To
isolate the package, this module applies an inverse reform that
restores the pre-2026 (2025) parameters via
:func:`create_sc_reverted_reform`. Use the builder rather than
``Reform.from_dict`` because the JSON paths use bracket-index segments.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


# Path to the canonical inverse-reform JSON at the repository root.
REFORM_PATH = Path(__file__).resolve().parent.parent / "reform_revert.json"


def load_reform() -> Dict[str, Any]:
    """Load the SC inverse reform dictionary from ``reform_revert.json``.

    The returned dictionary reverts the H.4216 (Act 110) parameters to
    their 2025 values. Use :func:`create_sc_reverted_reform` to build
    the PolicyEngine reform class — the JSON paths use bracket-index
    segments.

    Returns:
        A dictionary of parameter overrides.
    """
    with open(REFORM_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


def create_sc_reverted_reform():
    """Build a PolicyEngine Reform that restores pre-H.4216 SC parameters."""
    import re

    from policyengine_core.periods import instant
    from policyengine_core.reforms import Reform

    overrides = load_reform()

    def modify(parameters):
        for path, periods in overrides.items():
            node = parameters
            for segment in path.split("."):
                match = re.match(r"(\w+)\[(\d+)\]", segment)
                if match:
                    node = getattr(node, match.group(1))[int(match.group(2))]
                else:
                    node = getattr(node, segment)
            for period_str, value in periods.items():
                if "." in period_str and len(period_str) > 10:
                    start_str, stop_str = period_str.split(".")
                else:
                    start_str = (
                        period_str if "-" in period_str else f"{period_str}-01-01"
                    )
                    stop_str = "2100-12-31"
                node.update(
                    start=instant(start_str),
                    stop=instant(stop_str),
                    value=value,
                )
        return parameters

    class SCRevertedRatesReform(Reform):
        def apply(self):
            self.modify_parameters(modify)

    return SCRevertedRatesReform


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
