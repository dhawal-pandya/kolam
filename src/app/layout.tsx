import type { Metadata, Viewport } from 'next';
import './globals.css';

/** Public address of the deployed site; link previews need absolute URLs. */
const SITE_URL = 'https://dhawal-pandya.github.io/kolam';
const DESCRIPTION =
  'Traditional South Indian kolams drawn from their real construction rules: one-line sikku, wire-like kambi, dot-joining pulli, and named yantras. Every design is reproducible from its link.';
const PREVIEW = { url: `${SITE_URL}/og-kolam.jpg`, width: 1200, height: 627, alt: 'A single-line sikku kolam of 225 dots in white rice flour on an earthen floor' };

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: 'Kolam',
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/`,
    siteName: 'Kolam',
    title: 'Kolam: generative South Indian rice-flour art',
    description: DESCRIPTION,
    images: [PREVIEW],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kolam: generative South Indian rice-flour art',
    description: DESCRIPTION,
    images: [PREVIEW.url],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3a2419' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
