"""
South Carolina 2026 Tax Changes calculation module.

This module provides utilities for calculating household and aggregate impacts
of the 2026 South Carolina tax changes enacted by H.4216 (Act 110), signed
March 30, 2026 and effective for tax years beginning after 2025. The bill
introduces new flat-ish brackets (1.99% on the first $30,000 of taxable
income, 5.21% above), replaces federal standard/itemized deductions with a
new SC Income Adjusted Deduction (SCIAD), and caps the state EITC at $200.

Note: PolicyEngine-US already ships the 2026 changes as the current-law
baseline (see PR #7917). The reform.json in this repo reverts those
parameters to their pre-2026 (2025) values. "Impact" is therefore defined
as ``current_law_outcome - reverted_outcome``.
"""

from .household import build_household_situation, calculate_household_impact
from .reforms import load_reform, REFORM_PATH
from .microsimulation import calculate_aggregate_impact

__all__ = [
    "build_household_situation",
    "calculate_household_impact",
    "load_reform",
    "REFORM_PATH",
    "calculate_aggregate_impact",
]

__version__ = "1.0.0"
