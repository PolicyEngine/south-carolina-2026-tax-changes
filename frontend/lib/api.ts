/**
 * Household impact via www.policyengine.org's dashboard API.
 *
 * The page never calls the PolicyEngine Public API itself: the dashboard
 * API's server adds PolicyEngine's credential and forwards each household
 * to the Public API's /us/calculate.
 *
 * The PolicyEngine baseline already includes H.4216 (Act 110), so
 * `current_law` is computed without a reform and `pre_2026` is computed
 * with the inverse reform that reverts SC parameters to their 2025
 * values. The displayed impact equals:
 *
 *   impact = current_law - pre_2026
 */

import {
  createPolicyEngineApiClient,
  PolicyEngineApiError,
} from "@policyengine/api-client";

import {
  HouseholdRequest,
  HouseholdImpactResponse,
} from "./types";
import {
  buildHouseholdSituation,
  buildReformPolicy,
  interpolate,
} from "./household";

const policyengine = createPolicyEngineApiClient();

/** How long a calculation may take before the page gives up on it. */
const CALCULATION_TIMEOUT_MILLISECONDS = 120_000;

/** Brief gateway failures, which are worth retrying. */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/**
 * How long the page waits after a refusal for the firewall's limit before
 * it calculates again: the firewall counts calculations a minute.
 */
export const RATE_LIMIT_PAUSE_MILLISECONDS = 60_000;

/** What the page says about the firewall's limit, which everyone behind
 * one address shares. */
const SHARED_LIMIT_EXPLANATION =
  "Everyone on your network, such as a workshop or an office, shares a " +
  "limit on calculations a minute";

/** A household calculation failed; `message` is written for the user. */
export class HouseholdCalculationError extends Error {
  override name = "HouseholdCalculationError";

  constructor(
    message: string,
    /** The dashboard API's HTTP status, or null when no answer was read. */
    readonly status: number | null,
    /** Whether trying again at once could succeed. */
    readonly retryable: boolean,
    /**
     * Whether the firewall's limit may have refused it: a 429, or no
     * readable answer, which is how a page on another origin sees a 429.
     */
    readonly rateLimited: boolean = false,
  ) {
    super(message);
  }
}

/**
 * Whether React Query should retry a failed household calculation: once,
 * and only after a brief gateway failure. Each attempt sends two
 * calculations, and the firewall allows 30 a minute.
 */
export function shouldRetryHouseholdCalculation(
  failureCount: number,
  error: unknown,
): boolean {
  return (
    failureCount < 1 &&
    error instanceof HouseholdCalculationError &&
    error.retryable
  );
}

function dashboardApiMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return null;
}

/** Turns a failure of the dashboard API client into a message for the user. */
function calculationError(error: PolicyEngineApiError): HouseholdCalculationError {
  if (error.status === null) {
    // On another origin, such as the dashboard's own host, the firewall's
    // 429 has no CORS headers, so the browser reports a network failure.
    // So does the dashboard API's 403 for an origin it does not allow.
    return new HouseholdCalculationError(
      "PolicyEngine's calculation service could not be reached. " +
        `${SHARED_LIMIT_EXPLANATION}: if it has been reached, this page can ` +
        "calculate again in a minute.",
      null,
      false,
      true,
    );
  }
  if (error.status === 429) {
    return new HouseholdCalculationError(
      `${SHARED_LIMIT_EXPLANATION}, and it has been reached. This page can ` +
        "calculate again in a minute.",
      429,
      false,
      true,
    );
  }
  const detail =
    dashboardApiMessage(error.body) ?? "Try again in a few minutes.";
  return new HouseholdCalculationError(
    `PolicyEngine could not calculate this household (HTTP ${error.status}): ${detail}`,
    error.status,
    RETRYABLE_STATUSES.has(error.status),
  );
}

/** Values over the income axis, keyed by year. */
type ValuesByYear = Record<string, number[]>;

/** The parts of a calculated household this page reads. */
interface CalculatedHousehold {
  people: Record<string, Record<string, ValuesByYear>>;
  households: Record<string, Record<string, ValuesByYear>>;
  tax_units: Record<string, Record<string, ValuesByYear>>;
}

