# Kolam

A deterministic generative studio for Indian kolam, the rice-flour
threshold art. Every design is *constructed* from the rules of its tradition
(dot lattices, mirror curves, symmetry orbits), rendered as SVG, and
identified by a reproducible ID and URL.

- **Sikku**: one continuous interlaced line around every dot.
- **Kambi**: closed, non-crossing wire loops hugging rows of dots.
- **Pulli**: petals, arcs and lines joining the dots.
- **Yantras**: Ganapati yantra, Sri Chakra, Shatkona yantra and Kubera kolam,
  each drawn in one fixed, documented form. They are not varied by the seed.

The construction rules, the conventions chosen where sources disagree, and
the proofs behind which symmetries are offered are in
[docs/CONSTRUCTION.md](docs/CONSTRUCTION.md).

## Running

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # determinism, geometry, identity, full-space validity sweep
npm run build      # static export to ./out
```

Routes:
- `/` is the full-screen studio. It opens the featured gallery design, or
  the design named by the URL.
- `/gallery/` is the curated gallery.
- `/sheet/` is the visual test sheet: every family, arrangement and symmetry
  side by side, re-seedable.

Keyboard shortcuts in the studio:

| Key | Action |
|---|---|
| G or space | generate |
| + / − | zoom |
| 0 | fit |
| S | settings |

Mouse wheel, drag, pinch and double-click also zoom and pan.

## Layout

```
src/engine/          pure TypeScript generation engine (no React, no DOM)
  rng.ts             Mulberry32 + FNV-1a/fmix32 seeding, named sub-streams
  config.ts          schema, supported combinations, normalisation
  identity.ts        KLM identity, config hash, canonical URL
  symmetry.ts        groups, realisation as dot/edge permutations, orbits
  lattice/           dot arrangements as plane graphs (faces, rotation system)
  medial.ts          mirror-curve construction: trace loops, smooth geometry
  families/          sikku.ts, kambi.ts, pulli.ts strategies
  validate.ts        construction-specific validation
  geometry/          vectors, cubic Béziers, intersections
src/render/          clean and organic (rice-flour) SVG renderers, layout
src/components/      viewer, zoom/pan canvas, settings modal, floor, gallery
src/data/gallery.json curated entries (configurations only, never images)
scripts/             visual-sheet.ts, gallery-stamp.ts, golden.ts
tests/               vitest suites; golden-v1.json pins version-1 output
```

## Determinism

The same seed, configuration and generator version always give an identical
design, down to the organic powder grain. `Math.random` is never used in the
engine or renderers; a test enforces this. The canonical URL holds the full
configuration, for example:

```
/?id=KLM-008027-R4-5-S-1&arr=diamond&grid=4&dens=standard&curve=5&orn=5&render=organic
```

## Gallery

Add an entry to `src/data/gallery.json` with a title, an optional
description and a complete `config`. Then run `npx tsx
scripts/gallery-stamp.ts` to validate it and stamp its identity. The first
entry is the design shown on arrival.

## Deployment (GitHub Pages)

The site is published to the `gh-pages` branch, which GitHub Pages serves at
https://dhawal-pandya.github.io/kolam/.

A versioned pre-push hook (`.githooks/pre-push`) does it automatically. When
you `git push` the `main` branch, it:

1. Checks that you are pushing exactly the checked-out commit, with a clean
   working tree and nothing on `origin/main` that you don't have.
2. Runs `npm test`.
3. Builds the static export with `PAGES_BASE_PATH=/kolam`, so assets and
   links resolve under the project sub-path, and adds `.nojekyll`.
4. Commits `out/` onto `gh-pages` using a throwaway index (your working
   tree and branch are untouched), then pushes `gh-pages`.
5. Exits, and git continues pushing `main`.

If tests or the build fail, the push of `main` is aborted and nothing is
published. Pushes of other branches are not affected.

- **Setup:** `npm install` runs `prepare`, which sets
  `git config core.hooksPath .githooks`. A fresh clone needs only
  `npm install`.
- **Skip once:** `SKIP_PAGES_DEPLOY=1 git push`.
- **Deploy by hand:** `npm run deploy:pages`. Add `DRY_RUN=1` to build and
  commit `gh-pages` locally without pushing.
- **One-time:** in the repository's Settings → Pages, set *Source: Deploy
  from a branch*, branch `gh-pages`, folder `/ (root)`.

`npm run build` without the variable builds for the site root, and is also
deployable to any static host: Netlify, Vercel or S3. Designs are addressed
by query string, so no rewrite rules are needed anywhere.

## Background

The courtyard floor is a procedural SVG texture: layered seeded noise over a
terracotta-brown base, with no repeating tiles. No photograph is bundled,
so no image licensing is involved. To use a photograph instead, place a
licensed top-down image at `public/floor.jpg` and swap it into
`src/components/Floor.tsx`.
