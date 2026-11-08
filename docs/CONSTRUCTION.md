# Construction rules and conventions (generator version 1)

This document records how each kolam family is constructed, which
traditional conventions were chosen where sources disagree, and the
mathematical results that decide which configurations are offered.

## 1. Terminology and the chosen convention

Sources use *pulli*, *sikku* and *kambi* inconsistently. "Pulli kolam" names
any dot-based kolam. Both "sikku" (knot) and "kambi" (wire) are used for lines
that run *around* dots, and some sources treat them as synonyms.
Wikipedia's article distinguishes dots *joined* by straight or winding lines
from dots *circumvented* by a single continuous line with crossings. Other
sources describe kambi as "closed loops" or "wire- and thread-like".

This engine fixes three distinct construction systems:

| Family | Lines relative to dots | Crossings | Continuity |
|---|---|---|---|
| **Pulli** (dot-joining) | strokes *join* dots | never (strokes meet only at dots) | one connected figure |
| **Kambi** (wire) | lines go *around* dots | never | every line a closed loop; several may nest |
| **Sikku** (interlaced) | lines go *around* dots | yes, transversal "X" between dots | a single closed line (see §4.3) |

Sources: Wikipedia, *Kolam*; Ascher, "The Kolam Tradition", *American
Scientist* 90 (2002); Gerdes, *Sona Geometry* (mirror curves); Jablan,
"Mirror generated curves" (1995); Yanagisawa & Nagata, "Fundamental study on
design system of kolam pattern", *Forma* 22 (2007); Nagata, "Digitalization
and analysis of traditional cycle patterns in the world", *Forma* 30 (2015);
Gopalan & VanLeeuwen, "Symmetry classification and enumeration of
square-tile sikku kolams" (2023).

## 2. Dot arrangements

All arrangements are plane graphs centred on the origin. Dots are vertices.
Edges join *lattice neighbours*, which are the pairs a line may pass between
or join.

- **square** `n × n` orthogonal grid (neer pulli). Lines in the interlaced
  families run diagonally.
- **rectangle** `w × h` orthogonal grid.
- **diamond** `|x| + |y| ≤ r`: rows of 1-3-5-…-5-3-1 dots.
- **hexagonal**: triangular lattice clipped to a regular hexagon (six
  neighbours per dot).
- **radial**: a central dot and concentric rings. Ring *k* holds `N·m_k`
  dots, where *N* is the symmetry order and *m_k* keeps neighbours about one
  unit apart. Dots on adjacent rings are joined when their angular cells
  overlap, which is planar and exactly *N*-fold symmetric. This modern
  circular layout is offered for Pulli and Kambi only.

Each dot carries a **band**: its concentric layer, counted from the outer
boundary (0). For the diamond, two Manhattan layers form one closed staircase
band. Bands drive the concentric motif structure of Pulli and Kambi.

## 3. Symmetry engine

A symmetry is a finite group of orthogonal maps about the origin:

| Setting | Group | Elements |
|---|---|---|
| Bilateral horizontal | D1 | identity, mirror in the horizontal line |
| Bilateral vertical | D1 | identity, mirror in the vertical line |
| Four-way | D2 | both mirrors and the half turn |
| Rotational *n* | C*n* | rotations by 2π*k*/*n* |
| Dihedral *n* | D*n* | rotations and *n* mirror lines |

The group is realised as permutations of dots and edges by exact position
lookup. An arrangement that is not mapped onto itself is rejected. This is
how a square grid is barred from 6- or 8-fold rotation (crystallographic
restriction), and a non-square rectangle from 4-fold.

**Construct, never symmetrise.** Every construction decision is made once
per *orbit* (an equivalence class of edges or strokes under the group). The
orbit representative is its element in the fundamental region. Whatever is
chosen is replicated by every group element, so the output is exactly
symmetric. Validation then checks symmetry geometrically: every sampled
point, mapped by every group element, lies on the drawing.

Offered symmetries per arrangement:

| Arrangement | Pulli / Kambi | Sikku |
|---|---|---|
| square, diamond | BH, BV, FW, R2, R4, D4 | BH, BV, FW, R2, R4 |
| rectangle | BH, BV, FW, R2 | BH, BV, FW, R2 |
| hexagonal | BH, BV, FW, R2, R3, R6, D3, D6 | BH, R2, R3, R6, D3 |
| radial (N rings) | R*N*, D*N* for *N* ∈ {6, 8, 10, 12, 16} | — |

## 4. The medial-graph (mirror-curve) construction: Sikku and Kambi

A line that goes around dots never touches one. Between each pair of
neighbouring dots P and Q, at the midpoint of PQ, it does exactly one of
three things. This is the mirror-curve model of Gerdes and Jablan, and the
medial graph of the dot graph in Nagata's analysis:

- **cross**: two strands cross diagonally (no mirror);
- **split**: the line turns back on each side, wrapping P and Q separately
  (a mirror perpendicular to PQ);
- **join**: the line runs past P and Q together, so they share one cell
  (a mirror along PQ).

Around each dot the line passes through the *corners* between consecutive
neighbour directions. A state per edge determines the line completely. The
engine traces it into closed loops and counts them.

**Geometry.** One clearance ρ (the distance an undisturbed diagonal strand
passes a dot: 0.354 on the square lattice, 0.433 on the triangular) governs
every way a line passes a dot:
- diagonally;
- turning (split points at ρ along the edge);
- wrapping the outside (way-points at ρ);
- running alongside (join offset).

The join offset is further capped by `0.75 · (L/2) · tan(θ/2)` for the sector
angle θ. Without the cap, two join strands in a narrow 60° triangle corner
meet beyond the midpoint and the corner folds back. Each corner is drawn as
one or more cubic Béziers whose handles follow the circular-arc
approximation `h = chord · (2/3) · tan(θ/4) / sin(θ/2)`. Consecutive corners
share point and tangent, so every loop is G1-smooth. The curvature setting
scales ρ and the handles.

### 4.1 Sikku rules

1. The line never touches a dot, and every dot lies in its own cell (states
   are cross or split only; never join).
2. Between neighbouring dots the line crosses or turns.
3. The line is smooth and closed.
4. It is **one continuous line** (eka-rekha).

Algorithm: start with every edge crossing (the "all-diagonal weave"). Place
mirror orbits in a seeded order biased toward the outer bands. Following
Gerdes, a mirror where two different lines cross fuses them. If greedy
merging stalls on a plateau, a seeded local search continues, accepting
neutral moves (adding or removing a mirror orbit without increasing the line
count). Once there is one line, ornamental mirrors are added only if it
stays one line. Each dot keeps at least two crossings (one at the diamond's
staircase dots and tips), so no dot is boxed in by mirrors.

### 4.2 Why Sikku offers no dihedral symmetry on square or diamond grids

Take a mirror line that passes *through dots between lattice directions*:
the diagonals of the square lattice, or the hexagonal lattice's mirrors
perpendicular to its rows. It bisects the corner of each dot it passes
through. By symmetry, the two edges bounding that corner have equal states,
and in every state the strand in the corner crosses the mirror at right
angles. Each such point is fixed by the reflection.

So the reflection fixes at least 2 points per dot on the axis: 2*n* on an
*n* × *n* grid. But a reflection that maps a single closed curve to itself
fixes at most two of its points: it acts on the curve as an involution of a
circle, which is either fixed-point-free or a reflection of the circle with
exactly two fixed points. Hence such a design needs at least *n* separate
lines.

This is confirmed exhaustively: over every D4-symmetric mirror
placements on 5 × 5 the minimum is 5 lines (`tests/geometry.test.ts`).
Mirrors that run *along* lattice lines (bilateral, four-way, the hexagonal
D3) do not bisect corners and remain available.

### 4.3 Grid parity for point-symmetric Sikku

When the group contains the half turn (four-way, R2, R4, R6) and both grid
dimensions are even, the centre is a cell rather than a dot, and no
symmetric mirror placement yields one line. The exhaustive minimum is 2 on
4 × 4 and 6 × 6; odd × even rectangles reach 1. Such grids are bumped to
the nearest odd size, so the dot count always matches the construction.

### 4.4 Kambi rules (convention adopted)

1. Lines wrap around dots like bent wire and **never cross** (states are
   split or join only). The interlaced variant is Sikku.
2. Every line is a closed loop; several may nest.
3. Every dot is enclosed; no line touches a dot.
4. Between neighbouring dots a line passes between them or wraps both.
5. **Concentric wiring.** Wired and loose bands strictly alternate (the
   outer band is wired in most designs). Whole wired bands are joined into
   rings, so each ring is hugged by a wire on both sides.
6. **Spurs.** A wired ring reaches out to a dot in the neighbouring loose
   band, and the wire bends around it. Spurs from both sides meeting at a
   dot thread the wires into a meander. Every band gap gets at least one
   spur orbit.
7. **Wires stay one dot thick.** At most two sides of any lattice cell are
   joined (the central cell excepted). Three would fold the wire into a
   pocket; four would pinch off an empty window. Either turns a hugging wire
   into a slab of loose dots.

## 5. Pulli rules (dot-joining)

1. Strokes run only between lattice neighbours: along a lattice edge, or
   across the diagonal of a square cell.
2. Each stroke is a traditional joining mark: a straight line (*kodu*), a
   petal/leaf (two arcs meeting at both dots), or a single arc. An arc bows
   outward or inward, or swirls; swirling is allowed only with rotational
   symmetry, since a reflection would mirror it.
3. Strokes meet only at dots; they never cross or touch elsewhere. This is
   enforced incrementally with an intersection test as each orbit is placed.
4. Every dot is used (no orphan dots), and the drawing is one connected
   figure through its dots. Connectivity repair adds symmetric orbits until
   this holds.
5. Motifs are planned per concentric band:
   - one ring style per band (the outer band is always drawn);
   - one spoke style for the whole figure;
   - per-band switches for spokes and diagonal leaves.

   Where strokes crowd a dot, petals and arcs are slimmed (never silently
   straightened) so that strokes leave each dot at least 10° apart.

## 6. Validation (all families)

Validation is construction-specific; failure triggers a retry with the next
deterministic candidate (`attempt-k` sub-seeds). If no candidate passes, a
controlled error is raised. It never falls back to arbitrary geometry.

- **Degenerate geometry:** no degenerate segments; paths are continuous and
  closed where required.
- **Bounds:** everything stays within the dot hull plus one lattice unit.
- **Intersections:**
  - Sikku: only at intended crossing midpoints.
  - Kambi: none.
  - Pulli: only at dots.
- **Dot clearance (line families):** at least 0.12 lattice units.
- **Symmetry:** exact, checked by mapping sampled points.

## 7. Determinism

- **PRNG:** Mulberry32 (32-bit state), output `u32 / 2^32`.
- **Seeding:** FNV-1a over a label string, finalised by MurmurHash3
  `fmix32`. The root stream is `hash('kolam', version, seed)`.
- **Sub-streams:** derived by `fork(label)` from the parent's *seed*, not
  its position, so adding a consumer never perturbs another.
- **No `Math.random`:** it is never used in `src/engine` or `src/render`
  (enforced by a test).

The only use of platform randomness is choosing a *new* seed when you press
Generate (`crypto.getRandomValues`). The design is then determined by that
seed.

The organic renderer derives its turbulence seeds and particle positions
from the same root seed and the full identity, so organic texture is as
reproducible as geometry.

## 8. Identity, URL and versioning

The short identity has the form
`KLM-<seed:6>-<symmetry>-<complexity>-<family>-<version>`, for example
`KLM-839172-R4-7-S-1`.

| Field | Codes |
|---|---|
| symmetry | `BH` mirror line horizontal, `BV` mirror line vertical, `FW` four-way, `R<n>` rotational, `D<n>` dihedral |
| family | `P` pulli, `K` kambi, `S` sikku |

The **full identity** appends 4 base-36 characters hashing every
output-affecting field (arrangement, grid, density, curvature,
ornamentation, render), for example `KLM-839172-R4-7-S-1.JJQV`. Two designs
that differ in any parameter never share a full identity.

The **canonical URL** carries the complete configuration on the root path,
so any static host serves it without rewrite rules:

```
/?id=KLM-008027-R4-5-S-1&arr=diamond&grid=4&dens=standard&curve=5&orn=5&render=organic
```

Unsupported or malformed identities are refused with an error, never
silently rewritten.

**Versioning.** `generator version` is part of every identity and config.
`tests/golden-v1.json` stores geometry fingerprints of reference designs; a
change that alters version-1 output fails those tests and must instead ship
as version 2, with version 1's code paths kept intact. Unknown versions are
rejected.

## 9. Configuration schema (v1)

| Field | Values |
|---|---|
| `version` | `1` |
| `seed` | 0 … 999 999 |
| `family` | `pulli` · `kambi` · `sikku` |
| `symmetry` | `bilateral-h` · `bilateral-v` · `four-way` · `rotational` · `dihedral` |
| `symmetryCount` | 1 (bilateral) · 2 (four-way) · *n* |
| `complexity` | 1 … 9 (Simple 1–2, Moderate 3–4, Intricate 5–6, Very intricate 7–9) |
| `arrangement` | `square` · `rectangle` · `diamond` · `hexagonal` · `radial` |
| `grid` | `{w, h}`: columns × rows, or radius/ring count (`w = h`) |
| `density` | `sparse` · `standard` · `dense` (shifts the auto grid one tier) |
| `curvature` | 0 … 10 |
| `ornamentation` | 0 … 10 |
| `render` | `clean` · `organic` |

The grid defaults from complexity and density. Complexity 9 on a square grid
is the traditional 15 × 15, 225-dot "woven cloth". The resolved grid is
always recorded in the config and URL.

## 10. Scale and stroke

All geometry is in lattice units, and the SVG is fitted to the viewport, so
on-screen thickness follows from the canvas size and the pattern extent.

| Measure | Value |
|---|---|
| stroke | `unit × ratio` (Sikku/Kambi 0.135, Pulli 0.10, thinning slightly with complexity), capped at 0.62 × the narrowest strand gap |
| dot diameter (Sikku/Kambi) | 1.45 × stroke |
| dot diameter (Pulli) | 2.3 × stroke; the dots are the joints there |

A 3 × 3 design therefore draws bold finger-width lines, and a 15 × 15 one
fine, cloth-like lines.

## 11. Named yantras

A yantra is not a dot-lattice kolam. It is a centred, layered diagram, built
out from the bindu through triangles, circles and lotus petals to the square
bhupura. It is also drawn in rice flour, as a floor yantra or yantra kolam.

Each named yantra is drawn in **one fixed, documented form**. Because these
are sacred diagrams, the engine does not vary them: the seed only seeds the
organic powder texture, and the geometry is identical for every seed (this is
tested). Where sources disagree, the choice is recorded below.

### Shared elements

- **Bhupura.** Three nested square lines with a T-shaped gate at the middle
  of each side (the "earth square" whose four doors open to the four
  directions).
  - The outer lines are exact rectilinear offsets of the inner outline, so
    the spacing stays even.
  - Each offset shortens a gate stem by twice the spacing, so the inner stem
    is lengthened by that amount to keep every stem positive.
- **Lotus (dala).** *n* petals whose bases tile a circle and whose pointed
  tips reach an outer radius.
- **Shatkona.** An upward and a downward equilateral triangle inscribed in
  one circle.

### The yantras

| Yantra | Identity | Form | Symmetry | Inscription |
|---|---|---|---|---|
| Ganapati | `YG` | bhupura (3 lines, 4 gates) → circle → 8-petal lotus → circle (vritta) → shatkona → trikona | BV (vertical mirror only) | bija **गं** at the centre |
| Sri Chakra | `YS` | bhupura → 3 circles → 16-petal lotus → circle → 8-petal lotus → circle → 9 triangles → bindu | BV | bindu only |
| Shatkona | `YH` | bhupura → circle → shatkona → bindu | FW (both mirrors) | bindu only |
| Kubera kolam | `YK` | 3 × 3 grid of lines with numerals | D4 (grid lines) | numerals २०–२८ (20–28) in Devanagari digits |

**Ganapati.** The order follows a description of the Ganesha yantra as a
square, inside it an eight-petalled lotus, inside that a hexagon with a
triangle at its centre; installation texts assign the petals and four gates
to forms of Ganapati.
- The trikona points downward and touches the shatkona's inner hexagon at
  its edge midpoints (radius *R*/2).
