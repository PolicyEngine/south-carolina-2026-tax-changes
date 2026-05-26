import HomeClient from './HomeClient';
import PolicyOverview from '@/components/PolicyOverview';

/**
 * Server shell for the calculator.
 *
 * Why this is a server component (not 'use client'):
 *  - Crawlers only see the initial HTML, so the <h1>, intro paragraph,
 *    and Policy Overview content must be server-rendered.
 *  - The interactive tabs (Household impact / Statewide impact /
 *    Congressional districts) require client state, so they live in
 *    <HomeClient />.
 *  - We render the static Policy Overview both here (visibly, as the
 *    default-open tab content for crawlers) and inside the client
 *    component (controlled by the tab state) so users get tab UX while
 *    bots get the full text without executing JS.
 *
 * The hidden SEO block at the bottom carries the headings for the
 * other three tabs so they too show up in the crawled HTML.
 */
export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero — server-rendered so the <h1> is in the initial HTML. */}
      <div className="bg-primary-500 text-white py-8 px-4 shadow-md">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">
            South Carolina 2026 Tax Changes Calculator
          </h1>
          <p className="text-lg opacity-90">
            See the impact of H.4216 (Act 110) on South Carolina households
          </p>
          <p className="mt-3 max-w-3xl text-base opacity-90">
            South Carolina&apos;s H.4216, signed as Act 110 on March 30, 2026,
            consolidates the state individual income tax into a two-bracket
            schedule (1.99% and 5.21%), replaces federal standard and itemized
            deductions with the new SCIAD deduction, and caps the
            nonrefundable state EITC at $200. Use this open-source calculator
            from PolicyEngine to see how the reform affects your household and
            the state.
          </p>
        </div>
      </div>

      {/* Interactive tabs (client island). */}
      <HomeClient />

      {/* Crawlable SEO block: server-renders the headings and key text
          for every tab so search engines see the full content without
          running JavaScript. Visually hidden but present in the DOM. */}
      <section className="sr-only" aria-label="Calculator content summary for search engines and screen readers">
        <h2>Policy overview</h2>
        <PolicyOverview />
        <h2>Household impact</h2>
        <p>
          Estimate how H.4216 / Act 110 changes your South Carolina state
          income tax bill. Enter your employment income, marital status,
          dependents, and ages to see the impact of the new 1.99% / 5.21%
          brackets, the SCIAD deduction, and the $200 state EITC cap.
        </p>
        <h2>Statewide impact</h2>
        <p>
          Aggregate revenue and distributional impact of South Carolina H.4216
          (Act 110) across the state — including effects by income decile and
          on the state EITC.
        </p>
        <h2>Congressional districts</h2>
        <p>
          Average household impact of South Carolina&apos;s 2026 tax changes
          across the state&apos;s congressional districts, mapped from the
          enhanced Current Population Survey.
        </p>
      </section>
    </main>
  );
}
