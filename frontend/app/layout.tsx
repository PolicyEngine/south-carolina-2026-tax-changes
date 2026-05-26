import Script from 'next/script';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const GA_ID = 'G-2YHG89FY0N';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const SITE_URL = 'https://policyengine.org/us/south-carolina-2026-tax-changes';
const OG_IMAGE_URL = `${SITE_URL}/opengraph-image`;

const TITLE =
  'South Carolina 2026 Tax Changes Calculator — H.4216 / Act 110 | PolicyEngine';
const DESCRIPTION =
  "See how South Carolina's H.4216 (Act 110) 2026 tax changes — new 1.99% / 5.21% brackets, the SCIAD deduction, and the $200 state EITC cap — affect your household and the state.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  keywords: [
    'South Carolina',
    'H.4216',
    'Act 110',
    'SC income tax',
    '2026 tax changes',
    'SCIAD deduction',
    'state EITC',
    'tax calculator',
    'PolicyEngine',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'PolicyEngine',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'South Carolina 2026 Tax Changes Calculator — H.4216 / Act 110',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE_URL],
    site: '@ThePolicyEngine',
    creator: '@ThePolicyEngine',
  },
  other: {
    'theme-color': '#2C7A7B', // CSS var not supported in meta tags, matches --theme-color
  },
  icons: {
    icon: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// JSON-LD structured data: declares both the interactive tool (WebApplication)
// and the underlying legislation (Legislation) so search engines can connect
// the calculator to H.4216 / Act 110 entity searches.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}#webapp`,
      name: 'South Carolina 2026 Tax Changes Calculator',
      url: SITE_URL,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any (web)',
      browserRequirements: 'Requires JavaScript',
      description: DESCRIPTION,
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      provider: {
        '@type': 'Organization',
        name: 'PolicyEngine',
        url: 'https://policyengine.org',
        logo: 'https://policyengine.org/assets/logos/policyengine/white.svg',
      },
      about: { '@id': `${SITE_URL}#legislation` },
      image: OG_IMAGE_URL,
    },
    {
      '@type': 'Legislation',
      '@id': `${SITE_URL}#legislation`,
      name: 'South Carolina H.4216 (Act 110)',
      alternateName: ['SC H.4216', 'Act 110', 'South Carolina Act 110 of 2026'],
      legislationIdentifier: 'H.4216',
      legislationType: 'StatutoryInstrument',
      jurisdiction: {
        '@type': 'AdministrativeArea',
        name: 'South Carolina, United States',
      },
      datePublished: '2026-03-30',
      legislationDate: '2026-03-30',
      legislationPassedBy: {
        '@type': 'Organization',
        name: 'South Carolina General Assembly',
      },
      url: 'https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm',
      description:
        'South Carolina H.4216 (Act 110), signed March 30, 2026, restructures the state individual income tax for tax years beginning after 2025: consolidating brackets (1.99% / 5.21%), replacing federal deductions with the SCIAD deduction, and capping the nonrefundable state EITC at $200.',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        <Script
          id="ld-json"
          type="application/ld+json"
          strategy="beforeInteractive"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
