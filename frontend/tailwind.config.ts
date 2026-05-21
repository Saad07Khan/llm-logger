import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'canvas-white': 'var(--color-canvas-white)',
        'bg-off-white': 'var(--color-background-off-white)',
        'surface-cream': 'var(--color-surface-cream)',
        'border-sand': 'var(--color-border-sand)',
        'subtle-gray': 'var(--color-subtle-gray)',
        'canvas-beige': 'var(--color-canvas-beige)',
        'headline-black': 'var(--color-headline-black)',
        'body-black': 'var(--color-body-text-black)',
        'subtle-graphite': 'var(--color-subtle-graphite)',
        'mid-gray': 'var(--color-mid-gray)',
        'footer-gray': 'var(--color-footer-gray)',
        'icon-gray': 'var(--color-icon-gray)',
        'button-text-gray': 'var(--color-button-text-gray)',
        'placeholder-gray': 'var(--color-placeholder-gray)',
        'inactive-icon-gray': 'var(--color-inactive-icon-gray)',
        'accent-violet': 'var(--color-accent-violet)',
        'accent-orange': 'var(--color-accent-orange)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        serif: ['var(--font-serif)'],
      },
      maxWidth: {
        container: 'var(--max-w)',
      },
    },
  },
  plugins: [],
};

export default config;
