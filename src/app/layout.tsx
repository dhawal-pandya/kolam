import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kolam',
  description: 'Deterministic generative kolam — traditional South Indian threshold art, constructed from its rules.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3a2419' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
