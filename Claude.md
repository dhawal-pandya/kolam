# Project: Kolam — A Deterministic Generative Kolam Art Studio

## 1. Product vision

Build a beautiful, minimalist web application that procedurally generates traditional South Indian kolam designs.

The application should feel less like a drawing tool and more like an art gallery displaying an endless collection of mathematically constructed kolams.

The central experience:

- A visitor opens the application.
- A beautiful, intricate white kolam is already displayed, occupying most of the screen.
- The artwork sits on a rustic, earthy courtyard surface, ideally a realistic top-down photograph.
- The visitor can generate another kolam.
- A discreet settings button opens a modal containing the generation controls.
- Every generated design has a unique, deterministic identity.
- A given seed and configuration must always reproduce exactly the same design.

The application must prioritise the quality of the generated artwork over the number of features.

This is a small, polished project. Do not over-engineer it into a large platform.

### Core philosophy

There are three non-negotiable principles:

1. Traditional authenticity: designs must follow the actual construction rules of their respective kolam styles.
2. Mathematical correctness: symmetry, connectivity, valid dot arrangements and geometric constraints must be enforced by the generation engine.
3. Artistic quality: the resulting kolam should look like something a skilled person could draw with rice flour on a courtyard floor.

Do not generate arbitrary mandalas, random Bézier curves or mirrored geometric decorations and call them kolams.

---

## 2. Kolam styles

Implement the generation engine as separate strategies for different kolam families.

### A. Pulli Kolam

This is one of the primary generation styles.

Characteristics:
- Constructed around a mathematically valid arrangement of dots.
- Dots form deliberate traditional arrangements.
- Lines and curves connect, surround or weave around these dots according to the chosen construction.
- The pattern must be symmetrical according to its configuration.
- The dot arrangement must be valid for the selected construction.
- The final artwork should have a traditional kolam appearance rather than resemble a generic geometric mandala.

Support different valid dot arrangements, such as:
- Square grids.
- Rectangular grids.
- Diamond arrangements.
- Other traditional arrangements where their construction rules are understood and implemented.

Do not arbitrarily place dots and connect them with random curves.

The generator must know which arrangements are valid for each pattern family.

### B. Kambi Kolam

This is the other primary generation style.

Treat it as a distinct construction family, not a Pulli Kolam rendering preset.

Characteristics:
- Traditional line-based kolam geometry.
- Repeating motifs.
- Deliberate loops and curved structures.
- Strong geometric symmetry.
- Carefully balanced positive and negative spaces.
- Patterns that can become increasingly elaborate as complexity increases.

Research and implement authentic Kambi construction conventions. Do not invent arbitrary ornamental motifs to simulate traditional geometry.

Where different interpretations of Kambi construction exist, document the chosen convention.

### C. Sikku Kolam

Support this as a separate, explicitly selectable generation style.

Do not make Sikku the default.

Characteristics:
- Interwoven continuous paths.
- Construction around dot arrangements.
- Valid loops and crossings according to the selected Sikku tradition.
- Continuous-line properties where required.
- Traditional ornamental complexity.

Sikku must have its own topology and validation logic.

Do not simply add decorative flourishes to Pulli or Kambi patterns and label them Sikku.

### Important restriction

Freeform rangoli generation is explicitly out of scope.

The engine must always generate patterns from a defined construction system.

---

## 3. Symmetry engine

Support the following symmetry configurations:

1. Bilateral horizontal symmetry.
2. Bilateral vertical symmetry.
3. Four-way symmetry.
4. Rotational symmetry with configurable segment counts.
5. Dihedral symmetry (rotations combined with reflections).

Examples of rotational symmetry:
- 4-fold
- 6-fold
- 8-fold
- 10-fold
- 12-fold
- 16-fold

The generator must ensure that the selected kolam construction is compatible with the selected symmetry.

Do not assume every symmetry type is valid for every kolam family.

If a particular combination is not supported, prevent it from being selected or provide a valid alternative.

### Implementation

Use a canonical coordinate system.

Generate geometry in a canonical region and apply symmetry transformations mathematically.

