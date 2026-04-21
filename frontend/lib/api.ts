/**
 * Household impact via the PolicyEngine API.
 *
 * Calls https://api.policyengine.org/us/calculate directly -
 * no backend server required.
 *
 * For the South Carolina 2026 Tax Changes dashboard, the "reform" reverts South Carolina
 * parameters to their pre-2026 values while the PolicyEngine baseline
 * represents current (2026) law. The displayed impact therefore equals:
 *
 *   impact = baseline (current 2026 law) - reform (pre-2026 law)
 *
 * which is FLIPPED relative to a conventional reform where the baseline is
 * current law and the reform represents a proposed change.
 */

import {
  HouseholdRequest,
  HouseholdImpactResponse,
} from "./types";
import {
  buildHouseholdSituation,
  buildReformPolicy,
  interpolate,
} from "./household";

const PE_API_URL = "https://api.policyengine.org";

class ApiError extends Error {
  status: number;
  response: unknown;
  constructor(message: string, status: number, response?: unknown) {
    super(message);
    this.status = status;
    this.response = response;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 120000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

interface PEApiResponse {
  result: {
    households: Record<string, Record<string, Record<string, number[]>>>;
    people: Record<string, Record<string, Record<string, number[]>>>;
    tax_units: Record<string, Record<string, Record<string, number[]>>>;
  };
}

async function peCalculate(body: Record<string, unknown>): Promise<PEApiResponse> {
  const response = await fetchWithTimeout(
    `${PE_API_URL}/us/calculate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    const errorMessage = typeof errorBody === 'object' && errorBody?.message
      ? errorBody.message
      : typeof errorBody === 'string'
        ? errorBody
        : JSON.stringify(errorBody);
    throw new ApiError(
      `PolicyEngine API error: ${response.status} - ${errorMessage}`,
      response.status,
      errorBody
    );
  }
  return response.json();
}

export const api = {
  async calculateHouseholdImpact(
    request: HouseholdRequest
  ): Promise<HouseholdImpactResponse> {
    const household = buildHouseholdSituation(request);
    const policy = buildReformPolicy();
    const yearStr = String(request.year);

    // Run baseline (current 2026 law) and reform (pre-2026 law) in parallel.
    const [baselineResult, reformResult] = await Promise.all([
      peCalculate({ household }),
      peCalculate({ household, policy }),
    ]);

    // Extract arrays from PE API response.
    const baselineNetIncome: number[] =
      baselineResult.result.households["your household"][
        "household_net_income"
      ][yearStr];
    const reformNetIncome: number[] =
      reformResult.result.households["your household"][
        "household_net_income"
      ][yearStr];
    const incomeRange: number[] =
      baselineResult.result.people["you"][
        "employment_income"
      ][yearStr];

    // Extract South Carolina state income tax arrays.
    const baselineStateTax: number[] =
      baselineResult.result.tax_units["your tax unit"]["sc_income_tax"][
        yearStr
      ];
    const reformStateTax: number[] =
      reformResult.result.tax_units["your tax unit"]["sc_income_tax"][
        yearStr
      ];

    // Extract federal income tax arrays.
    const baselineFederalTax: number[] =
      baselineResult.result.tax_units["your tax unit"]["income_tax"][yearStr];
    const reformFederalTax: number[] =
      reformResult.result.tax_units["your tax unit"]["income_tax"][yearStr];

    // Impact = baseline (current 2026 law) - reform (pre-2026 law).
    // FLIPPED relative to a conventional reform where baseline is current law.
    const netIncomeChange = baselineNetIncome.map(
      (val, i) => val - reformNetIncome[i]
    );
    const federalTaxChange = baselineFederalTax.map(
      (val, i) => val - reformFederalTax[i]
    );
    const stateTaxChange = baselineStateTax.map(
      (val, i) => val - reformStateTax[i]
    );

    // Interpolate at the user's income for scalar metric cards.
    const baselineAtIncome = interpolate(
      incomeRange,
      baselineNetIncome,
      request.income
    );
    const reformAtIncome = interpolate(
      incomeRange,
      reformNetIncome,
      request.income
    );
    const baselineFederalTaxAtIncome = interpolate(
      incomeRange,
      baselineFederalTax,
      request.income
    );
    const reformFederalTaxAtIncome = interpolate(
      incomeRange,
      reformFederalTax,
      request.income
    );
    const baselineStateTaxAtIncome = interpolate(
      incomeRange,
      baselineStateTax,
      request.income
    );
    const reformStateTaxAtIncome = interpolate(
      incomeRange,
      reformStateTax,
      request.income
    );

    // Scalar differences at the user's income, sign-flipped so positive
    // numbers mean the household pays less / nets more under current law.
    const federalTaxChangeAtIncome =
      baselineFederalTaxAtIncome - reformFederalTaxAtIncome;
    const stateTaxChangeAtIncome =
      baselineStateTaxAtIncome - reformStateTaxAtIncome;
    const netIncomeChangeAtIncome = baselineAtIncome - reformAtIncome;

    return {
      income_range: incomeRange,
      net_income_change: netIncomeChange,
      federalTaxChange,
      stateTaxChange,
      netIncomeChange,
      benefit_at_income: {
        baseline: baselineAtIncome,
        reform: reformAtIncome,
        difference: netIncomeChangeAtIncome,
        // EITC fields retained for backward compatibility with ImpactAnalysis.
        federal_eitc_change: 0,
        state_eitc_change: 0,
        federal_tax_change: federalTaxChangeAtIncome,
        state_tax_change: stateTaxChangeAtIncome,
        net_income_change: netIncomeChangeAtIncome,
      },
      x_axis_max: request.max_earnings,
    };
  },
};
