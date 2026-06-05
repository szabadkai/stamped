import { Font, type FontData } from 'three/addons/loaders/FontLoader.js';
import fontData from './helvetiker_regular.typeface.json';

let cached: Font | null = null;

/** Lazily construct the legend font from the bundled typeface JSON. */
export function getFont(): Font {
  if (!cached) {
    cached = new Font(fontData as unknown as FontData);
  }
  return cached;
}