Avoid generating the entire pattern independently and attempting to make it symmetrical afterwards.

For rotational symmetry, construct a valid fundamental sector and transform it using rotations.

For bilateral symmetry, construct a valid half-region and reflect it.

The final output must be geometrically symmetrical, not merely visually approximate.

---

## 4. Generation engine

The generation engine is the most important part of the application.

Implement it as a standalone, pure TypeScript module, independent of React and the UI.

### Deterministic generation

Every design must be generated from a deterministic seed.

Use a seeded pseudorandom number generator with a documented algorithm.

Never use Math.random() anywhere in the generation or rendering pipeline.

The following must always hold:

Same seed + same parameters + same generator version = identical design.

This applies to:
- Dot placement.
- Path construction.
- Curve selection.
- Motif selection.
- Organic rendering irregularities.
- Powder texture variation.
- Particle distribution.

All randomness must come from the same deterministic generation context or explicitly derived sub-seeds.

### Generation parameters

Support the following configuration:

- Seed.
- Kolam family.
- Symmetry type.
- Symmetry count.
- Complexity.
- Dot arrangement.
- Grid dimensions.
- Dot density.
- Curvature.
- Ornamentation, where supported.
- Stroke rendering style.
- Generator version.

Not every parameter needs to be exposed in the UI initially.

Some parameters may be derived from complexity or selected automatically, provided the resulting configuration is recorded.

### Validity

The engine must never knowingly generate an invalid construction.

In particular:
- Do not generate impossible dot counts for a selected construction.
- Do not create incomplete or disconnected paths where continuity is required.
- Do not generate unintended self-intersections.
- Do not violate symmetry.
- Do not leave orphaned dots.
- Do not generate degenerate curves.
- Do not allow paths to extend outside the intended drawing region.

Use construction-specific validation rather than generic visual checks.

A failed generation should produce a controlled error or retry with another deterministic candidate. It must never silently fall back to arbitrary geometry.

---

## 5. Scale, density and stroke thickness

This is a particularly important visual requirement.

The artwork should occupy almost the entire available viewport.

The application should not display a small kolam floating in the middle of a huge empty canvas.

### Scale behaviour

The artwork should automatically scale according to:
- Available screen width.
- Available screen height.
- Number of dots.
- Grid dimensions.
- Pattern complexity.

The design must retain a consistent visual language at different sizes.

### Stroke thickness

Think of the kolam as having been drawn by a person using their finger to lay down rice flour.

The default strokes should be substantially thicker than ordinary vector illustrations.

Dots and strokes should have a consistent visual thickness.

For a simple circular kolam:
- The central dot should be visibly substantial.
- The surrounding circle should be thick.
- The overall artwork should almost touch the edges of the available drawing area.

For a highly complex kolam:
- Dots and strokes should become proportionally smaller.
- The pattern should become increasingly dense.
- A 225-dot pattern should look like an intricately woven cloth.
- Individual details should still be distinguishable when zoomed in.

Do not use a fixed SVG stroke width for all designs.

Derive the stroke width from the pattern dimensions and available canvas dimensions.

Use a consistent geometric relationship between dot diameter, stroke width and grid spacing.

### Zoom

Support zooming and panning for intricate designs.

Zooming must not change the underlying geometry or seed.

The initial view should always fit the complete artwork.

---

## 6. Rendering engine

Use SVG as the primary rendering format.

The underlying generated design should be represented as geometric paths and points, not as a raster image.

This allows:
- Resolution-independent output.
- Precise symmetry.
- Consistent zooming.
- Future SVG export.
- Deterministic rendering.

### Two rendering modes

The application must support two distinct rendering approaches.

**Mode A: Mathematical / clean**

- Perfectly smooth curves.
- Consistent stroke thickness.
- Exact symmetry.
- Clean geometric edges.
- No accidental imperfections.

**Mode B: Organic / traditional**

- Slightly irregular rice-flour edges.
- Subtle powder grain.
- Minor deterministic variations in powder density.
- Organic stroke texture.
- Tiny variations in the edges without changing the underlying geometry.

Both modes must use exactly the same underlying kolam geometry.

