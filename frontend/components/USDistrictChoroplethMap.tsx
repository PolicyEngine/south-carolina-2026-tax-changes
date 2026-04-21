'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';

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

// ArcGIS REST API for 118th Congressional Districts, filtered to South Carolina.
const SC_ARCGIS_URL =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_118th_Congressional_Districts/FeatureServer/0/query?where=" +
  encodeURIComponent("STATE_ABBR='SC'") +
  '&outFields=*&f=geojson';

// SC representatives (matches CongressionalDistrictImpact.tsx)
const SC_REPRESENTATIVES: Record<string, string> = {
  '1': 'Nancy Mace',
  '2': 'Joe Wilson',
  '3': 'Sheri Biggs',
  '4': 'William Timmons',
  '5': 'Ralph Norman',
  '6': 'James Clyburn',
  '7': 'Russell Fry',
};

const formatSignedCurrency = (value: number) => {
  const abs = Math.abs(value);
  const base =
    abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  if (value > 0) return `+${base}`;
  if (value < 0) return `-${base}`;
  return base;
};

// Parse the ArcGIS feature properties to extract the district number.
// The 118th Congressional Districts service typically exposes CD118FP
// (2-digit FIPS string, e.g. "01"). Fall back to other known fields.
function getDistrictNumberFromFeature(props: Record<string, unknown>): string | null {
  const candidates = [
    props.CD118FP,
    props.CDFIPS,
    props.CDFP,
    props.DISTRICTFP,
    props.DISTRICT,
    props.CD,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const num = parseInt(String(candidate), 10);
    if (!Number.isNaN(num) && num > 0) {
      return String(num);
    }
  }
  // NAMELSAD is something like "Congressional District 1"
  if (typeof props.NAMELSAD === 'string') {
    const match = props.NAMELSAD.match(/(\d+)/);
    if (match) return String(parseInt(match[1], 10));
  }
  return null;
}

// Interpolate between two hex colors; t in [0, 1].
function lerpHexColor(a: string, b: string, t: number) {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const clamp = Math.max(0, Math.min(1, t));
  const c = (x1: number, x2: number) => Math.round(x1 + (x2 - x1) * clamp);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

// PolicyEngine diverging color scale (gray -> teal) — matches Utah dashboard.
const DIVERGING_COLORS = [
  '#475569', // gray-600 (most negative)
  '#94A3B8', // gray-400
  '#E2E8F0', // gray-200 (neutral/zero)
  '#81E6D9', // teal-200
  '#319795', // teal-500 (most positive)
];

function parseHex(color: string) {
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
}

function getImpactColor(value: number, min: number, max: number) {
  if (min >= max) return DIVERGING_COLORS[2];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const segments = DIVERGING_COLORS.length - 1;
  const segPos = t * segments;
  const segIndex = Math.min(Math.floor(segPos), segments - 1);
  const segT = segPos - segIndex;
  const c0 = parseHex(DIVERGING_COLORS[segIndex]);
  const c1 = parseHex(DIVERGING_COLORS[segIndex + 1]);
  const r = Math.round(c0.r + (c1.r - c0.r) * segT);
  const g = Math.round(c0.g + (c1.g - c0.g) * segT);
  const b = Math.round(c0.b + (c1.b - c0.b) * segT);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Hand-drawn fallback SC district polygons used if the ArcGIS fetch fails.
// Coordinates are [longitude, latitude] pairs forming rough rectangles
// across South Carolina. They are loose approximations for visual purposes
// only.
const SC_FALLBACK_FEATURES: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // SC-01: Coast (Charleston & Lowcountry)
    {
      type: 'Feature',
      properties: { CD118FP: '01' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-81.0, 32.0], [-79.3, 32.3], [-78.8, 33.3], [-80.1, 33.2],
          [-80.6, 32.7], [-81.0, 32.0],
        ]],
      },
    },
    // SC-02: Columbia & Midlands
    {
      type: 'Feature',
      properties: { CD118FP: '02' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-81.4, 33.3], [-80.6, 33.2], [-80.4, 34.1], [-81.3, 34.2],
          [-81.9, 33.8], [-81.4, 33.3],
        ]],
      },
    },
    // SC-03: Upstate West
    {
      type: 'Feature',
      properties: { CD118FP: '03' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-83.4, 34.2], [-82.3, 34.1], [-82.1, 34.9], [-83.3, 35.1],
          [-83.4, 34.2],
        ]],
      },
    },
    // SC-04: Greenville-Spartanburg
    {
      type: 'Feature',
      properties: { CD118FP: '04' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-82.5, 34.5], [-81.7, 34.4], [-81.6, 35.2], [-82.4, 35.2],
          [-82.5, 34.5],
        ]],
      },
    },
    // SC-05: Rock Hill & North Central
    {
      type: 'Feature',
      properties: { CD118FP: '05' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-81.6, 34.3], [-80.5, 34.2], [-80.3, 35.1], [-81.5, 35.2],
          [-81.6, 34.3],
        ]],
      },
    },
    // SC-06: Pee Dee & rural east
    {
      type: 'Feature',
      properties: { CD118FP: '06' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-80.7, 33.3], [-79.5, 33.3], [-79.5, 34.3], [-80.4, 34.2],
          [-80.7, 33.3],
        ]],
      },
    },
    // SC-07: Myrtle Beach & Northeast
    {
      type: 'Feature',
      properties: { CD118FP: '07' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-79.6, 33.3], [-78.5, 33.8], [-78.7, 34.7], [-79.6, 34.5],
          [-79.6, 33.3],
        ]],
      },
    },
  ],
};

