/**
 * Stamp/verify identities in src/data/gallery.json.
 *   npx tsx scripts/gallery-stamp.ts          # rewrite ids from configs
 * Entries are curated by hand; this only keeps their identity fields honest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fullId, generateKolam, normalizeConfig } from '../src/engine';

const file = 'src/data/gallery.json';
const entries = JSON.parse(readFileSync(file, 'utf8'));
for (const e of entries) {
  e.config = normalizeConfig(e.config);
  generateKolam(e.config); // throws if the design is invalid
  e.id = fullId(e.config);
  e.version = e.config.version;
}
writeFileSync(file, JSON.stringify(entries, null, 2) + '\n');
console.log(entries.map((e: { id: string; title: string }) => `${e.id}  ${e.title}`).join('\n'));
