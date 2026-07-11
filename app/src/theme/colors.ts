import { useColorScheme } from 'react-native';

// Palette placeholder: coerente nella forma con quella di Quiete (stessi token),
// ma colori propri di CheckCasa. Va rivista con una passata di design dedicata
// prima del lancio pubblico — non blocca lo sviluppo dell'MVP.
const dark = {
  bg: '#10151B',
  surface: '#171F29',
  surface2: '#1E2733',
  text: '#E7EAEE',
  muted: '#93A0AC',
  accent: '#3FA796',
  accentInk: '#06201C',
  line: '#26313D',
  danger: '#E5484D',
};

const light = {
  bg: '#F5F6F4',
  surface: '#FFFFFF',
  surface2: '#ECEFEE',
  text: '#14181C',
  muted: '#5B6670',
  accent: '#1F7A6C',
  accentInk: '#FFFFFF',
  line: '#DCE1E0',
  danger: '#C4302B',
};

export type Theme = typeof dark;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}