type Tooltip = {
  x: number;
  y: number;
  districtNum: string;
  representative: string;
  value: number;
};

export default function SCDistrictChoroplethMap({
  data,
  selectedDistrict,
  onSelect,
}: Props) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // Fetch SC congressional districts from ArcGIS, with fallback.
  useEffect(() => {
    let cancelled = false;
    fetch(SC_ARCGIS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: GeoJSON.FeatureCollection) => {
        if (cancelled) return;
        if (json.features && json.features.length > 0) {
          setGeoData(json);
        } else {
          setGeoData(SC_FALLBACK_FEATURES);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(
          'Falling back to hand-drawn SC districts; ArcGIS fetch failed:',
          err,
        );
        setGeoData(SC_FALLBACK_FEATURES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build lookup by district number (as string, without leading zeros).
  const dataByNumber = useMemo(() => {
    const m = new Map<string, SCDistrictData>();
    data.forEach((d) => m.set(String(d.district_number), d));
    return m;
  }, [data]);

  const maxAbs = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(
      ...data.map((d) => Math.abs(d.average_household_income_change)),
      0,
    );
  }, [data]);

  const minChange = data.length
    ? Math.min(...data.map((d) => d.average_household_income_change))
    : 0;
  const maxChange = data.length
    ? Math.max(...data.map((d) => d.average_household_income_change))
    : 0;

  const handleDistrictEnter = useCallback(
    (districtNum: string, evt: React.MouseEvent) => {
      const d = dataByNumber.get(districtNum);
      if (!d) return;
      setTooltip({
        x: evt.clientX,
        y: evt.clientY,
        districtNum,
        representative:
          d.representative || SC_REPRESENTATIVES[districtNum] || '',
        value: d.average_household_income_change,
      });
    },
    [dataByNumber],
  );

  const handleDistrictLeave = useCallback(() => setTooltip(null), []);

  if (!geoData) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg h-[420px]">
        <p className="text-gray-500">Loading South Carolina district map...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="w-full" style={{ height: 420 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 4000, center: [-80.9, 33.9] }}
          width={800}
          height={500}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup center={[-80.9, 33.9]} zoom={1} minZoom={1} maxZoom={4}>
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const districtNum = getDistrictNumberFromFeature(
                    geo.properties || {},
                  );
                  if (!districtNum) return null;
                  const d = dataByNumber.get(districtNum);
                  const value = d?.average_household_income_change ?? 0;
                  const isSelected = selectedDistrict === districtNum;
                  const fill = getImpactColor(value, minChange, maxChange);
                  return (
                    <Geography
                      key={geo.rsmKey || districtNum}
                      geography={geo}
                      onClick={() => onSelect(districtNum)}
                      onMouseEnter={(evt) =>
                        handleDistrictEnter(districtNum, evt)
                      }
                      onMouseMove={(evt) =>
                        handleDistrictEnter(districtNum, evt)
                      }
                      onMouseLeave={handleDistrictLeave}
                      style={{
                        default: {
                          fill,
                          stroke: isSelected ? '#0f766e' : '#ffffff',
                          strokeWidth: isSelected ? 2 : 0.75,
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'fill 0.2s ease',
                        },
                        hover: {
                          fill,
                          stroke: '#0f766e',
                          strokeWidth: 1.5,
                          outline: 'none',
                          cursor: 'pointer',
                          opacity: 0.85,
                        },
                        pressed: {
                          fill,
                          stroke: '#0f766e',
                          strokeWidth: 2,
                          outline: 'none',
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {tooltip && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 pointer-events-none text-sm"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          >
            <p className="font-semibold text-gray-900">
              SC-{String(tooltip.districtNum).padStart(2, '0')}
            </p>
            {tooltip.representative && (
              <p className="text-gray-600">{tooltip.representative}</p>
            )}
            <p className="text-gray-700">
              Avg change:{' '}
              <span className="font-semibold">
                {formatSignedCurrency(tooltip.value)}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600">
        <span>{formatSignedCurrency(minChange)}</span>
        <div
          className="h-3 w-48 rounded"
          style={{
            background: `linear-gradient(to right, ${DIVERGING_COLORS.join(', ')})`,
          }}
        />
        <span>{formatSignedCurrency(maxChange)}</span>
      </div>
      <p className="text-xs text-gray-500 text-center mt-1">
        Average household impact from South Carolina 2026 tax changes
      </p>
    </div>
  );
}
