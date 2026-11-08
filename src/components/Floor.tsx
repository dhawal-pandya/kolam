/**
 * Courtyard floor: a procedurally textured earthen surface (no photograph is
 * bundled, so no third-party image rights are involved). Several layers of
 * seeded SVG noise over a warm terracotta-brown base:
 *   mottling   large, soft patches of darker and lighter earth
 *   wash       a medium-scale tint, as where the floor was wiped with water
 *   grain      fine sand/dust specks
 *   vignette   gently darker edges, as under even daylight
 * One continuous noise field covers the screen, so there are no repeating
 * tiles. The floor stays fixed while the artwork zooms.
 */
export default function Floor() {
  return (
    <svg className="floor" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <filter id="floor-mottle" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.0042" numOctaves="4" seed="7" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.04  0 0 0 -1.5 0.95" />
        </filter>
        <filter id="floor-light" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="23" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.58  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 1.4 -0.72" />
        </filter>
        <filter id="floor-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.85  0 0 0 0 0.72  0 0 0 2.2 -1.25" />
        </filter>
        <filter id="floor-pits" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="41" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.09  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 2.8 -1.55" />
        </filter>
        <radialGradient id="floor-vignette" cx="50%" cy="48%" r="75%">
          <stop offset="55%" stopColor="#1a0d07" stopOpacity="0" />
          <stop offset="100%" stopColor="#1a0d07" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="#6a3b27" />
      <rect width="100%" height="100%" filter="url(#floor-mottle)" />
      <rect width="100%" height="100%" filter="url(#floor-light)" opacity="0.3" />
      <rect width="100%" height="100%" filter="url(#floor-pits)" opacity="0.55" />
      <rect width="100%" height="100%" filter="url(#floor-grain)" opacity="0.32" />
      <rect width="100%" height="100%" fill="url(#floor-vignette)" />
    </svg>
  );
}
