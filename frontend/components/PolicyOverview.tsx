'use client';

export default function PolicyOverview() {
  return (
    <div className="space-y-10">
      {/* Summary */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          South Carolina 2026 Tax Changes
        </h2>
        <p className="text-gray-700 mb-4">
          South Carolina&apos;s H.4216 (Act 110), signed March 30, 2026, restructured
          the state income tax for tax years beginning after 2025. The bill introduces
          consolidates the three-bracket rate schedule into two brackets, replaces federal deductions with a state-specific
          SCIAD deduction, and caps the nonrefundable state EITC at $200.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Simplified brackets</h3>
            <p className="text-sm text-gray-600">
              Replaces the 2025 graduated rates (0%/3%/6%) with two brackets: 1.99%
              on the first $30,000 of taxable income and 5.21% above.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">SCIAD deduction</h3>
            <p className="text-sm text-gray-600">
              New SC Income Adjusted Deduction replaces federal standard/itemized
              deductions. Phased out at higher incomes; base amount varies by
              filing status.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">EITC cap</h3>
            <p className="text-sm text-gray-600">
              Caps South Carolina&apos;s nonrefundable state Earned Income Tax Credit
              at $200 per filer. Previously the state credit was 125% of the
              federal EITC with no dollar cap.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Effective 2026</h3>
            <p className="text-sm text-gray-600">
              All three changes apply to tax years beginning after December 31,
              2025.
            </p>
          </div>
        </div>
      </div>

      {/* Parameter changes table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Parameter changes (2026)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Parameter</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Pre-2026 law</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Current law (2026)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Tax rates</td>
                <td className="py-3 px-4 text-right text-gray-700">0% / 3% / 6%</td>
                <td className="py-3 px-4 text-right text-gray-700">1.99% / 5.21%</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">Bracket thresholds</td>
                <td className="py-3 px-4 text-right text-gray-700">$3,560 / $17,830</td>
                <td className="py-3 px-4 text-right text-gray-700">$30,000</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">SCIAD base (Single/MFS &middot; HoH &middot; Joint/Surviving)</td>
                <td className="py-3 px-4 text-right text-gray-700">N/A</td>
                <td className="py-3 px-4 text-right text-gray-700">$15,000 / $22,500 / $30,000</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-700">State EITC cap</td>
                <td className="py-3 px-4 text-right text-gray-700">None</td>
                <td className="py-3 px-4 text-right text-gray-700">$200</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* References and further reading */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          References
        </h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">SC H.4216</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>
              <a
                href="https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                Bill text
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