The difference is purely in presentation.

Do not compromise geometric validity to achieve organic rendering.

### Powder rendering

The organic renderer should simulate rice flour rather than white paint.

Consider:
- A subtle granular texture.
- Slightly rough stroke edges.
- Small variations in powder density.
- Very subtle particle dispersion around strokes.
- Natural-looking joins between lines.

Keep the effect restrained.

The artwork must remain clearly readable and predominantly white.

Do not make it look like chalk graffiti, paintbrush strokes or a neon illustration.

All rendering irregularities must be deterministic.

---

## 7. Background and environment

The preferred background is a realistic, top-down photograph of a traditional Indian courtyard.

The photograph should ideally have:
- An earthen, brown or warm terracotta floor.
- Relatively uniform lighting.
- A flat, horizontal camera perspective.
- Minimal distracting objects.
- Enough uninterrupted surface area to accommodate large designs.

The kolam must appear as if it has been drawn directly on the floor.

The background should never dictate the size or shape of the generated artwork.

If a suitable photograph cannot be sourced, use a generated CSS/SVG texture or a carefully designed earthy background.

The fallback should have:
- Dark warm brown or terracotta tones.
- Subtle surface irregularities.
- Natural-looking grain.
- No obvious repeating texture tiles.

Keep the contrast between the white kolam and the floor high.

Do not add decorative borders or unrelated illustrations.

Background assets must have appropriate usage rights.

---

## 8. Application interface

The application should feel like an art gallery, not a dashboard.

### Main screen

The initial screen should contain:

1. A full-screen kolam artwork.
2. A discreet settings button.
3. A Generate button.
4. A compact kolam identity display.
5. An optional zoom control or gesture support.

The artwork is the main attraction.

Avoid:
- Large headers.
- Sidebars.
- Persistent control panels.
- Excessive labels.
- Unnecessary cards.
- Decorative UI elements competing with the artwork.

Use restrained typography.

The controls should be visually secondary.

### Settings modal

Clicking the settings button should open a clean modal.

The modal should contain:

**Kolam family**
- Pulli
- Kambi
- Sikku

**Symmetry**
- Bilateral horizontal
- Bilateral vertical
- Four-way
- Rotational
- Dihedral

**Complexity**
- Simple
- Moderate
- Intricate
- Very intricate

**Rendering**
- Mathematical
- Organic

**Additional controls**
- Dot density.
- Curvature.
- Ornamentation, where applicable.
- Seed input.
- Advanced grid configuration, if appropriate.

Only expose combinations supported by the generation engine.

Do not show meaningless controls for a particular kolam family.

The modal should also show the current design identity.

Clicking Generate should close the modal and display the new artwork.

Allow users to generate a new design without opening settings.

---

## 9. Deterministic identity system

Every generated kolam must have a stable identity.

Use a human-readable identity such as:

KLM-839172-8-7-P-1

Where:
- KLM = Kolam.
- 839172 = Seed.
- 8 = Symmetry count.
- 7 = Complexity.
- P = Pulli.
- 1 = Generator version.

Define equivalent codes for:
- Kambi.
- Sikku.
- Bilateral symmetry.
- Four-way symmetry.
- Other supported configurations.

### Full configuration identity

The displayed identity must also account for all generation-affecting parameters.

For example, two designs with the same seed and symmetry but different dot arrangements must not have the same complete identity.

Include additional encoded fields or a compact configuration hash.

The canonical URL must contain the complete configuration, not just the short display identity.

Suggested URL structure:

/kolam/KLM-839172-8-7-P-1?grid=15x15&arrangement=square&render=organic

This is illustrative. Define the final URL structure consistently.

### Versioning

The generator version must be explicit.

A future change to the generation algorithm must not silently change the appearance of old designs.

A design generated under version 1 must remain reproducible under version 1.

Keep the seed algorithm, configuration schema and generation version documented.

---

## 10. Gallery architecture

Do not build a backend or user authentication system.

Create a simple curated gallery section that can be populated manually.

The gallery should contain selected kolams represented by their canonical identities or URLs.

Each gallery entry should be reproducible directly from its configuration.

