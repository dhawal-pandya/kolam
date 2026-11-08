import type { Metadata } from 'next';
import StudySheet from '@/components/StudySheet';

export const metadata: Metadata = { title: 'Study sheet · Kolam' };

export default function SheetPage() {
  return <StudySheet />;
}
