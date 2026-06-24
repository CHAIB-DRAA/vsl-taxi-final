// Design tokens — source unique. Tous les écrans importent d'ici.
// Modifier ici = changement global instantané.

export const colors = {
  // Backgrounds
  bg:      '#F0F3FA',
  card:    '#FFFFFF',
  card2:   '#F5F7FF',
  border:  '#E4E8F0',

  // Text
  text:    '#0D1117',
  text2:   '#64748B',
  text3:   '#94A3B8',

  // Brand
  brand:      '#FF6B00',
  brandGrad:  '#FF8C00',   // unique stop gradient — ne pas utiliser d'autre variante
  brandDim:   'rgba(255,107,0,0.10)',
  brandBorder:'rgba(255,107,0,0.25)',

  // Semantic
  green:    '#10B981',
  greenGrad:'#059669',
  greenDim: 'rgba(16,185,129,0.10)',
  red:      '#EF4444',
  redDim:   'rgba(239,68,68,0.10)',
  blue:     '#3B82F6',
  blueDim:  'rgba(59,130,246,0.10)',
  purple:   '#8B5CF6',
  purpleDim:'rgba(139,92,246,0.10)',
  amber:    '#F59E0B',
  amberDim: 'rgba(245,158,11,0.10)',

  // Dark header
  hBg1:    '#0A0F1E',
  hBg2:    '#111827',
  hBg3:    '#1A2235',
  hCard:   'rgba(255,255,255,0.07)',
  hBorder: 'rgba(255,255,255,0.10)',
  hText:   '#F1F5F9',
  hText2:  '#94A3B8',
};

// Échelle typographique — 6 steps (ne pas utiliser d'autres tailles)
export const fontSize = {
  xs:   11,
  sm:   13,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  28,
};

// Grille 8pt — utiliser uniquement ces valeurs
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  // Padding tab bar flottant — valeur unique pour tous les écrans
  tabBarClearance: 120,
};

// Border-radius — 4 niveaux
export const radius = {
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
};

// Ombres card standard
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  button: {
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },
};

// Alias court pour compatibilité (usage: import C from '../styles/tokens')
const C = {
  ...colors,
  // Rétrocompatibilité des noms utilisés dans les écrans existants
  bg:      colors.bg,
  card:    colors.card,
  card2:   colors.card2,
  border:  colors.border,
  text:    colors.text,
  text2:   colors.text2,
  text3:   colors.text3,
  brand:   colors.brand,
  green:   colors.green,
  red:     colors.red,
  blue:    colors.blue,
  purple:  colors.purple,
  amber:   colors.amber,
  hBg1:    colors.hBg1,
  hBg2:    colors.hBg2,
  hCard:   colors.hCard,
  hBorder: colors.hBorder,
  hText:   colors.hText,
  hText2:  colors.hText2,
};

export default C;
