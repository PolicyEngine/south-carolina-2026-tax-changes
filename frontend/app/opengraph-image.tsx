import { ImageResponse } from 'next/og';

// Route segment config — generate at build time.
// We intentionally do NOT set `runtime = 'edge'` here: the Edge runtime
// has a 1MB compressed function size limit, and `next/og`'s
// `ImageResponse` (which bundles fonts + a WASM rasterizer) regularly
// pushes us over that ceiling, causing the Vercel deployment to fail
// with an opaque "Error" status after a successful build. The Node.js
// runtime has no such cap and renders the same PNG just fine.
export const alt =
  "South Carolina 2026 Tax Changes Calculator — H.4216 / Act 110 impact on households and the state";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Programmatically-generated 1200x630 social card.
 *
 * Uses next/og (Edge runtime) so we don't need to ship a binary PNG in
 * the repo. The same image is also referenced by Twitter's
 * summary_large_image card via Next's auto-wiring.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background:
            'linear-gradient(135deg, #1F4E5F 0%, #2C7A7B 60%, #38A89D 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '0.02em',
            opacity: 0.92,
          }}
        >
          PolicyEngine
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 500,
              opacity: 0.85,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            South Carolina &middot; H.4216 / Act 110
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              maxWidth: 1000,
            }}
          >
            South Carolina 2026 Tax Changes Calculator
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              opacity: 0.92,
              maxWidth: 1000,
              lineHeight: 1.3,
            }}
          >
            New brackets, SCIAD deduction, and EITC $200 cap — see the impact on
            your household and the state.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            opacity: 0.8,
          }}
        >
          <span>policyengine.org/us/south-carolina-2026-tax-changes</span>
          <span>2026</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