Clicking an entry should open the exact kolam in the main artwork view.

The gallery should eventually be suitable for showcasing a carefully selected collection of the best generated designs.

Do not automatically add every generated design to the curated gallery.

Keep the gallery data separate from the generation engine.

---

## 11. Sharing and export — future-ready, not MVP scope

Sharing is deferred.

However, the architecture must make it possible to share a kolam simply by sharing its canonical URL.

Opening that URL must reconstruct the exact same design.

Do not introduce a backend merely to support this.

Do not implement social sharing, accounts or cloud persistence in the first version.

Keep the generation configuration serialisable and URL-friendly.

PNG and SVG export can be added later without changing the generation engine.

---

## 12. Recommended technical stack

Use the following stack unless the existing repository has a compelling reason to differ.

- Next.js.
- TypeScript.
- React.
- SVG for geometric rendering.
- CSS for layout, modal interactions and background styling.
- A pure TypeScript procedural generation module.

Keep dependencies lean.

Do not introduce a database, server-side generation service, external API or complex state management library.

### Suggested architecture

Separate the code into the following logical modules:

**Generation**
- Seeded random number generator.
- Configuration schema.
- Symmetry transformations.
- Dot arrangement generation.
- Pulli generation.
- Kambi generation.
- Sikku generation.
- Geometry validation.

**Geometry**
- Points.
- Lines.
- Curves.
- Paths.
- Transformations.
- Intersections.
- Bounds calculation.

**Rendering**
- Clean SVG renderer.
- Organic powder renderer.
- Background renderer.
- Zoom and pan handling.

**Application**
- Main artwork view.
- Settings modal.
- Generation controls.
- Identity display.
- Gallery.
- URL configuration parser.

The generation engine must not import React components or browser-specific UI logic.

---

## 13. Testing and quality requirements

This project must be tested beyond whether the page renders.

### Determinism tests

For every supported generation strategy:

- Same seed and configuration produce identical geometry.
- Different seeds can produce different valid designs.
- Rendering variations remain deterministic.
- URL reconstruction reproduces the same design.
- Generator versions remain isolated.

### Geometric tests

Test:
- Symmetry invariants.
- Dot arrangement validity.
- Path connectivity.
- Intersection constraints.
- Closed-loop constraints where applicable.
- Geometry bounds.
- Zero-length and degenerate paths.
- Validity across supported complexity levels.

### Visual tests

Generate a representative collection of designs:
- Simple bilateral.
- Simple radial.
- Medium Pulli.
- Intricate Pulli.
- Medium Kambi.
- Intricate Kambi.
- Sikku.
- Clean rendering.
- Organic rendering.

Inspect these visually.

A mathematically valid but aesthetically poor kolam is not an acceptable final result.

Do not declare the generator complete merely because it produces SVG paths.

### Responsive tests

Test:
- Desktop.
- Laptop.
- Tablet.
- Mobile portrait.
- Mobile landscape.

Ensure the artwork remains the dominant element.

Ensure complex designs remain navigable through zoom and pan.

---

## 14. Implementation plan

Build this in deliberate stages.

### Phase 1: Foundation

- Inspect the existing repository.
- Establish the application structure.
- Define the configuration schema.
- Implement deterministic seed handling.
- Implement coordinate systems and symmetry transformations.
- Establish the SVG rendering pipeline.

Do not spend time polishing the UI yet.

### Phase 2: First valid kolam

Implement a small set of genuinely valid Pulli Kolam constructions.

Start with simple patterns.

Verify dot placement, geometry, symmetry and connectivity.

Generate a visual test sheet showing multiple configurations.

Do not proceed until the results look recognisably like traditional kolams.

### Phase 3: Kambi

Implement Kambi as a separate generation strategy.

Focus on authentic line construction and increasingly intricate patterns.

Build construction-specific validation.

### Phase 4: Sikku

Add Sikku as a separate selectable style.

Implement its own topology and path rules.

### Phase 5: Organic rendering

Add the rice-flour renderer.

Create both clean and organic variants.

Ensure they share exactly the same underlying geometry.

### Phase 6: Application UI

