import { Font, type FontData } from 'three/addons/loaders/FontLoader.js';
import helvetiker from './fonts/helvetiker.typeface.json';

export interface FontOption {
  id: string;
  label: string;
}

/** Fonts offered in the legend picker (first entry is the default). */
export const FONT_OPTIONS: FontOption[] = [
  { id: 'helvetiker', label: 'Helvetiker — Sans' },
  { id: 'optimer', label: 'Optimer — Serif' },
  { id: 'pirata', label: 'Pirata One — Gothic' },
  { id: 'bungee', label: 'Bungee — Display' },
  { id: 'rye', label: 'Rye — Western' },
  { id: 'bangers', label: 'Bangers — Comic' },
  { id: 'bevan', label: 'Bevan — Slab' },
  { id: 'specialelite', label: 'Special Elite — Typewriter' },
  { id: 'creepster', label: 'Creepster — Horror' },
  { id: 'pressstart', label: 'Press Start 2P — Pixel' },
];

// Lazy loaders so each typeface is fetched as its own chunk only when chosen.
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  optimer: () => import('./fonts/optimer.typeface.json'),
  pirata: () => import('./fonts/pirata.typeface.json'),
  bungee: () => import('./fonts/bungee.typeface.json'),
  rye: () => import('./fonts/rye.typeface.json'),
  bangers: () => import('./fonts/bangers.typeface.json'),
  bevan: () => import('./fonts/bevan.typeface.json'),
  specialelite: () => import('./fonts/specialelite.typeface.json'),
  creepster: () => import('./fonts/creepster.typeface.json'),
  pressstart: () => import('./fonts/pressstart.typeface.json'),
};

const cache = new Map<string, Font>();
cache.set('helvetiker', new Font(helvetiker as unknown as FontData));

let active: Font = cache.get('helvetiker')!;

/** The font currently used when building legend text (always loaded). */
export function getActiveFont(): Font {
  return active;
}

/**
 * Load (if needed) and select the font with the given id. Resolves once the
 * font is ready, so callers can rebuild geometry afterwards. Unknown ids fall
 * back to the bundled default.
 */
export async function setActiveFont(id: string): Promise<void> {
  const cached = cache.get(id);
  if (cached) {
    active = cached;
    return;
  }

  const loader = loaders[id];
  if (!loader) {
    active = cache.get('helvetiker')!;
    return;
  }

  const mod = await loader();
  const font = new Font(mod.default as FontData);
  cache.set(id, font);
  active = font;
}
