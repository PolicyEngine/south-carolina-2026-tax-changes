import type { MetadataRoute } from 'next';

/**
 * Host-aware robots policy.
 *
 * The canonical URL for this calculator is
 * https://policyengine.org/us/south-carolina-2026-tax-changes (proxied
 * by the main site). The Vercel preview / production domain
 * (south-carolina-2026-tax-changes.vercel.app) serves identical
 * content, so we noindex it to avoid a duplicate-content split.
 *
 * Logic:
 *  - VERCEL_ENV === 'production' AND VERCEL_URL contains "vercel.app"
 *    → disallow all (this is the standalone production Vercel domain).
 *  - VERCEL_ENV === 'preview' → disallow all (preview builds).
 *  - Otherwise (local dev, or when proxied behind policyengine.org so
 *    VERCEL_URL is not the vercel.app host at request time) → allow.
 *
 * Note: this file runs at build time, so the decision is baked per
 * deployment. The PolicyEngine main site rewrites/proxies this app
 * under its own domain — and that deployment is published on a custom
 * domain rather than the *.vercel.app one, so the allow branch fires
 * there. The standalone vercel.app deployment hits the noindex branch.
 */
export default function robots(): MetadataRoute.Robots {
  const vercelEnv = process.env.VERCEL_ENV;
  const vercelUrl = process.env.VERCEL_URL ?? '';

  const isStandaloneVercel =
    vercelEnv === 'preview' ||
    (vercelEnv === 'production' && vercelUrl.endsWith('.vercel.app'));

  if (isStandaloneVercel) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      // Intentionally no sitemap on the noindexed host.
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap:
      'https://policyengine.org/us/south-carolina-2026-tax-changes/sitemap.xml',
  };
}
