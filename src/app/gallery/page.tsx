import type { Metadata } from 'next';
import GalleryGrid from '@/components/GalleryGrid';

export const metadata: Metadata = { title: 'Gallery · Kolam' };

export default function GalleryPage() {
  return <GalleryGrid />;
}
