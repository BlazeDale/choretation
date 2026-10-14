/** Color themes. Each device keeps its own choice, so everyone in the house can pick theirs. */

type Vars = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  brand: string;
  /** Text on top of `brand` (buttons, selected tabs). */
  onBrand: string;
  brandSoft: string;
  danger: string;
  overdue: string;
};

export interface Theme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  vars: Vars;
}

export const THEMES: Theme[] = [
  {
    id: 'meadow',
    name: 'Meadow',
    mode: 'light',
    vars: {
      bg: '#f6f5f1', surface: '#ffffff', text: '#1f2421', muted: '#6b716d', border: '#e2e0d8',
      brand: '#2f855a', onBrand: '#ffffff', brandSoft: '#e3f3ea', danger: '#c0392b', overdue: '#fdecea',
    },
  },
  {
    id: 'meadow-night',
    name: 'Meadow at night',
    mode: 'dark',
    vars: {
      bg: '#161917', surface: '#202421', text: '#e8ebe9', muted: '#9aa29d', border: '#343a36',
      brand: '#48b07c', onBrand: '#0c1a12', brandSoft: '#1e3328', danger: '#ef6b5c', overdue: '#3a2422',
    },
  },
  {
    id: 'crayon',
    name: 'Crayon box',
    mode: 'light',
    vars: {
      bg: '#f4f7fb', surface: '#ffffff', text: '#1b2333', muted: '#5e6b80', border: '#dce3ee',
      brand: '#2d6cdf', onBrand: '#ffffff', brandSoft: '#e3ecfc', danger: '#c53030', overdue: '#fde8e8',
    },
  },
  {
    id: 'bubble',
    name: 'Bubble bath',
    mode: 'light',
    vars: {
      bg: '#f4f1fb', surface: '#ffffff', text: '#2a2540', muted: '#6e6789', border: '#e3ddf3',
      brand: '#7b5bd6', onBrand: '#ffffff', brandSoft: '#eee8ff', danger: '#c2410c', overdue: '#fce7e1',
    },
  },
  {
    id: 'lemon',
    name: 'Lemon zest',
    mode: 'light',
    vars: {
      bg: '#fbfaef', surface: '#ffffff', text: '#26261a', muted: '#6d6b52', border: '#ece8c8',
      brand: '#a16207', onBrand: '#ffffff', brandSoft: '#fef3c7', danger: '#b91c1c', overdue: '#fee2e2',
    },
  },
  {
    id: 'nightlight',
    name: 'Night light',
    mode: 'dark',
    vars: {
      bg: '#11131c', surface: '#1a1d2b', text: '#e8eaf4', muted: '#9097b0', border: '#2c3145',
      brand: '#f2b544', onBrand: '#1a1406', brandSoft: '#3a2f14', danger: '#f87171', overdue: '#3b1f24',
    },
  },
  {
    id: 'deep-end',
    name: 'Deep end',
    mode: 'dark',
    vars: {
      bg: '#0d1b1e', surface: '#13272b', text: '#dff1ef', muted: '#8db0ac', border: '#24413f',
      brand: '#3cc6b4', onBrand: '#04201c', brandSoft: '#133a36', danger: '#ff7a7a', overdue: '#3a2226',
    },
  },
  {
    id: 'contrast',
    name: 'High contrast',
    mode: 'light',
    vars: {
      bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#2b2b2b', border: '#000000',
      brand: '#0047b3', onBrand: '#ffffff', brandSoft: '#dce8ff', danger: '#b00020', overdue: '#ffe0e0',
    },
  },
];

/** Follows the device's light/dark setting with the Meadow pair. */
export const AUTO = 'auto';
const KEY = 'choretation-theme';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function savedTheme(): string {
  try {
    const id = localStorage.getItem(KEY);
    return id && (id === AUTO || THEMES.some((t) => t.id === id)) ? id : AUTO;
  } catch {
    return AUTO;
  }
}

function resolve(id: string): Theme {
  if (id === AUTO) return THEMES.find((t) => t.id === (darkQuery().matches ? 'meadow-night' : 'meadow'))!;
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const cssName = (k: string) => `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

function apply(id: string) {
  const theme = resolve(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(cssName(k), v);
  root.dataset.mode = theme.mode;
  root.style.colorScheme = theme.mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars.brand);
}

export function setTheme(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* still applies for this visit */
  }
  apply(id);
}

/** Applies the saved theme before the first render, and keeps "auto" in step with the device. */
export function initTheme() {
  apply(savedTheme());
  darkQuery().addEventListener('change', () => {
    if (savedTheme() === AUTO) apply(AUTO);
  });
}
