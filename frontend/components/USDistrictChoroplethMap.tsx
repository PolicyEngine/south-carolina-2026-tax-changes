'use client';

import { useMemo } from 'react';

export interface SCDistrictData {
  district: string;
  district_number: string;
  representative: string;
  region: string;
  average_household_income_change: number;
  relative_household_income_change: number;
  winners_share?: number;
  losers_share?: number;
  poverty_pct_change?: number;
  child_poverty_pct_change?: number;
  state?: string;
}

interface Props {
  data: SCDistrictData[];
  selectedDistrict: string | null;
  onSelect: (districtNumber: string) => void;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
};

const formatSignedCurrency = (value: number) => {
  const base = formatCurrency(Math.abs(value));
  if (value > 0) return `+${base}`;
  if (value < 0) return `-${base}`;
  return base;
};

export default function SCDistrictChoroplethMap({
  data,
  selectedDistrict,
  onSelect,
}: Props) {
  const sortedData = useMemo(
    () =>
      [...data].sort(
        (a, b) => Number(a.district_number) - Number(b.district_number),
      ),
    [data],
  );

  const minChange = data.length
    ? Math.min(...data.map((d) => d.average_household_income_change))
    : 0;
  const maxChange = data.length
    ? Math.max(...data.map((d) => d.average_household_income_change))
    : 0;

  return (
    <div className="relative">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedData.map((d) => {
          const value = d.average_household_income_change;
          const isPositive = value > 0;
          const isNegative = value < 0;
          const isSelected = selectedDistrict === d.district_number;

          const bgClass = isPositive
            ? 'bg-green-50 border-green-300'
            : isNegative
            ? 'bg-red-50 border-red-300'
            : 'bg-gray-50 border-gray-300';
          const valueClass = isPositive
            ? 'text-green-700'
            : isNegative
            ? 'text-red-700'
            : 'text-gray-700';
          const badgeBg = isPositive
            ? '#15803d'
            : isNegative
            ? '#b91c1c'
            : '#475569';

          return (
            <button
              key={d.district_number}
              type="button"
              onClick={() => onSelect(d.district_number)}
              className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${bgClass} ${
                isSelected ? 'ring-2 ring-primary-500 shadow-md' : ''
              }`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md text-white font-bold text-sm"
                  style={{ backgroundColor: badgeBg }}
                >
                  {d.district_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    SC-{String(d.district_number).padStart(2, '0')}
                  </p>
                  {d.representative && (
                    <p className="text-xs text-gray-600 truncate">
                      {d.representative}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Avg impact
                </p>
                <p className={`text-lg font-bold ${valueClass}`}>
                  {formatSignedCurrency(value)}
                </p>
              </div>
              {d.winners_share !== undefined && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Winners
                  </p>
                  <p className="text-sm font-semibold text-gray-700">
                    {(d.winners_share * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600">
        <span>
          Range: {formatSignedCurrency(minChange)} to{' '}
          {formatSignedCurrency(maxChange)}
        </span>
      </div>
      <p className="text-xs text-gray-500 text-center mt-1">
        Average household impact from South Carolina 2026 tax changes
      </p>
    </div>
  );
}
