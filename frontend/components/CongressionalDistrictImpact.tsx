'use client';

import { useState, useEffect } from 'react';
import SCDistrictMap, { SCDistrictData } from './DynamicDistrictMap';
import ChartWatermark from './ChartWatermark';

interface Props {
  year?: number;
}

// South Carolina representatives (119th Congress)
const SC_REPRESENTATIVES: Record<string, string> = {
  '1': 'Nancy Mace',
  '2': 'Joe Wilson',
  '3': 'Sheri Biggs',
  '4': 'William Timmons',
  '5': 'Ralph Norman',
  '6': 'James Clyburn',
  '7': 'Russell Fry',
};

// South Carolina district regions (for context in labels)
const SC_DISTRICT_REGIONS: Record<string, string> = {
  '1': 'Charleston & Coast',
  '2': 'Columbia & Midlands',
  '3': 'Upstate West',
  '4': 'Greenville-Spartanburg',
  '5': 'Rock Hill & North Central',
  '6': 'Pee Dee & Rural East',
  '7': 'Myrtle Beach & Northeast',
};

export default function CongressionalDistrictImpact({ year = 2026 }: Props) {
  const [data, setData] = useState<SCDistrictData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
      ? process.env.NEXT_PUBLIC_BASE_PATH
      : '/us/south-carolina-2026-tax-changes';

    fetch(`${basePath}/data/congressional_districts.csv`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load district data');
        return res.text();
      })
      .then((text) => {
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          const row: Record<string, string | number> = {};
          headers.forEach((h, i) => {
            const val = values[i];
            row[h] = isNaN(Number(val)) ? val : Number(val);
          });
          return row as unknown as SCDistrictData & { state: string; year: number };
        });
        // Filter to South Carolina only (state code "SC") and selected year
        const scRows = rows
          .filter((r) => r.state === 'SC' && r.year === year)
          .map((r) => {
            const districtNum = String(r.district).split('-')[1] || '';
            const districtId = districtNum.replace(/^0+/, '') || districtNum;
            return {
              ...r,
              district_number: districtId,
              representative: SC_REPRESENTATIVES[districtId] || '',
              region: SC_DISTRICT_REGIONS[districtId] || '',
            } as SCDistrictData;
          })
          .sort((a, b) =>
            Number(a.district_number) - Number(b.district_number)
          );
        setData(scRows);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading South Carolina district data...</p>
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-yellow-800 font-semibold mb-2">
          South Carolina district data not yet available
        </h2>
        <p className="text-yellow-700">
          {error || 'South Carolina district-level impact data has not been generated yet.'}
        </p>
        <p className="text-yellow-700 mt-2">
          Run: <code className="bg-yellow-100 px-2 py-1 rounded">modal run scripts/modal_district_pipeline.py</code>
        </p>
      </div>
    );
  }

  const selectedData = selectedDistrict
    ? data.find((d) => d.district_number === selectedDistrict) || null
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          South Carolina congressional district impacts ({year})
        </h3>
        <p className="text-gray-600">
          Average household impact by congressional district from the 2026 South Carolina tax changes
          under H.4216 (current law vs. pre-2026 law). Click a district card for detailed impact analysis.
        </p>
      </div>

      {/* Map */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <SCDistrictMap
          data={data}
          selectedDistrict={selectedDistrict}
          onSelect={(districtNum) =>
            setSelectedDistrict((prev) =>
              prev === districtNum ? null : districtNum
            )
          }
        />
        <ChartWatermark />
      </div>

      {/* Detail card below map */}
      {selectedData ? (
        <DistrictDetailCard
          district={selectedData}
          onClose={() => setSelectedDistrict(null)}
        />
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <p className="text-gray-500 text-sm">
            Click a district card above to see detailed impact analysis.
          </p>
        </div>
      )}

      {/* All districts table */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">
          All South Carolina districts
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">District</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Representative</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Average change</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Relative change</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Winners</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.district_number}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedDistrict === d.district_number ? 'bg-teal-50' : ''
                  }`}
                  onClick={() =>
                    setSelectedDistrict((prev) =>
                      prev === d.district_number ? null : d.district_number
                    )
                  }
                >
                  <td className="py-3 px-4 text-gray-700 font-medium">
                    SC-{String(d.district_number).padStart(2, '0')}
                    <span className="block text-xs text-gray-500 font-normal">{d.region}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{d.representative}</td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {d.average_household_income_change >= 0 ? '+' : ''}
                    ${d.average_household_income_change.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {(d.relative_household_income_change * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {d.winners_share !== undefined
                      ? `${(d.winners_share * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DistrictDetailCard({
  district,
  onClose,
}: {
  district: SCDistrictData;
  onClose: () => void;
}) {
  const avgChange = district.average_household_income_change;
  const isPositive = avgChange > 0;
  const isNegative = avgChange < 0;
  const winnersShare = district.winners_share ?? 0;
  const losersShare = district.losers_share ?? 0;
  // "No change" is the residual after winners + losers.
  const noChangeShare = Math.max(0, 1 - winnersShare - losersShare);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold text-lg"
            style={{ backgroundColor: isPositive ? '#319795' : isNegative ? '#dc2626' : '#475569' }}
          >
            {district.district_number}
          </span>
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              South Carolina District {district.district_number}
            </h4>
            <p className="text-sm text-gray-500">
              {district.representative}
              {district.region ? ` — ${district.region}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Average household impact
          </p>
          <p
            className={`text-xl font-bold ${
              isPositive ? 'text-teal-700' : isNegative ? 'text-red-700' : 'text-gray-700'
            }`}
          >
            {isPositive ? '+' : ''}
            ${avgChange.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(district.relative_household_income_change * 100).toFixed(2)}% of income
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Winners</p>
          <p className="text-xl font-bold text-teal-600">
            {(winnersShare * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">of households gain</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Losers</p>
          <p className="text-xl font-bold text-red-600">
            {(losersShare * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">of households lose</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">No change</p>
          <p className="text-xl font-bold text-gray-600">
            {(noChangeShare * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">of households</p>
        </div>
      </div>
    </div>
  );
}