- The bija गं stands in place of the bindu inside it. The downward trikona
  is why only the vertical mirror holds.

**Sri Chakra.** The nine triangles use the classical inward construction
from Kaivalyashrama's commentary on the Saundarya-lahari.
- The vertical diameter is 48 units, with horizontal lines at 6, 12, 17, 20,
  23, 27, 30, 36 and 42 from the top.
- The ends are trimmed by 3, 5, 0, 16, 18, 16, 0, 4 and 3 units.
- Each line's ends are joined to an axis point at 27, 42, 48, 36, 30, 12, 0,
  6 and 17 units. This gives 5 downward and 4 upward triangles.
- The layers (16- and 8-petal lotuses, bhupura) follow the standard
  description.
- The method is known to be a close approximation: some triple intersections
  are not exactly concurrent. It is used here because it is the documented
  traditional method, not an optimised reconstruction.
- The bindu is placed at the centre (some drawings place it just above the
  base of the innermost triangle).
- No bija is inscribed: documented forms mark the centre with the bindu.

**Shatkona.** The shatkona is well attested as the sign of Kartikeya
(Subramanya). I found no verifiable source for a petal count or a bija
specific to a Subramanya yantra, so neither is drawn; the form is shatkona,
circle, bhupura and bindu.

**Kubera kolam.** This is the rice-flour magic square of the numbers 20–28,
drawn on house floors in South India. Every row, column and diagonal sums
to 72 (tested).

