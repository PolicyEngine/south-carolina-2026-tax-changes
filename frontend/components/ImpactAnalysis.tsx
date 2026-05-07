'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useHouseholdImpact } from '@/hooks/useHouseholdImpact';
import type { HouseholdImpactResponse, HouseholdRequest } from '@/lib/types';
import ChartWatermark from './ChartWatermark';
import {
  PROVISION_COLORS,
  PROVISION_LABELS,
} from './ExampleHouseholds';

interface Props {
  request: HouseholdRequest | null;
  triggered: boolean;
  maxEarnings?: number;
  /** When supplied, the chart renders this precomputed payload instead
   * of firing a live /us/calculate request. */
  precomputed?: HouseholdImpactResponse | null;
}

type ChartMode = 'total' | 'by_provision';

interface ChartRow {
  income: number;
  benefit: number;
  federalTaxChange: number;
  stateTaxChange: number;
  netIncomeChange: number;
  rates: number | null;
  sciad: number | null;
  eitc: number | null;
}

export default function ImpactAnalysis({
  request,
  triggered,
  maxEarnings,
  precomputed,
}: Props) {
  const liveQuery = useHouseholdImpact(request, triggered && !precomputed);
  const data = precomputed ?? liveQuery.data;
  const isLoading = !precomputed && liveQuery.isLoading;
  const error = precomputed ? null : liveQuery.error;
  const [chartMode, setChartMode] = useState<ChartMode>('total');

  if (!triggered) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Calculating impact...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as Error).message;
    const isApiNotUpdated = errorMessage.includes('500') || errorMessage.includes('too many values');
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-yellow-800 font-semibold mb-2">Household calculator temporarily unavailable</h2>
        {isApiNotUpdated ? (
          <p className="text-yellow-700">
            The PolicyEngine API is being updated to reflect the South Carolina 2026 tax changes.
            Please check back soon, or view the <strong>South Carolina impact</strong> tab for precomputed results.
          </p>
        ) : (
          <p className="text-yellow-700">{errorMessage}</p>
        )}
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) =>
    `$${Math.round(value).toLocaleString('en-US')}`;
  const formatCurrencyWithSign = (value: number) => {
    const formatted = formatCurrency(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };
  const formatIncome = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}k`;
  };

  const benefitData = data.benefit_at_income;

  const federalTaxChangePoint = benefitData.federal_tax_change;
  const stateTaxChangePoint = benefitData.state_tax_change;
  const netIncomeChangePoint = benefitData.net_income_change;

  const xMax = maxEarnings ?? data.x_axis_max;

  const federalTaxChangeSeries = data.federalTaxChange;
  const stateTaxChangeSeries = data.stateTaxChange;
  const netIncomeChangeSeries = data.netIncomeChange;

  const provChart = data.provisions_chart;
  const hasProvisions = !!provChart;

  const chartData: ChartRow[] = data.income_range
    .map((inc, i) => ({
      income: inc,
      benefit: netIncomeChangeSeries[i],
      federalTaxChange: federalTaxChangeSeries[i],
      stateTaxChange: stateTaxChangeSeries[i],
      netIncomeChange: netIncomeChangeSeries[i],
      rates: provChart ? provChart.rates.net_income_change[i] : null,
      sciad: provChart ? provChart.sciad.net_income_change[i] : null,
      eitc: provChart ? provChart.eitc.net_income_change[i] : null,
    }))
    .filter((d) => d.income <= xMax);

  // Provision dominance breakpoints — incomes where any provision's
  // sign flips. Used to mark phaseout / cap kick-in zones in the chart.
  const breakpoints: { income: number; label: string }[] = [];
  if (hasProvisions && chartData.length > 1) {
    (['rates', 'sciad', 'eitc'] as const).forEach((key) => {
      for (let i = 1; i < chartData.length; i++) {
        const prev = chartData[i - 1][key];
        const cur = chartData[i][key];
        if (prev === null || cur === null) continue;
        if ((prev <= 0 && cur > 0) || (prev >= 0 && cur < 0)) {
          breakpoints.push({
            income: chartData[i].income,
            label: `${PROVISION_LABELS[key]} ${cur > 0 ? 'starts gaining' : 'starts costing'}`,
          });
        }
      }
    });
  }

  const metricCard = (label: string, value: number) => {
    const positive = value > 0;
    const negative = value < 0;
    return (
      <div
        className={`rounded-lg p-6 border ${
          positive
            ? 'bg-green-50 border-success'
            : negative
            ? 'bg-red-50 border-red-300'
            : 'bg-gray-50 border-gray-300'
        }`}
      >
        <p className="text-sm text-gray-700 mb-2">{label}</p>
        <p
          className={`text-3xl font-bold ${
            positive ? 'text-green-600' : negative ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {value !== 0 ? `${formatCurrencyWithSign(value)}/year` : '$0/year'}
        </p>
      </div>
    );
  };

  // Custom tooltip that shows all three deltas at the hovered income point,
  // plus per-provision breakdown when available.
  const HoverTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartRow }>;
    label?: number;
  }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    const incomeLabel = typeof label === 'number' ? label : p.income;
    return (
      <div
        style={{
          background: 'var(--chart-tooltip-bg, #fff)',
          border: '1px solid var(--chart-tooltip-border, #e5e7eb)',
          borderRadius: 4,
          padding: '8px 12px',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          minWidth: 220,
        }}
      >
        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
          Income: {formatCurrency(Math.round(incomeLabel / 100) * 100)}
        </p>
        <p style={{ margin: 0 }}>
          Federal tax change: {formatCurrencyWithSign(p.federalTaxChange)}
        </p>
        <p style={{ margin: 0 }}>
          South Carolina state tax change: {formatCurrencyWithSign(p.stateTaxChange)}
        </p>
        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
          Net income change: {formatCurrencyWithSign(p.netIncomeChange)}
        </p>
        {hasProvisions && p.rates !== null && p.sciad !== null && p.eitc !== null && (
          <div
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: '1px solid var(--border-light)',
            }}
          >
            <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-muted)' }}>
              By provision
            </p>
            {(['rates', 'sciad', 'eitc'] as const).map((key) => (
              <p
                key={key}
                style={{
                  margin: '1px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: PROVISION_COLORS[key],
                  }}
                />
                <span style={{ flex: 1 }}>{PROVISION_LABELS[key]}:</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyWithSign(p[key] as number)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-primary">Impact analysis</h2>

      {/* Personal impact */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Your personal impact from South Carolina 2026 tax changes ({request?.year ?? 2026})
        </h3>
        <p className="text-gray-600 mb-4">
          Based on your employment income of <strong>{formatCurrency(request?.income ?? 0)}</strong>,
          comparing current law (2026) to pre-2026 law.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metricCard('Federal tax change', federalTaxChangePoint)}
          {metricCard('South Carolina state tax change', stateTaxChangePoint)}
          {metricCard('Net income change', netIncomeChangePoint)}
        </div>

        {hasProvisions && data.provisions && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['rates', 'sciad', 'eitc'] as const).map((key) => {
              const value = data.provisions![key].net_income_change;
              const positive = value > 0;
              const negative = value < 0;
              return (
                <div
                  key={key}
                  className="rounded-lg p-4 border bg-white border-gray-200"
                  style={{ borderLeft: `4px solid ${PROVISION_COLORS[key]}` }}
                >
                  <p className="text-xs text-gray-500 mb-1">
                    {PROVISION_LABELS[key]}
                  </p>
                  <p
                    className="text-xl font-bold"
                    style={{
                      color: positive
                        ? 'var(--chart-positive)'
                        : negative
                          ? 'var(--chart-negative)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {value !== 0 ? `${formatCurrencyWithSign(value)}/year` : '$0/year'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <hr className="border-gray-200" />

      {/* Chart */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Change in net income from South Carolina 2026 tax changes
            </h3>
            <p className="text-sm text-gray-500">
              Current law (2026) vs. pre-2026 law, by employment income
            </p>
          </div>
          {hasProvisions && (
            <div className="flex gap-1 shrink-0">
              {(['total', 'by_provision'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setChartMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    chartMode === mode
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {mode === 'total' ? 'Total' : 'By provision'}
                </button>
              ))}
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="income"
                type="number"
                tickFormatter={formatIncome}
                stroke="var(--chart-reference)"
                domain={[0, xMax]}
                allowDataOverflow={false}
              />
              <YAxis tickFormatter={formatCurrency} stroke="var(--chart-reference)" width={80} />
              <Tooltip content={<HoverTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke="var(--chart-reference)" strokeWidth={2} />
              {hasProvisions &&
                breakpoints
                  .filter((b) => b.income > 0 && b.income <= xMax)
                  .map((b, idx) => (
                    <ReferenceLine
                      key={`bp-${idx}`}
                      x={b.income}
                      stroke="var(--chart-reference)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      label={{
                        value: b.label,
                        position: 'insideTopLeft',
                        fontSize: 10,
                        fill: 'var(--text-muted)',
                      }}
                    />
                  ))}
              {chartMode === 'total' && (
                <Line
                  type="monotone"
                  dataKey="benefit"
                  stroke="var(--chart-positive)"
                  strokeWidth={3}
                  name="Net income change"
                  dot={false}
                />
              )}
              {chartMode === 'by_provision' && hasProvisions && (
                <>
                  <Line
                    type="monotone"
                    dataKey="rates"
                    stroke={PROVISION_COLORS.rates}
                    strokeWidth={2}
                    name={PROVISION_LABELS.rates}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sciad"
                    stroke={PROVISION_COLORS.sciad}
                    strokeWidth={2}
                    name={PROVISION_LABELS.sciad}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="eitc"
                    stroke={PROVISION_COLORS.eitc}
                    strokeWidth={2}
                    name={PROVISION_LABELS.eitc}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="benefit"
                    stroke="var(--chart-reference)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    name="Net total"
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        <ChartWatermark />
        {hasProvisions && (
          <p className="text-[11px] text-gray-500 italic mt-2">
            Provision lines isolate each of Act 110&apos;s three changes by reverting
            only that provision while leaving the others at current law. Their sum
            differs from the net total by an interaction residual driven by tax-math
            non-additivity (especially around the SCIAD phaseout and EITC cap).
          </p>
        )}
      </div>
    </div>
  );
}