async function calculateHousehold(
  household: Record<string, unknown>,
  policy?: Record<string, unknown>
): Promise<CalculatedHousehold> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    CALCULATION_TIMEOUT_MILLISECONDS
  );
  try {
    return await policyengine.calculateHousehold<CalculatedHousehold>(
      { country: "us", household, policy },
      { signal: controller.signal }
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HouseholdCalculationError(
        "The calculation took longer than two minutes. Try again.",
        null,
        false,
      );
    }
    if (error instanceof PolicyEngineApiError) {
      throw calculationError(error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async calculateHouseholdImpact(
    request: HouseholdRequest
  ): Promise<HouseholdImpactResponse> {
    const household = buildHouseholdSituation(request);
    const policy = buildReformPolicy();
    const yearStr = String(request.year);

    // currentLaw is the unmodified PE-US baseline (already includes
    // H.4216). pre2026 applies the inverse reform.
    const [currentLawResult, pre2026Result] = await Promise.all([
      calculateHousehold(household),
      calculateHousehold(household, policy),
    ]);

    const currentLawNetIncome: number[] =
      currentLawResult.households["your household"][
        "household_net_income"
      ][yearStr];
    const pre2026NetIncome: number[] =
      pre2026Result.households["your household"][
        "household_net_income"
      ][yearStr];
    const incomeRange: number[] =
      currentLawResult.people["you"][
        "employment_income"
      ][yearStr];

    const currentLawStateTax: number[] =
      currentLawResult.tax_units["your tax unit"]["sc_income_tax"][
        yearStr
      ];
    const pre2026StateTax: number[] =
      pre2026Result.tax_units["your tax unit"]["sc_income_tax"][
        yearStr
      ];

    const currentLawFederalTax: number[] =
      currentLawResult.tax_units["your tax unit"]["income_tax"][yearStr];
    const pre2026FederalTax: number[] =
      pre2026Result.tax_units["your tax unit"]["income_tax"][yearStr];

    // Impact = current_law - pre_2026.
    const netIncomeChange = currentLawNetIncome.map(
      (val, i) => val - pre2026NetIncome[i]
    );
    const federalTaxChange = currentLawFederalTax.map(
      (val, i) => val - pre2026FederalTax[i]
    );
    const stateTaxChange = currentLawStateTax.map(
      (val, i) => val - pre2026StateTax[i]
    );

    const currentLawAtIncome = interpolate(
      incomeRange,
      currentLawNetIncome,
      request.income
    );
    const pre2026AtIncome = interpolate(
      incomeRange,
      pre2026NetIncome,
      request.income
    );
    const currentLawFederalTaxAtIncome = interpolate(
      incomeRange,
      currentLawFederalTax,
      request.income
    );
    const pre2026FederalTaxAtIncome = interpolate(
      incomeRange,
      pre2026FederalTax,
      request.income
    );
    const currentLawStateTaxAtIncome = interpolate(
      incomeRange,
      currentLawStateTax,
      request.income
    );
    const pre2026StateTaxAtIncome = interpolate(
      incomeRange,
      pre2026StateTax,
      request.income
    );

    const federalTaxChangeAtIncome =
      currentLawFederalTaxAtIncome - pre2026FederalTaxAtIncome;
    const stateTaxChangeAtIncome =
      currentLawStateTaxAtIncome - pre2026StateTaxAtIncome;
    const netIncomeChangeAtIncome = currentLawAtIncome - pre2026AtIncome;

    return {
      income_range: incomeRange,
      net_income_change: netIncomeChange,
      federalTaxChange,
      stateTaxChange,
      netIncomeChange,
      benefit_at_income: {
        baseline: pre2026AtIncome,
        reform: currentLawAtIncome,
        difference: netIncomeChangeAtIncome,
        federal_tax_change: federalTaxChangeAtIncome,
        state_tax_change: stateTaxChangeAtIncome,
        net_income_change: netIncomeChangeAtIncome,
      },
      x_axis_max: request.max_earnings,
    };
  },
};