| | | |
|---|---|---|
| 27 | 20 | 25 |
| 22 | 24 | 26 |
| 23 | 28 | 21 |

The lines are drawn first; no frame, lotus or bindu is described, so none is
added. The numbers are written in Devanagari digits (२७ २० २५ / २२ २४ २६ /
२३ २८ २१). Each cell's number is laid out on the shared baseline band of all
ten digits, so the cells sit level. The numerals are the inscription, so
only the grid lines carry the square's symmetry.

**Lakshmi yantra.** Not included: no verifiable source for its geometric form
was found.

### Inscriptions

The bija syllable and the Devanagari numerals are embedded glyph outlines
from Noto Sans Devanagari (SIL Open Font License 1.1), not live text. This
means the letterforms are correct and the rendering is identical on every
device, with no dependence on installed fonts. In the organic style they
pass through the same powder filter as the lines.

**Validation.** Yantra lines intersect by design (interlocking triangles), so
yantras are validated for:
- exact symmetry of all lines and the bindu;
- non-degenerate segments;
- closure of closed shapes.

Inscriptions are exempt from symmetry.

**Sources.**
- Ganesha yantra: hinduonline.co, *Ganesha*; enfolding.org, *Ganesayantra
  installation*.
- Sri Yantra: Wikipedia, *Sri Yantra*; sriyantraresearch.com, *Inward
  classic construction*.
- Shatkona: Wikipedia, *Shatkona*.
- Kubera kolam: Wikipedia, *Kuberakolam*; Chantal Jumel, *The household
  deities*.
