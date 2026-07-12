import { useColorScheme } from 'react-native';

// Palette definita con /impeccable colorize: neutri ritinti verso la stessa
// famiglia cromatica (teal-verde) dell'accent, invece del grigio-blu slate
// scollegato di prima — coerenza sottile tra brand e superfici, non un
// restyling vistoso. Sistema "restrained": un solo accent + un danger.
const dark = {
  bg: '#0D1614',
  surface: '#141F1C',
  surface2: '#1A2724',
  text: '#E7EBE9',
  muted: '#93A19C',
  accent: '#38A68F',
  accentInk: '#062019',
  line: '#233330',
  danger: '#E5484D',
};

const light = {
  bg: '#F2F6F4',
  surface: '#FFFFFF',
  surface2: '#E7EFEC',
  text: '#141C1A',
  muted: '#5C6D68',
  accent: '#1C7A67',
  accentInk: '#FFFFFF',
  line: '#D7E3DF',
  danger: '#C4302B',
};

export type Theme = typeof dark;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}
