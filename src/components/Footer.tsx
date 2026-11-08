/** Small credit line. `overlay` floats over the studio; `page` ends a scrolling page. */
export default function Footer({ variant = 'page' }: { variant?: 'overlay' | 'page' }) {
  return (
    <footer className={`credit credit-${variant}`}>
      Made with <span aria-label="love">❤️</span> by{' '}
      <a href="https://dhawal-pandya.github.io/" target="_blank" rel="noopener">
        Dhawal Pandya
      </a>
    </footer>
  );
}
