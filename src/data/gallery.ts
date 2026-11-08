/**
 * Curated gallery access. The entries live in gallery.json as complete
 * configurations (never as SVG); every artwork is regenerated locally.
 */
import raw from './gallery.json';
import { KolamConfig, fullId, normalizeConfig, toQueryString } from '@/engine';

export interface GalleryEntry {
  id: string;
  title: string;
  description?: string;
  version: number;
  config: KolamConfig;
}

export const GALLERY: GalleryEntry[] = (raw as GalleryEntry[]).map((e) => ({ ...e, config: normalizeConfig(e.config) }));

/** The design shown to a visitor who arrives without a link. */
export function featuredConfig(): KolamConfig {
  return GALLERY[0].config;
}

export function entryHref(e: GalleryEntry): string {
  return `/${toQueryString(e.config)}`;
}

/** Entries whose stored identity no longer matches their configuration. */
export function staleEntries(): GalleryEntry[] {
  return GALLERY.filter((e) => fullId(e.config) !== e.id);
}
