/**
 * Design Tokens — "Pro Clair 2026"
 * Direction : minimalisme professionnel, fond chaud, orange vif sur blanc,
 * bento grid, typographie massive, zéro gradient de fond, zéro dark mode.
 * Tendances 2026 : bento layout, clean whites, bold typography, pill accents.
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';
dayjs.extend(relativeTime);
dayjs.locale('fr');

export const colors = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  bg:      '#FAF9F6',   // crème chaud (whiteboard look)
  card:    '#FFFFFF',
  card2:   '#F4F3F0',   // crème secondaire
  card3:   '#FFFBF7',   // crème orange très clair
  border:  '#E8E6E1',   // bordure chaude subtile

  // ── Typographie ────────────────────────────────────────────────────────────
  text:    '#1C1917',   // stone-900 (légèrement chaud, pas pur noir)
  text2:   '#57534E',   // stone-600
  text3:   '#A8A29E',   // stone-400

  // ── Brand — orange professionnel ──────────────────────────────────────────
  brand:      '#F05A28',   // orange vif mais professionnel (FedEx/Stripe vibe)
  brandGrad:  '#FF7A45',   // variante légèrement plus claire
  brandDim:   'rgba(240,90,40,0.08)',
  brandBorder:'rgba(240,90,40,0.20)',
  brandText:  '#FFFFFF',   // texte sur fond brand

  // ── Semantic ───────────────────────────────────────────────────────────────
  green:    '#16A34A',    // emerald-600
  greenDim: 'rgba(22,163,74,0.08)',
  greenBg:  '#F0FDF4',
  red:      '#DC2626',    // red-600
  redDim:   'rgba(220,38,38,0.08)',
  redBg:    '#FEF2F2',
  blue:     '#2563EB',    // blue-600
  blueDim:  'rgba(37,99,235,0.08)',
  blueBg:   '#EFF6FF',
  purple:   '#7C3AED',    // violet-600
  purpleDim:'rgba(124,58,237,0.08)',
  purpleBg: '#F5F3FF',
  amber:    '#D97706',    // amber-600
  amberDim: 'rgba(217,119,6,0.08)',
  amberBg:  '#FFFBEB',

  // ── Header — BLANC, pas sombre ────────────────────────────────────────────
  // En 2026 le header est blanc avec typo massive bold, pas un fond sombre
  hBg:     '#FFFFFF',
  hBorder: '#F4F3F0',
  hText:   '#1C1917',
  hText2:  '#78716C',   // stone-500
  hAccent: '#F05A28',   // accent brand sur fond blanc

  // ── Conservés pour rétrocompatibilité (screens qui lisent hBg1 etc.) ──────
  // Toutes les valeurs sombres remplacées par des équivalents clairs
  hBg1:    '#FFFFFF',
  hBg2:    '#FAF9F6',
  hBg3:    '#F4F3F0',
  hCard:   'rgba(240,90,40,0.05)',
  hBorder2:'rgba(240,90,40,0.12)',
  electric:       '#2563EB',   // blue plutôt que cyan
  electricDim:    'rgba(37,99,235,0.08)',
  electricGlow:   'rgba(37,99,235,0.15)',
  electricGrad:   '#1D4ED8',
  greenGrad:      '#15803D',
  glowBrand:      'rgba(240,90,40,0.12)',
  glowElectric:   'rgba(37,99,235,0.12)',
  glowGreen:      'rgba(22,163,74,0.12)',
};

// ── Typographie — échelle généreuse bold ──────────────────────────────────────
export const fontSize = {
  xs:   11,
  sm:   13,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  30,   // plus grand pour les stats
  hero: 40,   // nombres héros (CA mensuel)
};

// ── Grille 8pt ────────────────────────────────────────────────────────────────
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  tabBarClearance: 120,
};

// ── Rayons — généreux et modernes ─────────────────────────────────────────────
export const radius = {
  sm:  8,
  md:  14,
  lg:  20,
  xl:  28,
  pill:50,   // pills/badges
};

// ── Ombres — douces et chaudes (pas noires froides) ──────────────────────────
export const shadow = {
  card: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  float: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  brand: {
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ── Gradients (utilisés avec parcimonie — seulement sur les boutons CTA) ──────
export const gradients = {
  brand:   ['#F05A28', '#FF7A45'],
  green:   ['#16A34A', '#15803D'],
  red:     ['#DC2626', '#B91C1C'],
  dark:    ['#1C1917', '#292524'],
};

// ── Alias court ───────────────────────────────────────────────────────────────
const C = { ...colors };
export default C;
