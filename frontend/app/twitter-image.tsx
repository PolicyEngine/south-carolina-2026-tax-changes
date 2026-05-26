import { ImageResponse } from 'next/og';
import OpengraphImage from './opengraph-image';

// Twitter card image — shares the same design as the OG image.
// Inlined (rather than re-exporting from opengraph-image) so Next.js
// can statically detect the route segment config.
// See opengraph-image.tsx for why we deliberately omit the Edge runtime
// declaration (1MB size cap vs. next/og's font + WASM payload).
export const alt =
  "South Carolina 2026 Tax Changes Calculator — H.4216 / Act 110 impact on households and the state";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  // Reuse the OG image renderer. ImageResponse import kept so the type
  // surface is identical even if future changes diverge the designs.
  void ImageResponse;
  return OpengraphImage();
}
