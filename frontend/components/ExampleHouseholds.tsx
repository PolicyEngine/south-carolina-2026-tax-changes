'use client';

import { useEffect, useState } from 'react';
import type {
  HouseholdImpactResponse,
  ProvisionsAtIncome,
  ProvisionsChart,
} from '@/lib/types';

export interface ExampleHouseholdProfile {
  label: string;
  income: number;
  age_head: number;
  married: boolean;
  dependents: number[];
  real_estate_taxes?: number;
  home_mortgage_interest?: number;
  charitable_cash_donations?: number;
}

interface ChartArrays {
  income_range: number[];
  net_income_change: number[];
  state_tax_change: number[];
  federal_tax_change: number[];
}

interface ExampleHousehold extends ExampleHouseholdProfile {
  baseline: {
    household_net_income: number;
    sc_income_tax: number;
    income_tax: number;
  };
  reform: {
    household_net_income: number;
    sc_income_tax: number;
    income_tax: number;
  };
  net_income_change: number;
  sc_tax_change: number;
  chart: ChartArrays;
  provisions?: ProvisionsAtIncome;
  provisions_chart?: ProvisionsChart;
}

interface Payload {
  year: number;
  households: ExampleHousehold[];
}

const fmtCurrency = (v: number) =>
  `$${Math.round(v).toLocaleString('en-US')}`;

const fmtSigned = (v: number) => {
  const base = fmtCurrency(Math.abs(v));
  if (v > 0) return `+${base}`;
  if (v < 0) return `-${base}`;
  return base;
};

/** PE-palette colors for the three SC provisions. Used both on the
 *  card breakdown rows and on the "By provision" chart lines. */
export const PROVISION_COLORS = {
  rates: 'var(--primary-500)',     // SC primary teal
  sciad: 'var(--primary-800)',     // dark teal
  eitc: 'var(--gray-600)',         // neutral gray (often negative)
} as const;

export const PROVISION_LABELS = {
  rates: 'Rate brackets',
  sciad: 'SCIAD deduction',
  eitc: 'EITC cap',
} as const;

/** Build a HouseholdImpactResponse-shaped payload from one of the
 *  precomputed example records, so the existing ImpactAnalysis chart
 *  can render it without firing a live API call. */
function toImpactResponse(h: ExampleHousehold): HouseholdImpactResponse {
  const xMax = h.chart.income_range[h.chart.income_range.length - 1];
  const federalTaxChange = h.baseline.income_tax - h.reform.income_tax;
  return {
    income_range: h.chart.income_range,
    net_income_change: h.chart.net_income_change,
    federalTaxChange: h.chart.federal_tax_change,
    stateTaxChange: h.chart.state_tax_change,
    netIncomeChange: h.chart.net_income_change,
    benefit_at_income: {
      baseline: h.baseline.household_net_income,
      reform: h.reform.household_net_income,
      difference: h.net_income_change,
      federal_tax_change: federalTaxChange,
      state_tax_change: h.sc_tax_change,
      net_income_change: h.net_income_change,
    },
    x_axis_max: xMax,
    provisions: h.provisions,
    provisions_chart: h.provisions_chart,
  };
}

interface Props {
  /** Fires when a card is clicked; parent populates the household form
   *  and passes the precomputed response into ImpactAnalysis. */
  onSelect: (
    profile: ExampleHouseholdProfile,
    response: HouseholdImpactResponse,
  ) => void;
  /** Label of the currently active example, so the matching card can
   *  highlight itself. */
  selectedLabel?: string | null;
}

export default function ExampleHouseholds({
  onSelect,
  selectedLabel,
}: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const basePath =
      process.env.NEXT_PUBLIC_BASE_PATH !== undefined
        ? process.env.NEXT_PUBLIC_BASE_PATH
        : '/us/south-carolina-2026-tax-changes';
    fetch(`${basePath}/data/example_households.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then((j: Payload) => setData(j))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return null;
  if (!data) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Example households
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Click an example to load its profile into the calculator and render its
        net-income chart instantly. The breakdown attributes the impact to each
        of Act 110&apos;s three provisions.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.households.map((h, i) => {
          const isGain = h.net_income_change > 0;
          const isSelected = selectedLabel === h.label;
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                onSelect(
                  {
                    label: h.label,
                    income: h.income,
                    age_head: h.age_head,
                    married: h.married,
                    dependents: h.dependents,
                    real_estate_taxes: h.real_estate_taxes,
                    home_mortgage_interest: h.home_mortgage_interest,
                    charitable_cash_donations: h.charitable_cash_donations,
                  },
                  toImpactResponse(h),
                )
              }
              className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                isSelected
                  ? 'ring-2 ring-primary-500 ring-offset-1 bg-white border-primary-500'
                  : isGain
                    ? 'bg-primary-50 border-primary-300 hover:border-primary-500'
                    : h.net_income_change < 0
                      ? 'bg-gray-50 border-gray-300 hover:border-gray-500'
                      : 'bg-gray-50 border-gray-300 hover:border-gray-400'
              }`}
            >
              <p className="text-sm font-semibold text-gray-800">{h.label}</p>
              <p
                className="text-2xl font-bold mt-1"
                style={{
                  color: isGain
                    ? 'var(--chart-positive)'
                    : h.net_income_change < 0
                      ? 'var(--chart-negative)'
                      : 'var(--text-secondary)',
                }}
              >
                {fmtSigned(h.net_income_change)}/year
              </p>

              {h.provisions && (
                <ProvisionBreakdown provisions={h.provisions} />
              )}

              <p className="text-xs text-gray-500 mt-2 leading-5">
                SC tax: {fmtCurrency(h.reform.sc_income_tax)} →{' '}
                {fmtCurrency(h.baseline.sc_income_tax)}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 italic mt-2">
        Income change is current law (2026) minus pre-2026 (Act 110 reverted).
        Single parent files head of household. Married couples file jointly
        with the spouse aged 35. The itemizer profile carries $12k property
        tax, $20k mortgage interest, and $5k charitable to trigger SCAID.
      </p>
    </div>
  );
}

function ProvisionBreakdown({ provisions }: { provisions: ProvisionsAtIncome }) {
  const rows: { key: keyof typeof PROVISION_LABELS; value: number }[] = [
    { key: 'rates', value: provisions.rates.net_income_change },
    { key: 'sciad', value: provisions.sciad.net_income_change },
    { key: 'eitc', value: provisions.eitc.net_income_change },
  ];
  const residual = provisions.interaction_residual?.net_income_change ?? 0;
  const showResidual = Math.abs(residual) >= 1;

  return (
    <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
      {rows.map(({ key, value }) => (
        <div
          key={key}
          className="flex items-center justify-between text-xs"
        >
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: PROVISION_COLORS[key] }}
            />
            <span className="text-gray-700">{PROVISION_LABELS[key]}</span>
          </span>
          <span
            className="font-medium tabular-nums"
            style={{
              color:
                value > 0
                  ? 'var(--chart-positive)'
                  : value < 0
                    ? 'var(--chart-negative)'
                    : 'var(--text-muted)',
            }}
          >
            {fmtSigned(value)}
          </span>
        </div>
      ))}
      {showResidual && (
        <div
          className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5 italic"
          title="Non-additivity among SC's three provisions: SCIAD reduces taxable income before rates apply, so changing both compounds beyond rates-only + SCIAD-only. Not federal flow-through."
        >
          <span>SC provision interaction</span>
          <span className="tabular-nums">{fmtSigned(residual)}</span>
        </div>
      )}
    </div>
  );
}