Build the full-screen art gallery experience.

Add:
- Settings modal.
- Generate button.
- Identity display.
- Zoom and pan.
- Background.
- Gallery section.

### Phase 7: Reproducibility

Implement:
- Canonical URL parsing.
- Configuration serialisation.
- Stable identity generation.
- Generator version handling.

Test opening an existing URL in a fresh browser session.

### Phase 8: Final polish

Inspect actual generated designs at different complexities.

Refine:
- Stroke thickness.
- Dot size.
- Canvas fitting.
- Background contrast.
- Texture.
- Modal design.
- Responsive behaviour.

Remove unnecessary UI and dependencies.

---

## 15. Agent working instructions

Follow these instructions throughout development.

1. Inspect the repository before making architectural decisions.
2. Work in small, testable milestones.
3. Do not build the entire application as one large component.
4. Do not fake traditional kolam construction with random geometric shapes.
5. Do not sacrifice mathematical validity for visual complexity.
6. Do not introduce arbitrary dot counts that violate the selected construction.
7. Do not use nondeterministic randomness anywhere in the generation pipeline.
8. Do not hardcode a handful of SVG designs and pretend the generator works.
9. Do not over-engineer the application with unnecessary backend infrastructure.
10. Prefer simple, readable, well-separated TypeScript modules.
11. Document the construction rules and assumptions behind each generation family.
12. Run the tests and visually inspect the actual output before calling a milestone complete.

If a traditional construction rule is unclear, research it and document the interpretation before implementing it. Do not silently invent a rule.

If a proposed feature conflicts with traditional construction constraints, preserve the construction constraints.

## 16. Strict frontend-only architecture

This application must be entirely frontend-driven.

There must be no backend, database, API server or server-side generation service.

### Core requirements

- All kolam generation happens inside the browser.
- All geometry calculations happen inside the browser.
- All rendering happens inside the browser.
- All deterministic randomness is generated locally.
- All configuration is reconstructed from URL parameters.
- All curated gallery entries are stored in a static JSON file.
- All background assets are bundled with the application.

### Gallery

Maintain a static gallery configuration at:

`src/data/gallery.json`

Each entry must contain:
- Stable kolam identity.
- Display title.
- Optional description.
- Complete generation configuration.
- Generator version.

Store configurations, not generated SVG or PNG files.

When a gallery entry is opened, regenerate its artwork using the local generation engine.

### URL reconstruction

The URL must contain everything required to reproduce a design.

The application must not depend on server-side state to reconstruct any kolam.

Support direct navigation to a design URL, browser refresh and opening a shared URL in a fresh browser session.

### Persistence

Do not introduce a database.

If local favourites or recent designs are implemented, use browser localStorage.

Keep this optional and separate from the core generation engine.

### Deployment

The finished application should be deployable as a static frontend.

Prefer static generation/export where supported by the chosen Next.js setup.

Ensure that direct navigation to nested kolam URLs works with the deployment provider's routing configuration.

### Architectural prohibition

Do not introduce:
- Backend APIs.
- Authentication.
- Database infrastructure.
- Server-side generation.
- External runtime dependencies for artwork generation.
- Third-party image APIs.

The application must remain self-contained and capable of generating every supported kolam without network access after its assets and application code have loaded.

### Definition of done

The project is complete when:

- It opens directly into a beautiful full-screen kolam.
- Pulli and Kambi generate genuinely distinct, traditional-looking patterns.
- Sikku can be explicitly selected.
- All supported symmetry modes work correctly.
- Designs are mathematically valid.
- Complexity scales naturally from bold, simple designs to dense, intricate ones.
- Clean and organic rendering modes both work.
- The artwork looks like white rice flour on an earthy courtyard.
- The generation process is fully deterministic.
- Every design has a unique, reproducible identity.
- A canonical URL reconstructs the exact same artwork.
- The interface is polished, minimal and responsive.
- The curated gallery can showcase reproducible designs.

**Final guiding principle:**

Build an engine that understands how a kolam is constructed, not an engine that merely understands what a kolam looks like.

The beauty should emerge from the rules themselves.